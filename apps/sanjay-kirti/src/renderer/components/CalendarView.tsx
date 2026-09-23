import React from 'react';
import { useCalendar } from '../hooks/useCalendar';
import { CalendarHeader } from './CalendarHeader';
import { NextMeeting } from './NextMeeting';
import { UpcomingList } from './UpcomingList';
import { DisconnectedState } from './DisconnectedState';
import { ConnectingState } from './ConnectingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

/**
 * Main Calendar View component
 * Orchestrates all calendar-related UI states
 */
export function CalendarView(): JSX.Element {
  const { status, events, error, isLoading, isRefreshing, connect, disconnect, refresh } = useCalendar();

  // Render disconnected state
  if (status === 'disconnected') {
    return (
      <div className="calendar-view">
        <CalendarHeader status={status} onRefresh={refresh} isRefreshing={isRefreshing} />
        <DisconnectedState onConnect={connect} />
      </div>
    );
  }

  // Render connecting state
  if (status === 'connecting') {
    return (
      <div className="calendar-view">
        <CalendarHeader status={status} onRefresh={refresh} isRefreshing={isRefreshing} />
        <ConnectingState />
      </div>
    );
  }

  // Render checking state (initial load)
  if (status === 'checking') {
    return (
      <div className="calendar-view">
        <CalendarHeader status={status} onRefresh={refresh} isRefreshing={isRefreshing} />
        <LoadingState message="Checking connection..." />
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="calendar-view">
        <CalendarHeader
          status={status}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          onDisconnect={disconnect}
        />
        <ErrorState error={error || 'An error occurred'} onReconnect={connect} />
      </div>
    );
  }

  // Render loading state (fetching events)
  if (isLoading) {
    return (
      <div className="calendar-view">
        <CalendarHeader
          status={status}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          onDisconnect={disconnect}
        />
        <LoadingState message="Loading your calendar..." />
      </div>
    );
  }

  // Render connected state with no events
  if (events.length === 0) {
    return (
      <div className="calendar-view">
        <CalendarHeader
          status={status}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          onDisconnect={disconnect}
        />
        {error && <div className="calendar-error">{error}</div>}
        <EmptyState />
      </div>
    );
  }

  // Render connected state with events
  const nextEvent = events[0];
  const upcomingEvents = events.slice(1);

  return (
    <div className="calendar-view">
      <CalendarHeader
        status={status}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        onDisconnect={disconnect}
      />
      {error && <div className="calendar-error">{error}</div>}
      <div className="calendar-content">
        <NextMeeting event={nextEvent} />
        {upcomingEvents.length > 0 && <UpcomingList events={upcomingEvents} />}
      </div>
    </div>
  );
}
