"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingService = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs/promises"));
const electron_1 = require("electron");
/**
 * Recording Service
 * Manages native recorder process and recording sessions
 */
class RecordingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.recorderProcess = null;
        this.currentSession = null;
        // Native recorder configuration
        this.CHUNK_DURATION = 5; // seconds
        this.MAX_DURATION = 3600; // 1 hour max per session
        // Use app data directory for recordings
        this.recordingsDir = path_1.default.join(electron_1.app.getPath('userData'), 'recordings');
        // Native recorder binaries
        this.recorderPath = path_1.default.join(__dirname, '../native/fixed-recorder');
        this.recoveryPath = path_1.default.join(__dirname, '../native/recover-session');
        // Ensure recordings directory exists
        this.ensureRecordingsDir();
    }
    async ensureRecordingsDir() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create recordings directory:', error);
        }
    }
    /**
     * Start a new recording session
     */
    async startRecording(mode, meetingId, meetingTitle) {
        if (this.recorderProcess) {
            throw new Error('Recording already in progress');
        }
        const sessionId = `session-${Date.now()}`;
        const outputPath = path_1.default.join(this.recordingsDir, `${sessionId}.m4a`);
        // Map mode to native recorder format
        const nativeMode = mode === 'microphone' ? 'system' : mode; // Note: mic-only uses 'system' in fixed-recorder
        this.currentSession = {
            sessionId,
            mode,
            status: 'starting',
            startTime: Date.now(),
            sessionDir: '', // Will be set by native recorder
            outputPath,
            meetingId,
            meetingTitle,
        };
        this.emit('status-change', this.currentSession);
        try {
            await this.spawnRecorder(nativeMode, outputPath, meetingId, meetingTitle);
            this.currentSession.status = 'recording';
            this.emit('status-change', this.currentSession);
            return { ...this.currentSession };
        }
        catch (error) {
            this.currentSession.status = 'error';
            this.currentSession.error = error instanceof Error ? error.message : 'Unknown error';
            this.emit('status-change', this.currentSession);
            throw error;
        }
    }
    /**
     * Stop the current recording
     */
    async stopRecording() {
        if (!this.recorderProcess || !this.currentSession) {
            throw new Error('No recording in progress');
        }
        this.currentSession.status = 'stopping';
        this.emit('status-change', this.currentSession);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.recorderProcess) {
                    this.recorderProcess.kill('SIGKILL');
                }
                reject(new Error('Recording stop timeout'));
            }, 10000);
            this.recorderProcess.once('exit', async () => {
                clearTimeout(timeout);
                if (this.currentSession) {
                    this.currentSession.status = 'completed';
                    this.currentSession.endTime = Date.now();
                    this.currentSession.duration = Math.round((this.currentSession.endTime - (this.currentSession.startTime || 0)) / 1000);
                    // Check if output file exists
                    if (this.currentSession.outputPath) {
                        try {
                            await fs.access(this.currentSession.outputPath);
                        }
                        catch {
                            this.currentSession.error = 'Output file not created';
                            this.currentSession.status = 'error';
                        }
                    }
                    this.emit('status-change', this.currentSession);
                    resolve({ ...this.currentSession });
                }
                this.recorderProcess = null;
            });
            // Send SIGTERM for graceful shutdown
            this.recorderProcess.kill('SIGTERM');
        });
    }
    /**
     * Get current recording session
     */
    getCurrentSession() {
        return this.currentSession ? { ...this.currentSession } : null;
    }
    /**
     * Find interrupted sessions
     */
    async findInterruptedSessions() {
        const sessions = [];
        try {
            // Check temp directory for whipscribe-recordings
            const tempRecordingsDir = path_1.default.join('/tmp', 'whipscribe-recordings');
            try {
                const sessionDirs = await fs.readdir(tempRecordingsDir);
                for (const sessionDir of sessionDirs) {
                    const sessionPath = path_1.default.join(tempRecordingsDir, sessionDir);
                    const manifestPath = path_1.default.join(sessionPath, 'manifest.json');
                    try {
                        const manifestData = await fs.readFile(manifestPath, 'utf-8');
                        const manifest = JSON.parse(manifestData);
                        // Check if session is interrupted
                        if (manifest.status === 'recording') {
                            // Check if chunks exist
                            const chunksDir = path_1.default.join(sessionPath, 'chunks');
                            const chunks = await fs.readdir(chunksDir);
                            const m4aChunks = chunks.filter((f) => f.endsWith('.m4a'));
                            if (m4aChunks.length > 0) {
                                sessions.push({
                                    sessionId: manifest.sessionID,
                                    mode: this.mapNativeModeToRecordingMode(manifest.mode),
                                    status: 'error',
                                    startTime: manifest.startTime * 1000,
                                    sessionDir: sessionPath,
                                    meetingId: manifest.meetingId,
                                    meetingTitle: manifest.meetingTitle,
                                    duration: Math.round((manifest.currentTime - manifest.startTime)),
                                });
                            }
                        }
                    }
                    catch (error) {
                        // Skip invalid manifest
                        continue;
                    }
                }
            }
            catch {
                // No temp recordings directory
            }
        }
        catch (error) {
            console.error('Error finding interrupted sessions:', error);
        }
        return sessions;
    }
    /**
     * Recover an interrupted session
     */
    async recoverSession(sessionDir, outputPath) {
        const finalOutputPath = outputPath || path_1.default.join(this.recordingsDir, `recovered-${Date.now()}.m4a`);
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(this.recoveryPath, [sessionDir, finalOutputPath]);
            let output = '';
            let errorOutput = '';
            process.stdout?.on('data', (data) => {
                output += data.toString();
                console.log('[Recovery]', data.toString().trim());
            });
            process.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error('[Recovery Error]', data.toString().trim());
            });
            process.on('exit', (code) => {
                if (code === 0) {
                    resolve(finalOutputPath);
                }
                else {
                    reject(new Error(`Recovery failed with code ${code}: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * Discard an interrupted session
     */
    async discardSession(sessionDir) {
        try {
            await fs.rm(sessionDir, { recursive: true, force: true });
        }
        catch (error) {
            console.error('Error discarding session:', error);
            throw error;
        }
    }
    /**
     * Check permissions
     */
    async checkPermissions() {
        // TODO: Implement actual permission checks
        // For now, return unknown state
        return {
            microphone: true, // Assume granted
            screenRecording: true, // Assume granted
        };
    }
    /**
     * Spawn native recorder process
     */
    async spawnRecorder(mode, outputPath, meetingId, meetingTitle) {
        return new Promise((resolve, reject) => {
            const args = [
                mode,
                outputPath,
                this.CHUNK_DURATION.toString(),
                this.MAX_DURATION.toString(),
            ];
            console.log('[Recorder] Spawning:', this.recorderPath, args);
            this.recorderProcess = (0, child_process_1.spawn)(this.recorderPath, args);
            let sessionDirFound = false;
            this.recorderProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log('[Recorder]', output.trim());
                // Extract session directory
                if (!sessionDirFound && output.includes('Dir:')) {
                    const match = output.match(/Dir:\s*(.+)/);
                    if (match && this.currentSession) {
                        this.currentSession.sessionDir = match[1].trim();
                        sessionDirFound = true;
                    }
                }
                // Check for capture started
                if (output.includes('Capture started')) {
                    // Update manifest with meeting metadata if available
                    if (meetingId && this.currentSession?.sessionDir) {
                        this.updateManifestWithMeetingData(this.currentSession.sessionDir, meetingId, meetingTitle);
                    }
                    resolve();
                }
            });
            this.recorderProcess.stderr?.on('data', (data) => {
                console.error('[Recorder Error]', data.toString().trim());
            });
            this.recorderProcess.on('error', (error) => {
                console.error('[Recorder] Process error:', error);
                reject(error);
            });
            this.recorderProcess.on('exit', (code, signal) => {
                console.log(`[Recorder] Process exited: code=${code}, signal=${signal}`);
                if (this.currentSession && this.currentSession.status === 'recording') {
                    // Unexpected exit during recording
                    this.currentSession.status = 'error';
                    this.currentSession.error = `Recorder crashed (code: ${code})`;
                    this.emit('status-change', this.currentSession);
                }
                this.recorderProcess = null;
            });
            // Timeout if capture doesn't start
            setTimeout(() => {
                if (!sessionDirFound && this.recorderProcess) {
                    this.recorderProcess.kill();
                    reject(new Error('Recorder failed to start within 10 seconds'));
                }
            }, 10000);
        });
    }
    /**
     * Update manifest with meeting metadata
     */
    async updateManifestWithMeetingData(sessionDir, meetingId, meetingTitle) {
        const manifestPath = path_1.default.join(sessionDir, 'manifest.json');
        try {
            const data = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(data);
            manifest.meetingId = meetingId;
            if (meetingTitle) {
                manifest.meetingTitle = meetingTitle;
            }
            await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        }
        catch (error) {
            console.error('Failed to update manifest:', error);
        }
    }
    /**
     * Map native mode to RecordingMode
     */
    mapNativeModeToRecordingMode(nativeMode) {
        switch (nativeMode) {
            case 'system':
                return 'system';
            case 'both':
                return 'both';
            default:
                return 'system';
        }
    }
    /**
     * Cleanup
     */
    destroy() {
        if (this.recorderProcess) {
            this.recorderProcess.kill('SIGTERM');
            this.recorderProcess = null;
        }
    }
}
exports.RecordingService = RecordingService;
