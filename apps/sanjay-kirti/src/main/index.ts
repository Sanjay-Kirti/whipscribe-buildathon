import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleOAuthService } from './calendar/GoogleOAuthService';
import { GoogleCalendarClient } from './calendar/GoogleCalendarClient';
import { RecordingService } from './recording/RecordingService';

// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let oauthService: GoogleOAuthService | null = null;
let calendarClient: GoogleCalendarClient | null = null;
let recordingService: RecordingService | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'WhipScribe Desktop'
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeCalendarServices(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Google OAuth credentials not configured. Calendar features will be unavailable.');
    return;
  }

  oauthService = new GoogleOAuthService({
    clientId,
    clientSecret,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  calendarClient = new GoogleCalendarClient(oauthService);
}

function initializeRecordingService(): void {
  recordingService = new RecordingService();

  // Forward recording status changes to renderer
  recordingService.on('status-change', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('recording:statusChange', session);
    }
  });
}

function setupCalendarIPC(): void {
  // Check if authenticated
  ipcMain.handle('calendar:isAuthenticated', async () => {
    if (!oauthService) return false;
    try {
      return await oauthService.isAuthenticated();
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  });

  // Connect (start OAuth flow)
  ipcMain.handle('calendar:connect', async () => {
    if (!oauthService) {
      return { success: false, error: 'Calendar service not configured' };
    }

    try {
      await oauthService.startAuthFlow();
      return { success: true };
    } catch (error) {
      console.error('OAuth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  });

  // Disconnect
  ipcMain.handle('calendar:disconnect', async () => {
    if (!oauthService) return;
    try {
      await oauthService.clearTokens();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  });

  // Get upcoming events
  ipcMain.handle('calendar:getUpcomingEvents', async () => {
    if (!calendarClient) {
      return { events: [], error: 'Calendar service not configured' };
    }

    try {
      return await calendarClient.getUpcomingEvents();
    } catch (error) {
      console.error('Error fetching events:', error);
      return {
        events: [],
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      };
    }
  });

  // Refresh events (same as getUpcomingEvents)
  ipcMain.handle('calendar:refreshEvents', async () => {
    if (!calendarClient) {
      return { events: [], error: 'Calendar service not configured' };
    }

    try {
      return await calendarClient.getUpcomingEvents();
    } catch (error) {
      console.error('Error refreshing events:', error);
      return {
        events: [],
        error: error instanceof Error ? error.message : 'Failed to refresh events',
      };
    }
  });
}

function setupRecordingIPC(): void {
  // Start recording
  ipcMain.handle('recording:start', async (_event, mode, meetingId, meetingTitle) => {
    if (!recordingService) {
      throw new Error('Recording service not initialized');
    }

    try {
      return await recordingService.startRecording(mode, meetingId, meetingTitle);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  });

  // Stop recording
  ipcMain.handle('recording:stop', async () => {
    if (!recordingService) {
      throw new Error('Recording service not initialized');
    }

    try {
      return await recordingService.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  });

  // Get current session
  ipcMain.handle('recording:getCurrentSession', async () => {
    if (!recordingService) {
      return null;
    }

    return recordingService.getCurrentSession();
  });

  // Find interrupted sessions
  ipcMain.handle('recording:findInterruptedSessions', async () => {
    if (!recordingService) {
      return [];
    }

    try {
      return await recordingService.findInterruptedSessions();
    } catch (error) {
      console.error('Error finding interrupted sessions:', error);
      return [];
    }
  });

  // Recover session
  ipcMain.handle('recording:recoverSession', async (_event, sessionDir, outputPath) => {
    if (!recordingService) {
      throw new Error('Recording service not initialized');
    }

    try {
      return await recordingService.recoverSession(sessionDir, outputPath);
    } catch (error) {
      console.error('Error recovering session:', error);
      throw error;
    }
  });

  // Discard session
  ipcMain.handle('recording:discardSession', async (_event, sessionDir) => {
    if (!recordingService) {
      throw new Error('Recording service not initialized');
    }

    try {
      await recordingService.discardSession(sessionDir);
    } catch (error) {
      console.error('Error discarding session:', error);
      throw error;
    }
  });

  // Check permissions
  ipcMain.handle('recording:checkPermissions', async () => {
    if (!recordingService) {
      return { microphone: false, screenRecording: false };
    }

    try {
      return await recordingService.checkPermissions();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { microphone: false, screenRecording: false };
    }
  });
}

app.whenReady().then(() => {
  initializeCalendarServices();
  initializeRecordingService();
  setupCalendarIPC();
  setupRecordingIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Cleanup services
  if (oauthService) {
    oauthService.cleanup();
  }
  if (recordingService) {
    recordingService.destroy();
  }
});
