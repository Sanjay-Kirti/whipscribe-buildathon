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
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => string;
  calendar: CalendarAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
