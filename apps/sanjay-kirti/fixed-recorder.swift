import Foundation
import ScreenCaptureKit
import AVFoundation

// Fixed recorder with proper synchronization

enum RecorderError: Error {
    case noDisplay
    case streamCreationFailed
    case chunkCreationFailed
}

class FixedRecorder: NSObject, SCStreamDelegate, SCStreamOutput {
    private var stream: SCStream?
    
    // Writer synchronization: All writer operations happen on this queue
    private let writerQueue = DispatchQueue(label: "com.whipscribe.writer", qos: .userInitiated)
    
    // Accessed only on writerQueue
    private var currentChunkWriter: AVAssetWriter?
    private var audioInput: AVAssetWriterInput?
    private var micInput: AVAssetWriterInput?
    private var currentChunkIndex = 0
    private var currentChunkStartTime: CMTime?
    private var sessionHasStarted = false
    
    private let mode: String
    private let outputPath: String
    private let chunkDuration: TimeInterval
    private let totalDuration: Int
    
    private let sessionID: String
    private let sessionDir: URL
    private let chunksDir: URL
    private let manifestPath: URL
    
    private var sessionStartTime: Date?
    private var isRecording = false
    private var rotationTask: Task<Void, Never>?
    
    private var audioSampleCount = 0
    private var micSampleCount = 0
    
    init(mode: String, outputPath: String, chunkDuration: TimeInterval, totalDuration: Int) {
        self.mode = mode
        self.outputPath = outputPath
        self.chunkDuration = chunkDuration
        self.totalDuration = totalDuration
        self.sessionID = UUID().uuidString
        
        let baseURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("whipscribe-recordings")
        self.sessionDir = baseURL.appendingPathComponent(sessionID)
        self.chunksDir = sessionDir.appendingPathComponent("chunks")
        self.manifestPath = sessionDir.appendingPathComponent("manifest.json")
        
        super.init()
        
        try? FileManager.default.createDirectory(at: chunksDir, withIntermediateDirectories: true)
    }
    
    func start() async throws {
        print("[Recorder] Mode: \(mode), Chunk: \(chunkDuration)s, Total: \(totalDuration)s")
        print("[Recorder] Session: \(sessionID)")
        print("[Recorder] Dir: \(sessionDir.path)")
        print("")
        
        // Get display
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else {
            throw RecorderError.noDisplay
        }
        
        // Configure stream
        let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
        let config = SCStreamConfiguration()
        
        config.capturesAudio = (mode == "system" || mode == "both")
        config.captureMicrophone = (mode == "both")
        config.sampleRate = 48000
        config.channelCount = 2
        config.excludesCurrentProcessAudio = true
        config.width = 100
        config.height = 100
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.queueDepth = 3
        
        // Create stream - deliver samples on writerQueue for synchronization
        stream = SCStream(filter: filter, configuration: config, delegate: self)
        guard let stream = stream else {
            throw RecorderError.streamCreationFailed
        }
        
        // Add outputs - samples delivered on writerQueue
        if mode == "system" || mode == "both" {
            try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: writerQueue)
        }
        if mode == "both" {
            try stream.addStreamOutput(self, type: .microphone, sampleHandlerQueue: writerQueue)
        }
        
        // Start first chunk (on writerQueue)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            writerQueue.async {
                do {
                    try self.startNewChunk()
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
        
        // Start capture
        sessionStartTime = Date()
        isRecording = true
        try await stream.startCapture()
        
        print("[Recorder] ✅ Capture started")
        updateManifest(status: "recording")
        
        // Start chunk rotation task
        startChunkRotationTask()
        
        // Run for total duration
        try await Task.sleep(nanoseconds: UInt64(totalDuration) * 1_000_000_000)
        
        // Stop
        try await stop()
    }
    
