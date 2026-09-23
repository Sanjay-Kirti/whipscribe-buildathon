"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a safe, typed API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Placeholder for future IPC methods
    // Calendar, recording, transcription, and MCP methods will be added here
    getVersion: () => process.versions.electron
});
