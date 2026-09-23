import { contextBridge } from 'electron';

// Expose a safe, typed API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future IPC methods
  // Calendar, recording, transcription, and MCP methods will be added here
  getVersion: () => process.versions.electron
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getVersion: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
