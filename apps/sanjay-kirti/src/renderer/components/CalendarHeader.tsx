import React from 'react';
import type { CalendarConnectionStatus } from '../hooks/useCalendar';

interface CalendarHeaderProps {
  status: CalendarConnectionStatus;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDisconnect?: () => void;
}

/**
 * Calendar header with status and controls
 */
export function CalendarHeader({
  status,
  onRefresh,
  isRefreshing,
  onDisconnect,
}: CalendarHeaderProps): JSX.Element {
  const statusDisplay: Record<CalendarConnectionStatus, { text: string; className: string }> = {
    checking: { text: 'Checking...', className: 'status-checking' },
    disconnected: { text: 'Not connected', className: 'status-disconnected' },
    connecting: { text: 'Connecting...', className: 'status-connecting' },
    connected: { text: 'Connected', className: 'status-connected' },
    error: { text: 'Error', className: 'status-error' },
  };

  const currentStatus = statusDisplay[status];

  return (
    <header className="calendar-header">
      <div className="calendar-header-left">
        <h1 className="calendar-title">WhipScribe Desktop</h1>
        <div className={`calendar-status ${currentStatus.className}`}>
          <span className="status-indicator"></span>
          <span className="status-text">{currentStatus.text}</span>
        </div>
      </div>
      <div className="calendar-header-right">
        {status === 'connected' && (
          <>
            <button
              className="btn-secondary"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh calendar"
            >
              {isRefreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
            {onDisconnect && (
              <button className="btn-text" onClick={onDisconnect} title="Disconnect calendar">
                Disconnect
              </button>
            )}
          </>
        )}
        {status === 'error' && onDisconnect && (
          <button className="btn-text" onClick={onDisconnect} title="Disconnect calendar">
            Disconnect
          </button>
        )}
      </div>
    </header>
  );
}
