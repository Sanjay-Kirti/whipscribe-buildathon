import React from 'react';

interface ErrorStateProps {
  error: string;
  onReconnect: () => void;
}

/**
 * Error state with reconnect option
 */
export function ErrorState({ error, onReconnect }: ErrorStateProps): JSX.Element {
  return (
    <div className="state-container">
      <div className="state-card state-error">
        <div className="state-icon error">⚠️</div>
        <h2 className="state-title">Connection Error</h2>
        <p className="state-description">{error}</p>
        <button className="btn-primary" onClick={onReconnect}>
          Reconnect Calendar
        </button>
      </div>
    </div>
  );
}