    private func startChunkRotationTask() {
        rotationTask = Task { [weak self] in
            guard let self = self else { return }
            
            var nextRotationTime = Date().addingTimeInterval(self.chunkDuration)
            
            while self.isRecording {
                let now = Date()
                
                if now >= nextRotationTime {
                    print("[Recorder] ⏰ Chunk rotation triggered")
                    await self.rotateChunk()
                    nextRotationTime = Date().addingTimeInterval(self.chunkDuration)
                }
                
                // Check every 100ms
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }
    
    private func rotateChunk() async {
        print("[Recorder] Rotating chunk...")
        
        // Perform entire rotation on writerQueue to prevent concurrent sample delivery
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writerQueue.async {
                self.finalizeCurrentChunkSync()
                
                do {
                    try self.startNewChunk()
                } catch {
                    print("[Recorder] ⚠️ Failed to start new chunk: \(error)")
                }
                
                continuation.resume()
            }
        }
        
        updateManifest(status: "recording")
    }
    
    // MARK: - Writer operations (all synchronized on writerQueue)
    
    private func startNewChunk() throws {
        // MUST be called on writerQueue
        dispatchPrecondition(condition: .onQueue(writerQueue))
        
        currentChunkIndex += 1
        currentChunkStartTime = nil
        sessionHasStarted = false
        
        let chunkPath = chunksDir.appendingPathComponent(String(format: "%06d.m4a", currentChunkIndex))
        print("[Recorder] → Chunk \(currentChunkIndex): \(chunkPath.lastPathComponent)")
        
        currentChunkWriter = try AVAssetWriter(url: chunkPath, fileType: .m4a)
        
        let audioSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 48000,
            AVNumberOfChannelsKey: 2,
            AVEncoderBitRateKey: 128000
        ]
        
        if mode == "system" || mode == "both" {
            audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            audioInput?.expectsMediaDataInRealTime = true
            if let input = audioInput, let writer = currentChunkWriter, writer.canAdd(input) {
                writer.add(input)
            }
        }
        
        if mode == "both" {
            micInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            micInput?.expectsMediaDataInRealTime = true
            if let input = micInput, let writer = currentChunkWriter, writer.canAdd(input) {
                writer.add(input)
            }
        }
        
        currentChunkWriter?.startWriting()
    }
    
    private func finalizeCurrentChunkSync() {
        // MUST be called on writerQueue
        dispatchPrecondition(condition: .onQueue(writerQueue))
        
        guard let writer = currentChunkWriter else { return }
        
        print("[Recorder]   Finalizing chunk \(currentChunkIndex)...")
        
        audioInput?.markAsFinished()
        micInput?.markAsFinished()
        
        // Synchronous finish - block until done
        let semaphore = DispatchSemaphore(value: 0)
        writer.finishWriting {
            semaphore.signal()
        }
        semaphore.wait()
        
        let chunkPath = chunksDir.appendingPathComponent(String(format: "%06d.m4a", currentChunkIndex))
        let attrs = try? FileManager.default.attributesOfItem(atPath: chunkPath.path)
        let size = attrs?[.size] as? Int64 ?? 0
        
        print("[Recorder]   ✓ Chunk \(currentChunkIndex) finalized (\(size) bytes)")
        
        currentChunkWriter = nil
        audioInput = nil
        micInput = nil
        sessionHasStarted = false
    }
    
    private func stop() async throws {
        isRecording = false
        rotationTask?.cancel()
        
        let elapsed = Date().timeIntervalSince(sessionStartTime ?? Date())
        print("")
        print("[Recorder] Stopping after \(String(format: "%.1f", elapsed))s...")
        
        // Finalize current chunk on writerQueue
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writerQueue.async {
                self.finalizeCurrentChunkSync()
                continuation.resume()
            }
        }
        
        // Stop stream
        if let stream = stream {
            try await stream.stopCapture()
        }
        
        updateManifest(status: "completed")
        
        // Reconstruct final file
        try await reconstructRecording()
        
