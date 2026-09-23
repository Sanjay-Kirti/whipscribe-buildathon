import React, { useState } from 'react';
import type { RecordingSession } from '../../preload/index';
import { formatRecordingDuration } from '../utils/dateUtils';

interface RecoveryModalProps {
  sessions: RecordingSession[];
  onRecover: (sessionDir: string) => Promise<void>;
  onDiscard: (sessionDir: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Recovery Modal
 * Prompts user to recover or discard interrupted sessions
 */
export function RecoveryModal({
  sessions,
  onRecover,
  onDiscard,
  onClose,
}: RecoveryModalProps): JSX.Element {
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = sessions[0]; // Show first interrupted session

  if (!session) {
    return <></>;
  }

  const handleRecover = async () => {
    setIsRecovering(true);
    setError(null);

    try {
      await onRecover(session.sessionDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
      setIsRecovering(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    setError(null);

    try {
      await onDiscard(session.sessionDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard');
      setIsDiscarding(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content recovery-modal">
        <div className="modal-header">
          <h2 className="modal-title">Interrupted Recording Found</h2>
        </div>

        <div className="modal-body">
          <div className="recovery-icon">🔄</div>

          <p className="recovery-description">
            An interrupted recording was found from a previous session. You can recover it or discard it.
          </p>

          <div className="recovery-details">
            {session.meetingTitle && (
              <div className="detail-row">
                <span className="detail-label">Meeting:</span>
                <span className="detail-value">{session.meetingTitle}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Mode:</span>
              <span className="detail-value">{getModeLabel(session.mode)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">
                ~{formatRecordingDuration(session.duration || 0)} (estimated)
              </span>
            </div>
            {session.startTime && (
              <div className="detail-row">
                <span className="detail-label">Started:</span>
                <span className="detail-value">
                  {new Date(session.startTime).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="recovery-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={handleDiscard}
            disabled={isRecovering || isDiscarding}
          >
            {isDiscarding ? 'Discarding...' : 'Discard'}
          </button>
          <button
            className="btn-primary"
            onClick={handleRecover}
            disabled={isRecovering || isDiscarding}
          >
            {isRecovering ? 'Recovering...' : 'Recover Recording'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getModeLabel(mode: string): string {
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
