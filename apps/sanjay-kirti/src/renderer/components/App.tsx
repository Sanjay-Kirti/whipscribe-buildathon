import React, { useEffect } from 'react';
import { CalendarView } from './CalendarView';
import { RecordingView } from './RecordingView';
import { RecoveryModal } from './RecoveryModal';
import { useRecording } from '../hooks/useRecording';

export function App(): JSX.Element {
  const { interruptedSessions, discardSession, recoverSession } = useRecording();
  const [showRecovery, setShowRecovery] = React.useState(false);

  // Check for interrupted sessions on mount
  useEffect(() => {
    if (interruptedSessions.length > 0) {
      setShowRecovery(true);
    }
  }, [interruptedSessions]);

  return (
    <div className="app">
      {showRecovery && interruptedSessions.length > 0 && (
        <RecoveryModal
          sessions={interruptedSessions}
          onRecover={async (sessionDir) => {
            await recoverSession(sessionDir);
            setShowRecovery(false);
          }}
          onDiscard={async (sessionDir) => {
            await discardSession(sessionDir);
            setShowRecovery(false);
          }}
          onClose={() => setShowRecovery(false)}
        />
      )}
      <div className="app-container">
        <CalendarView />
        <RecordingView />
      </div>
    </div>
  );
}
