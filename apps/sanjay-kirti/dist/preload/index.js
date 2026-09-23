"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a safe, typed API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getVersion: () => process.versions.electron,
    calendar: {
        isAuthenticated: () => electron_1.ipcRenderer.invoke('calendar:isAuthenticated'),
        connect: () => electron_1.ipcRenderer.invoke('calendar:connect'),
        disconnect: () => electron_1.ipcRenderer.invoke('calendar:disconnect'),
        getUpcomingEvents: () => electron_1.ipcRenderer.invoke('calendar:getUpcomingEvents'),
        refreshEvents: () => electron_1.ipcRenderer.invoke('calendar:refreshEvents'),
    },
    recording: {
        startRecording: (mode, meetingId, meetingTitle) => electron_1.ipcRenderer.invoke('recording:start', mode, meetingId, meetingTitle),
        stopRecording: () => electron_1.ipcRenderer.invoke('recording:stop'),
        getCurrentSession: () => electron_1.ipcRenderer.invoke('recording:getCurrentSession'),
        findInterruptedSessions: () => electron_1.ipcRenderer.invoke('recording:findInterruptedSessions'),
        recoverSession: (sessionDir, outputPath) => electron_1.ipcRenderer.invoke('recording:recoverSession', sessionDir, outputPath),
        discardSession: (sessionDir) => electron_1.ipcRenderer.invoke('recording:discardSession', sessionDir),
        checkPermissions: () => electron_1.ipcRenderer.invoke('recording:checkPermissions'),
        onStatusChange: (callback) => {
            const channel = 'recording:statusChange';
            const listener = (_event, session) => callback(session);
            electron_1.ipcRenderer.on(channel, listener);
            return () => electron_1.ipcRenderer.removeListener(channel, listener);
        },
    },
});
