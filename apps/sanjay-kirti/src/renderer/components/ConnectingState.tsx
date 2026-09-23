import React from 'react';

/**
 * OAuth connection in progress
 */
export function ConnectingState(): JSX.Element {
  return (
    <div className="state-container">
      <div className="state-card">
        <div className="state-spinner"></div>
        <h2 className="state-title">Connecting to Google Calendar</h2>
        <p className="state-description">
          Complete the authentication in your browser, then return here.
        </p>
        <p className="state-note">
          If the browser window didn't open, please check your browser.
        </p>
      </div>
    </div>
  );
}
