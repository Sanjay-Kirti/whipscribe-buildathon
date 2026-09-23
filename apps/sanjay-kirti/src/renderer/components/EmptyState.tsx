import React from 'react';

/**
 * No upcoming events state
 */
export function EmptyState(): JSX.Element {
  return (
    <div className="state-container">
      <div className="state-card">
        <div className="state-icon">🎉</div>
        <h2 className="state-title">No Upcoming Meetings</h2>
        <p className="state-description">
          You have no meetings scheduled in the next 7 days. Enjoy your free time!
        </p>
        <p className="state-note">
          When you have upcoming meetings, they'll appear here with quick access to join links.
        </p>
      </div>
    </div>
  );
}