        print("")
        print("=== RECORDING COMPLETE ===")
        print("Chunks: \(currentChunkIndex)")
        print("System audio samples: \(audioSampleCount)")
        print("Microphone samples: \(micSampleCount)")
        print("Output: \(outputPath)")
    }
    
    private func reconstructRecording() async throws {
        print("[Recorder] Reconstructing from \(currentChunkIndex) chunks...")
        
        let outputURL = URL(fileURLWithPath: outputPath)
        let composition = AVMutableComposition()
        
        var totalDuration: CMTime = .zero
        
        for i in 1...currentChunkIndex {
            let chunkPath = chunksDir.appendingPathComponent(String(format: "%06d.m4a", i))
            
            guard FileManager.default.fileExists(atPath: chunkPath.path) else {
                print("[Recorder]   ⚠️ Chunk \(i) missing, skipping")
                continue
            }
            
            let asset = AVURLAsset(url: chunkPath)
            let duration = try await asset.load(.duration)
            
            if duration.seconds < 0.1 {
                print("[Recorder]   ⚠️ Chunk \(i) too short (\(duration.seconds)s), skipping")
                continue
            }
            
            try await composition.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: asset,
                at: totalDuration
            )
            
            totalDuration = CMTimeAdd(totalDuration, duration)
            print("[Recorder]   + Chunk \(i): \(String(format: "%.2f", duration.seconds))s")
        }
        
        // Export
        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
            throw RecorderError.chunkCreationFailed
        }
        
        exporter.outputURL = outputURL
        exporter.outputFileType = .m4a
        
        await exporter.export()
        
        if exporter.status == .completed {
            let attrs = try? FileManager.default.attributesOfItem(atPath: outputPath)
            let size = attrs?[.size] as? Int64 ?? 0
            let mb = Double(size) / 1024.0 / 1024.0
            
            print("[Recorder] ✓ Reconstructed: \(String(format: "%.2f", totalDuration.seconds))s, \(String(format: "%.2f", mb)) MB")
        } else {
            print("[Recorder] ⚠️ Export failed: \(exporter.error?.localizedDescription ?? "unknown")")
        }
    }
    
    private func updateManifest(status: String) {
        let manifest: [String: Any] = [
            "sessionID": sessionID,
            "mode": mode,
            "status": status,
            "chunkDuration": chunkDuration,
            "chunkCount": currentChunkIndex,
            "startTime": sessionStartTime?.timeIntervalSince1970 ?? 0,
            "currentTime": Date().timeIntervalSince1970
        ]
        
        if let data = try? JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted) {
            try? data.write(to: manifestPath)
        }
    }
    
    // MARK: - SCStreamOutput (called on writerQueue)
    
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        // Already on writerQueue - no race condition possible
        dispatchPrecondition(condition: .onQueue(writerQueue))
        
        guard let writer = currentChunkWriter else { return }
        
        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        
        // Start session on first sample if not already started
        if !sessionHasStarted {
            // Check writer is in correct state
            if writer.status == .writing {
                currentChunkStartTime = presentationTime
                writer.startSession(atSourceTime: presentationTime)
                sessionHasStarted = true
            } else {
                // Writer not ready, skip this sample (rare edge case)
                return
            }
        }
        
        switch type {
        case .audio:
            audioSampleCount += 1
            if let input = audioInput, input.isReadyForMoreMediaData {
                input.append(sampleBuffer)
            }
            
        case .microphone:
            micSampleCount += 1
            if let input = micInput, input.isReadyForMoreMediaData {
                input.append(sampleBuffer)
            }
            
        default:
            break
        }
    }
    
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[Recorder] ❌ Stream error: \(error)")
    }
}

@main
struct FixedRecorderApp {
    static func main() async {
        print("=== WhipScribe Fixed Recorder ===\n")
        
        guard CommandLine.arguments.count >= 5 else {
            print("Usage: fixed-recorder <system|both> <output.m4a> <chunk-seconds> <total-seconds>")
            print("")
            print("Examples:")
            print("  fixed-recorder system recording.m4a 3 30")
            print("  fixed-recorder both recording.m4a 5 60")
            exit(1)
        }
        
        let mode = CommandLine.arguments[1]
        let outputPath = CommandLine.arguments[2]
        let chunkDuration = Double(CommandLine.arguments[3]) ?? 5.0
        let totalDuration = Int(CommandLine.arguments[4]) ?? 30
        
        guard ["system", "both"].contains(mode) else {
            print("Error: Mode must be 'system' or 'both'")
            exit(1)
        }
        
        let recorder = FixedRecorder(
            mode: mode,
            outputPath: outputPath,
            chunkDuration: chunkDuration,
            totalDuration: totalDuration
        )
        
        do {
            try await recorder.start()
            exit(0)
        } catch {
            print("\n❌ Error: \(error)")
            exit(1)
        }
    }
}
