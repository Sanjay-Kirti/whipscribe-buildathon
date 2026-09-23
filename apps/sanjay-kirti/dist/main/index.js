"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
const GoogleOAuthService_1 = require("./calendar/GoogleOAuthService");
const GoogleCalendarClient_1 = require("./calendar/GoogleCalendarClient");
const RecordingService_1 = require("./recording/RecordingService");
// Load environment variables
dotenv.config();
let mainWindow = null;
let oauthService = null;
let calendarClient = null;
let recordingService = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        title: 'WhipScribe Desktop'
    });
    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:8080');
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function initializeCalendarServices() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.warn('Google OAuth credentials not configured. Calendar features will be unavailable.');
        return;
    }
    oauthService = new GoogleOAuthService_1.GoogleOAuthService({
        clientId,
        clientSecret,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    calendarClient = new GoogleCalendarClient_1.GoogleCalendarClient(oauthService);
}
function initializeRecordingService() {
    recordingService = new RecordingService_1.RecordingService();
    // Forward recording status changes to renderer
    recordingService.on('status-change', (session) => {
        if (mainWindow) {
            mainWindow.webContents.send('recording:statusChange', session);
        }
    });
}
function setupCalendarIPC() {
    // Check if authenticated
    electron_1.ipcMain.handle('calendar:isAuthenticated', async () => {
        if (!oauthService)
            return false;
        try {
            return await oauthService.isAuthenticated();
        }
        catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    });
    // Connect (start OAuth flow)
    electron_1.ipcMain.handle('calendar:connect', async () => {
        if (!oauthService) {
            return { success: false, error: 'Calendar service not configured' };
        }
        try {
            await oauthService.startAuthFlow();
            return { success: true };
        }
        catch (error) {
            console.error('OAuth error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Authentication failed',
            };
        }
    });
    // Disconnect
    electron_1.ipcMain.handle('calendar:disconnect', async () => {
        if (!oauthService)
            return;
        try {
            await oauthService.clearTokens();
        }
        catch (error) {
            console.error('Error disconnecting:', error);
        }
    });
    // Get upcoming events
    electron_1.ipcMain.handle('calendar:getUpcomingEvents', async () => {
        if (!calendarClient) {
            return { events: [], error: 'Calendar service not configured' };
        }
        try {
            return await calendarClient.getUpcomingEvents();
        }
        catch (error) {
            console.error('Error fetching events:', error);
            return {
                events: [],
                error: error instanceof Error ? error.message : 'Failed to fetch events',
            };
        }
    });
    // Refresh events (same as getUpcomingEvents)
    electron_1.ipcMain.handle('calendar:refreshEvents', async () => {
        if (!calendarClient) {
            return { events: [], error: 'Calendar service not configured' };
        }
        try {
            return await calendarClient.getUpcomingEvents();
        }
        catch (error) {
            console.error('Error refreshing events:', error);
            return {
                events: [],
                error: error instanceof Error ? error.message : 'Failed to refresh events',
            };
        }
    });
}
function setupRecordingIPC() {
    // Start recording
    electron_1.ipcMain.handle('recording:start', async (_event, mode, meetingId, meetingTitle) => {
        if (!recordingService) {
            throw new Error('Recording service not initialized');
        }
        try {
            return await recordingService.startRecording(mode, meetingId, meetingTitle);
        }
        catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    });
    // Stop recording
    electron_1.ipcMain.handle('recording:stop', async () => {
        if (!recordingService) {
            throw new Error('Recording service not initialized');
        }
        try {
            return await recordingService.stopRecording();
        }
        catch (error) {
            console.error('Error stopping recording:', error);
            throw error;
        }
    });
    // Get current session
    electron_1.ipcMain.handle('recording:getCurrentSession', async () => {
        if (!recordingService) {
            return null;
        }
        return recordingService.getCurrentSession();
    });
    // Find interrupted sessions
    electron_1.ipcMain.handle('recording:findInterruptedSessions', async () => {
        if (!recordingService) {
            return [];
        }
        try {
            return await recordingService.findInterruptedSessions();
        }
        catch (error) {
            console.error('Error finding interrupted sessions:', error);
            return [];
        }
    });
    // Recover session
    electron_1.ipcMain.handle('recording:recoverSession', async (_event, sessionDir, outputPath) => {
        if (!recordingService) {
            throw new Error('Recording service not initialized');
        }
        try {
            return await recordingService.recoverSession(sessionDir, outputPath);
        }
        catch (error) {
            console.error('Error recovering session:', error);
            throw error;
        }
    });
    // Discard session
    electron_1.ipcMain.handle('recording:discardSession', async (_event, sessionDir) => {
        if (!recordingService) {
            throw new Error('Recording service not initialized');
        }
        try {
            await recordingService.discardSession(sessionDir);
        }
        catch (error) {
            console.error('Error discarding session:', error);
            throw error;
        }
    });
    // Check permissions
    electron_1.ipcMain.handle('recording:checkPermissions', async () => {
        if (!recordingService) {
            return { microphone: false, screenRecording: false };
        }
        try {
            return await recordingService.checkPermissions();
        }
        catch (error) {
            console.error('Error checking permissions:', error);
            return { microphone: false, screenRecording: false };
        }
    });
}
electron_1.app.whenReady().then(() => {
    initializeCalendarServices();
    initializeRecordingService();
    setupCalendarIPC();
    setupRecordingIPC();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('will-quit', () => {
    // Cleanup services
    if (oauthService) {
        oauthService.cleanup();
    }
    if (recordingService) {
        recordingService.destroy();
    }
});
