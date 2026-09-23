import Foundation
import AVFoundation

// Recovery tool to reconstruct interrupted sessions

@main
struct RecoverSession {
    static func main() async {
        guard CommandLine.arguments.count >= 3 else {
            print("Usage: recover-session <session-dir> <output.m4a>")
            exit(1)
        }
        
        let sessionPath = CommandLine.arguments[1]
        let outputPath = CommandLine.arguments[2]
        
        print("=== Session Recovery ===")
        print("Session: \(sessionPath)")
        print("Output: \(outputPath)\n")
        
        let sessionURL = URL(fileURLWithPath: sessionPath)
        let chunksURL = sessionURL.appendingPathComponent("chunks")
        let manifestURL = sessionURL.appendingPathComponent("manifest.json")
        
        // Read manifest
        if let manifestData = try? Data(contentsOf: manifestURL),
           let manifest = try? JSONSerialization.jsonObject(with: manifestData) as? [String: Any] {
            print("Manifest:")
            print("  Status: \(manifest["status"] as? String ?? "unknown")")
            print("  Chunk count: \(manifest["chunkCount"] as? Int ?? 0)")
            print("")
        }
        
        // Find chunks
        guard let chunks = try? FileManager.default.contentsOfDirectory(atPath: chunksURL.path) else {
            print("❌ No chunks directory")
            exit(1)
        }
        
        let m4aChunks = chunks.filter { $0.hasSuffix(".m4a") }.sorted()
        print("Found \(m4aChunks.count) chunk files")
        
        // Validate chunks
        var validChunks: [(Int, URL, TimeInterval)] = []
        
        for chunkFile in m4aChunks {
            let chunkURL = chunksURL.appendingPathComponent(chunkFile)
            let asset = AVURLAsset(url: chunkURL)
            
            do {
                let duration = try await asset.load(.duration)
                let seconds = duration.seconds
                
                if seconds > 0.1 {
                    let index = Int(chunkFile.prefix(6)) ?? 0
                    validChunks.append((index, chunkURL, seconds))
                    print("  ✓ \(chunkFile): \(String(format: "%.2f", seconds))s")
                } else {
                    print("  ⚠️ \(chunkFile): incomplete/empty")
                }
            } catch {
                print("  ✗ \(chunkFile): unreadable")
            }
        }
        
        print("")
        print("Valid chunks: \(validChunks.count)")
        
        if validChunks.isEmpty {
            print("❌ No valid chunks to recover")
            exit(1)
        }
        
        // Reconstruct
        print("\nReconstructing...")
        let composition = AVMutableComposition()
        var totalDuration: CMTime = .zero
        
        for (index, chunkURL, _) in validChunks {
            let asset = AVURLAsset(url: chunkURL)
            let duration = try! await asset.load(.duration)
            
            try! await composition.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: asset,
                at: totalDuration
            )
            
            totalDuration = CMTimeAdd(totalDuration, duration)
            print("  + Chunk \(index): \(String(format: "%.2f", duration.seconds))s")
        }
        
        // Export
        let outputURL = URL(fileURLWithPath: outputPath)
        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
            print("❌ Cannot create exporter")
            exit(1)
        }
        
        exporter.outputURL = outputURL
        exporter.outputFileType = .m4a
        
        await exporter.export()
        
        if exporter.status == .completed {
            let attrs = try? FileManager.default.attributesOfItem(atPath: outputPath)
            let size = attrs?[.size] as? Int64 ?? 0
            let mb = Double(size) / 1024.0 / 1024.0
            
            print("")
            print("✅ Recovered: \(String(format: "%.2f", totalDuration.seconds))s")
            print("   Size: \(String(format: "%.2f", mb)) MB")
            print("   Output: \(outputPath)")
        } else {
            print("❌ Export failed")
            exit(1)
        }
    }
}
