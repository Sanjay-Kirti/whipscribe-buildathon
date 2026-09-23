import React from 'react';

interface DisconnectedStateProps {
  onConnect: () => void;
}

/**
 * First-run / disconnected state
 */
export function DisconnectedState({ onConnect }: DisconnectedStateProps): JSX.Element {
  return (
    <div className="state-container">
      <div className="state-card">
        <div className="state-icon">📅</div>
        <h2 className="state-title">Connect Your Google Calendar</h2>
        <p className="state-description">
          Connect your Google Calendar to see upcoming meetings and never miss an important call.
          WhipScribe will help you record and transcribe your meetings automatically.
        </p>
        <div className="state-benefits">
          <div className="benefit-item">
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">See your upcoming meetings at a glance</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">Quick access to meeting links</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">Ready to record when you are</span>
          </div>
        </div>
        <button className="btn-primary" onClick={onConnect}>
          Connect Google Calendar
        </button>
        <p className="state-note">
          Your credentials are stored securely in your system keychain.
        </p>
      </div>
    </div>
  );
}
