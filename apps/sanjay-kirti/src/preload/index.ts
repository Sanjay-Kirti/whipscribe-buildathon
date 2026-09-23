import { contextBridge, ipcRenderer } from 'electron';

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  meetingLink?: string;
  conferenceData?: {
    provider?: string;
    url?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  error?: string;
}

export type CalendarConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface CalendarAPI {
  // Check authentication status
  isAuthenticated: () => Promise<boolean>;
  
  // Start OAuth flow
  connect: () => Promise<{ success: boolean; error?: string }>;
  
  // Disconnect (clear tokens)
  disconnect: () => Promise<void>;
  
  // Fetch upcoming events
  getUpcomingEvents: () => Promise<CalendarEventsResponse>;
  
  // Refresh events
  refreshEvents: () => Promise<CalendarEventsResponse>;
}

export type RecordingMode = 'system' | 'microphone' | 'both';

export type RecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'completed'
  | 'error';

export interface RecordingSession {
  sessionId: string;
  mode: RecordingMode;
  status: RecordingStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  sessionDir: string;
  outputPath?: string;
  meetingId?: string;
  meetingTitle?: string;
  error?: string;
}

export interface RecordingAPI {
  // Start recording
  startRecording: (
    mode: RecordingMode,
    meetingId?: string,
    meetingTitle?: string
  ) => Promise<RecordingSession>;
  
  // Stop recording
  stopRecording: () => Promise<RecordingSession>;
  
  // Get current session
  getCurrentSession: () => Promise<RecordingSession | null>;
  
  // Find interrupted sessions
  findInterruptedSessions: () => Promise<RecordingSession[]>;
  
  // Recover session
  recoverSession: (sessionDir: string, outputPath?: string) => Promise<string>;
  
  // Discard session
  discardSession: (sessionDir: string) => Promise<void>;
  
  // Check permissions
  checkPermissions: () => Promise<{ microphone: boolean; screenRecording: boolean }>;
  
  // Listen for status changes
  onStatusChange: (callback: (session: RecordingSession) => void) => () => void;
}

// Expose a safe, typed API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => process.versions.electron,
  
  calendar: {
    isAuthenticated: () => ipcRenderer.invoke('calendar:isAuthenticated'),
    connect: () => ipcRenderer.invoke('calendar:connect'),
    disconnect: () => ipcRenderer.invoke('calendar:disconnect'),
    getUpcomingEvents: () => ipcRenderer.invoke('calendar:getUpcomingEvents'),
    refreshEvents: () => ipcRenderer.invoke('calendar:refreshEvents'),
  },
  
  recording: {
    startRecording: (mode: RecordingMode, meetingId?: string, meetingTitle?: string) =>
      ipcRenderer.invoke('recording:start', mode, meetingId, meetingTitle),
    stopRecording: () => ipcRenderer.invoke('recording:stop'),
    getCurrentSession: () => ipcRenderer.invoke('recording:getCurrentSession'),
    findInterruptedSessions: () => ipcRenderer.invoke('recording:findInterruptedSessions'),
    recoverSession: (sessionDir: string, outputPath?: string) =>
      ipcRenderer.invoke('recording:recoverSession', sessionDir, outputPath),
    discardSession: (sessionDir: string) =>
      ipcRenderer.invoke('recording:discardSession', sessionDir),
    checkPermissions: () => ipcRenderer.invoke('recording:checkPermissions'),
    onStatusChange: (callback: (session: RecordingSession) => void) => {
      const channel = 'recording:statusChange';
      const listener = (_event: any, session: RecordingSession) => callback(session);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => string;
  calendar: CalendarAPI;
  recording: RecordingAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
