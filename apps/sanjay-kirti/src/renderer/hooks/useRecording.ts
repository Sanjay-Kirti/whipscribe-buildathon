import { useState, useEffect, useCallback } from 'react';
import type { RecordingSession, RecordingMode, RecordingStatus } from '../../preload/index';

export interface UseRecordingResult {
  currentSession: RecordingSession | null;
  interruptedSessions: RecordingSession[];
  isRecording: boolean;
  
  startRecording: (mode: RecordingMode, meetingId?: string, meetingTitle?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  recoverSession: (sessionDir: string) => Promise<void>;
  discardSession: (sessionDir: string) => Promise<void>;
  checkPermissions: () => Promise<{ microphone: boolean; screenRecording: boolean }>;
  refreshInterruptedSessions: () => Promise<void>;
}

/**
 * Hook for managing recording state
 */
export function useRecording(): UseRecordingResult {
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [interruptedSessions, setInterruptedSessions] = useState<RecordingSession[]>([]);

  // Load current session and interrupted sessions on mount
  useEffect(() => {
    loadCurrentSession();
    loadInterruptedSessions();

    // Listen for status changes
    const unsubscribe = window.electronAPI.recording.onStatusChange((session) => {
      setCurrentSession(session);
    });

    return unsubscribe;
  }, []);

  const loadCurrentSession = async () => {
    try {
      const session = await window.electronAPI.recording.getCurrentSession();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error loading current session:', error);
    }
  };

  const loadInterruptedSessions = async () => {
    try {
      const sessions = await window.electronAPI.recording.findInterruptedSessions();
      setInterruptedSessions(sessions);
    } catch (error) {
      console.error('Error loading interrupted sessions:', error);
    }
  };

  const startRecording = useCallback(
    async (mode: RecordingMode, meetingId?: string, meetingTitle?: string) => {
      try {
        const session = await window.electronAPI.recording.startRecording(mode, meetingId, meetingTitle);
        setCurrentSession(session);
      } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
      }
    },
    []
  );

  const stopRecording = useCallback(async () => {
    try {
      const session = await window.electronAPI.recording.stopRecording();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }, []);

  const recoverSession = useCallback(async (sessionDir: string) => {
    try {
      await window.electronAPI.recording.recoverSession(sessionDir);
      await loadInterruptedSessions();
    } catch (error) {
      console.error('Error recovering session:', error);
      throw error;
    }
  }, []);

  const discardSession = useCallback(async (sessionDir: string) => {
    try {
      await window.electronAPI.recording.discardSession(sessionDir);
      await loadInterruptedSessions();
    } catch (error) {
      console.error('Error discarding session:', error);
      throw error;
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      return await window.electronAPI.recording.checkPermissions();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { microphone: false, screenRecording: false };
    }
  }, []);

  const refreshInterruptedSessions = useCallback(async () => {
    await loadInterruptedSessions();
  }, []);

  const isRecording = currentSession?.status === 'recording';

  return {
    currentSession,
    interruptedSessions,
    isRecording,
    startRecording,
    stopRecording,
    recoverSession,
    discardSession,
    checkPermissions,
    refreshInterruptedSessions,
  };
}
