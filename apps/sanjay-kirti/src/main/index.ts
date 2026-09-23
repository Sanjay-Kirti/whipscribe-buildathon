import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleOAuthService } from './calendar/GoogleOAuthService';
import { GoogleCalendarClient } from './calendar/GoogleCalendarClient';

// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow | null = null;
let oauthService: GoogleOAuthService | null = null;
let calendarClient: GoogleCalendarClient | null = null;

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

app.whenReady().then(() => {
  initializeCalendarServices();
  setupCalendarIPC();
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
  // Cleanup OAuth service
  if (oauthService) {
    oauthService.cleanup();
  }
});
