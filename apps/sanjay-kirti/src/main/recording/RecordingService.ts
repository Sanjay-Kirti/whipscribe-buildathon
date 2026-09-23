import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';

export type RecordingMode = 'system' | 'microphone' | 'both';

export type RecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'completed'
  | 'error';

export interface RecordingSession {
  sessionId: string;
  mode: RecordingMode;
  status: RecordingStatus;
  startTime?: number; // timestamp
  endTime?: number;
  duration?: number; // seconds
  sessionDir: string;
  outputPath?: string;
  meetingId?: string;
  meetingTitle?: string;
  error?: string;
}

export interface RecordingManifest {
  sessionID: string;
  mode: string;
  status: string;
  chunkDuration: number;
  chunkCount: number;
  startTime: number;
  currentTime: number;
  meetingId?: string;
  meetingTitle?: string;
}

/**
 * Recording Service
 * Manages native recorder process and recording sessions
 */
export class RecordingService extends EventEmitter {
  private recorderProcess: ChildProcess | null = null;
  private currentSession: RecordingSession | null = null;
  private recordingsDir: string;
  private recorderPath: string;
  private recoveryPath: string;

  // Native recorder configuration
  private readonly CHUNK_DURATION = 5; // seconds
  private readonly MAX_DURATION = 3600; // 1 hour max per session

  constructor() {
    super();

    // Use app data directory for recordings
    this.recordingsDir = path.join(
      app.getPath('userData'),
      'recordings'
    );

    // Native recorder binaries
    this.recorderPath = path.join(__dirname, '../native/fixed-recorder');
    this.recoveryPath = path.join(__dirname, '../native/recover-session');

    // Ensure recordings directory exists
    this.ensureRecordingsDir();
  }

  private async ensureRecordingsDir(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create recordings directory:', error);
    }
  }

  /**
   * Start a new recording session
   */
  async startRecording(
    mode: RecordingMode,
    meetingId?: string,
    meetingTitle?: string
  ): Promise<RecordingSession> {
    if (this.recorderProcess) {
      throw new Error('Recording already in progress');
    }

    const sessionId = `session-${Date.now()}`;
    const outputPath = path.join(this.recordingsDir, `${sessionId}.m4a`);

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
    } catch (error) {
      this.currentSession.status = 'error';
      this.currentSession.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('status-change', this.currentSession);
      throw error;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(): Promise<RecordingSession> {
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

      this.recorderProcess!.once('exit', async () => {
        clearTimeout(timeout);

        if (this.currentSession) {
          this.currentSession.status = 'completed';
          this.currentSession.endTime = Date.now();
          this.currentSession.duration = Math.round(
            (this.currentSession.endTime - (this.currentSession.startTime || 0)) / 1000
          );

          // Check if output file exists
          if (this.currentSession.outputPath) {
            try {
              await fs.access(this.currentSession.outputPath);
            } catch {
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
      this.recorderProcess!.kill('SIGTERM');
    });
  }

  /**
   * Get current recording session
   */
  getCurrentSession(): RecordingSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Find interrupted sessions
   */
  async findInterruptedSessions(): Promise<RecordingSession[]> {
    const sessions: RecordingSession[] = [];

    try {
      // Check temp directory for whipscribe-recordings
      const tempRecordingsDir = path.join('/tmp', 'whipscribe-recordings');

      try {
        const sessionDirs = await fs.readdir(tempRecordingsDir);

        for (const sessionDir of sessionDirs) {
          const sessionPath = path.join(tempRecordingsDir, sessionDir);
          const manifestPath = path.join(sessionPath, 'manifest.json');

          try {
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest: RecordingManifest = JSON.parse(manifestData);

            // Check if session is interrupted
            if (manifest.status === 'recording') {
              // Check if chunks exist
              const chunksDir = path.join(sessionPath, 'chunks');
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
          } catch (error) {
            // Skip invalid manifest
            continue;
          }
        }
      } catch {
        // No temp recordings directory
      }
    } catch (error) {
      console.error('Error finding interrupted sessions:', error);
    }

    return sessions;
  }

  /**
   * Recover an interrupted session
   */
  async recoverSession(sessionDir: string, outputPath?: string): Promise<string> {
    const finalOutputPath = outputPath || path.join(
      this.recordingsDir,
      `recovered-${Date.now()}.m4a`
    );

    return new Promise((resolve, reject) => {
      const process = spawn(this.recoveryPath, [sessionDir, finalOutputPath]);

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
        } else {
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
  async discardSession(sessionDir: string): Promise<void> {
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error discarding session:', error);
      throw error;
    }
  }

  /**
   * Check permissions
   */
  async checkPermissions(): Promise<{
    microphone: boolean;
    screenRecording: boolean;
  }> {
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
  private async spawnRecorder(
    mode: string,
    outputPath: string,
    meetingId?: string,
    meetingTitle?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        mode,
        outputPath,
        this.CHUNK_DURATION.toString(),
        this.MAX_DURATION.toString(),
      ];

      console.log('[Recorder] Spawning:', this.recorderPath, args);

      this.recorderProcess = spawn(this.recorderPath, args);

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
            this.updateManifestWithMeetingData(
              this.currentSession.sessionDir,
              meetingId,
              meetingTitle
            );
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
  private async updateManifestWithMeetingData(
    sessionDir: string,
    meetingId: string,
    meetingTitle?: string
  ): Promise<void> {
    const manifestPath = path.join(sessionDir, 'manifest.json');

    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(data);

      manifest.meetingId = meetingId;
      if (meetingTitle) {
        manifest.meetingTitle = meetingTitle;
      }

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.error('Failed to update manifest:', error);
    }
  }

  /**
   * Map native mode to RecordingMode
   */
  private mapNativeModeToRecordingMode(nativeMode: string): RecordingMode {
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
  destroy(): void {
    if (this.recorderProcess) {
      this.recorderProcess.kill('SIGTERM');
      this.recorderProcess = null;
    }
  }
}
