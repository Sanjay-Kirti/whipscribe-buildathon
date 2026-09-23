import React, { useState } from 'react';
import { useRecording } from '../hooks/useRecording';
import { useCalendar } from '../hooks/useCalendar';
import type { RecordingMode } from '../../preload/index';
import { formatRecordingDuration } from '../utils/dateUtils';

/**
 * Recording View
 * Shows recording controls and status
 */
export function RecordingView(): JSX.Element {
  const { currentSession, startRecording, stopRecording } = useRecording();
  const { events } = useCalendar();
  const [selectedMode, setSelectedMode] = useState<RecordingMode>('both');
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);

  const isRecording = currentSession?.status === 'recording';
  const isStarting = currentSession?.status === 'starting';
  const isStopping = currentSession?.status === 'stopping';
  const isCompleted = currentSession?.status === 'completed';

  const handleStart = async () => {
    try {
      const meeting = events.find((e) => e.id === selectedMeeting);
      await startRecording(
        selectedMode,
        meeting?.id,
        meeting?.title
      );
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Not recording - show controls
  if (!isRecording && !isStarting && !isStopping && !isCompleted) {
    return (
      <div className="recording-view">
        <div className="recording-controls">
          <h2 className="recording-title">Recording</h2>

          {/* Meeting selection */}
          {events.length > 0 && (
            <div className="recording-field">
              <label className="recording-label">Meeting (optional)</label>
              <select
                className="recording-select"
                value={selectedMeeting || ''}
                onChange={(e) => setSelectedMeeting(e.target.value || null)}
              >
                <option value="">No meeting selected</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recording mode */}
          <div className="recording-field">
            <label className="recording-label">Recording Mode</label>
            <div className="recording-mode-buttons">
              <button
                className={`mode-button ${selectedMode === 'system' ? 'active' : ''}`}
                onClick={() => setSelectedMode('system')}
              >
                <span className="mode-icon">🔊</span>
                <span className="mode-text">System Audio</span>
              </button>
              <button
                className={`mode-button ${selectedMode === 'microphone' ? 'active' : ''}`}
                onClick={() => setSelectedMode('microphone')}
              >
                <span className="mode-icon">🎤</span>
                <span className="mode-text">Microphone</span>
              </button>
              <button
                className={`mode-button ${selectedMode === 'both' ? 'active' : ''}`}
                onClick={() => setSelectedMode('both')}
              >
                <span className="mode-icon">🎙️</span>
                <span className="mode-text">Both</span>
              </button>
            </div>
          </div>

          {/* Start button */}
          <button className="btn-record" onClick={handleStart}>
            <span className="record-icon">⏺</span>
            <span className="record-text">Start Recording</span>
          </button>
        </div>
      </div>
    );
  }

  // Starting
  if (isStarting) {
    return (
      <div className="recording-view">
        <div className="recording-status">
          <div className="status-spinner"></div>
          <h3 className="status-title">Starting recording...</h3>
          <p className="status-text">Initializing audio capture</p>
        </div>
      </div>
    );
  }

  // Recording active
  if (isRecording) {
    const elapsed = currentSession.startTime
      ? Math.floor((Date.now() - currentSession.startTime) / 1000)
      : 0;

    return (
      <div className="recording-view">
        <div className="recording-active">
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span className="recording-label-text">RECORDING</span>
          </div>

          <div className="recording-time">{formatRecordingDuration(elapsed)}</div>

          <div className="recording-info">
            <div className="info-row">
              <span className="info-label">Mode:</span>
              <span className="info-value">{getModeLabel(currentSession.mode)}</span>
            </div>
            {currentSession.meetingTitle && (
              <div className="info-row">
                <span className="info-label">Meeting:</span>
                <span className="info-value">{currentSession.meetingTitle}</span>
              </div>
            )}
          </div>

          <button className="btn-stop" onClick={handleStop}>
            <span className="stop-icon">⏹</span>
            <span className="stop-text">Stop Recording</span>
          </button>
        </div>
      </div>
    );
  }

  // Stopping
  if (isStopping) {
    return (
      <div className="recording-view">
        <div className="recording-status">
          <div className="status-spinner"></div>
          <h3 className="status-title">Finalizing recording...</h3>
          <p className="status-text">Processing audio chunks</p>
        </div>
      </div>
    );
  }

  // Completed
  if (isCompleted) {
    return (
      <div className="recording-view">
        <div className="recording-completed">
          <div className="completed-icon">✓</div>
          <h3 className="completed-title">Recording Complete</h3>
          <div className="completed-info">
            <div className="info-row">
              <span className="info-label">Duration:</span>
              <span className="info-value">
                {formatRecordingDuration(currentSession.duration || 0)}
              </span>
            </div>
            {currentSession.meetingTitle && (
              <div className="info-row">
                <span className="info-label">Meeting:</span>
                <span className="info-value">{currentSession.meetingTitle}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">File:</span>
              <span className="info-value info-path">{currentSession.outputPath}</span>
            </div>
          </div>
          <p className="completed-note">
            Ready for transcription (Step 4 - not implemented yet)
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function getModeLabel(mode: RecordingMode): string {
  switch (mode) {
    case 'system':
      return 'System Audio';
    case 'microphone':
      return 'Microphone';
    case 'both':
      return 'System + Microphone';
    default:
      return mode;
  }
}
