import { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent, CalendarEventsResponse } from '../../preload/index';

export type CalendarConnectionStatus =
  | 'checking'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface UseCalendarResult {
  status: CalendarConnectionStatus;
  events: CalendarEvent[];
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing Google Calendar state
 */
export function useCalendar(): UseCalendarResult {
  const [status, setStatus] = useState<CalendarConnectionStatus>('checking');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check initial authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuthenticated = await window.electronAPI.calendar.isAuthenticated();
      if (isAuthenticated) {
        setStatus('connected');
        await loadEvents();
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setStatus('disconnected');
    }
  };

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response: CalendarEventsResponse = await window.electronAPI.calendar.getUpcomingEvents();

      if (response.error) {
        // Check if it's an auth error
        if (response.error.includes('Authentication expired') || response.error.includes('invalid_grant')) {
          setStatus('error');
          setError('Your authentication has expired. Please reconnect your Google Calendar.');
          setEvents([]);
        } else {
          setError(response.error);
          setEvents(response.events);
        }
      } else {
        setEvents(response.events);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      const result = await window.electronAPI.calendar.connect();

      if (result.success) {
        setStatus('connected');
        await loadEvents();
      } else {
        setStatus('error');
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      console.error('Error connecting calendar:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await window.electronAPI.calendar.disconnect();
      setStatus('disconnected');
      setEvents([]);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'connected') return;

    try {
      setIsRefreshing(true);
      setError(null);

      const response: CalendarEventsResponse = await window.electronAPI.calendar.refreshEvents();

      if (response.error) {
        if (response.error.includes('Authentication expired') || response.error.includes('invalid_grant')) {
          setStatus('error');
          setError('Your authentication has expired. Please reconnect your Google Calendar.');
          setEvents([]);
        } else {
          setError(response.error);
          setEvents(response.events);
        }
      } else {
        setEvents(response.events);
        setError(null);
      }
    } catch (err) {
      console.error('Error refreshing events:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh events');
    } finally {
      setIsRefreshing(false);
    }
  }, [status]);

  return {
    status,
    events,
    error,
    isLoading,
    isRefreshing,
    connect,
    disconnect,
    refresh,
  };
}
