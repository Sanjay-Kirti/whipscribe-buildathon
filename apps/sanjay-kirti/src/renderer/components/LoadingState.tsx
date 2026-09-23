import React from 'react';

interface LoadingStateProps {
  message?: string;
}

/**
 * Loading state
 */
export function LoadingState({ message = 'Loading...' }: LoadingStateProps): JSX.Element {
  return (
    <div className="state-container">
      <div className="state-card">
        <div className="state-spinner"></div>
        <p className="state-description">{message}</p>
      </div>
    </div>
  );
}
