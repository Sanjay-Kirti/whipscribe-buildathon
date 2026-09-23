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
});
