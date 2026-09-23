# WhipScribe Desktop - Track 2

A macOS desktop application for recording meetings, transcribing them via the WhipScribe API, and managing your recording library.

## What This Is

WhipScribe Track 2 desktop application for the WhipScribe Buildathon. This app connects to Google Calendar, records meetings with system audio and microphone, transcribes them through WhipScribe's API, and manages recordings through the WhipScribe MCP server.

## Current Platform

**macOS 15.0+ (Sequoia) required**

The app uses ScreenCaptureKit for system audio capture, which requires macOS 15 or later.

## Architecture

- **Framework:** Electron (macOS desktop)
- **UI:** React + TypeScript
- **Recording:** Swift native helper (ScreenCaptureKit + AVFoundation)
  - `fixed-recorder` - System audio + microphone capture with chunk-based architecture
  - `recover-session` - Crash recovery and session reconstruction
- **Transcription:** WhipScribe HTTP API
- **Library:** WhipScribe MCP server
- **Security:** Context isolation enabled, no Node.js in renderer

## Prerequisites

- macOS 15.0+ (Sequoia)
- Node.js 18+
- WhipScribe account and API key (get from [whipscribe.com/account](https://whipscribe.com/account))
- Google Cloud OAuth credentials with Calendar API enabled (see Google Calendar setup below)

## Setup

1. **Clone and navigate to the app:**
   ```bash
   cd apps/sanjay-kirti
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Google Calendar (required):**
   
   a. Create a Google Cloud project:
      - Go to [Google Cloud Console](https://console.cloud.google.com/)
      - Create a new project or select an existing one
      - Enable the Google Calendar API:
        - Navigate to "APIs & Services" → "Library"
        - Search for "Google Calendar API"
        - Click "Enable"
   
   b. Create OAuth 2.0 credentials:
      - Go to "APIs & Services" → "Credentials"
      - Click "Create Credentials" → "OAuth client ID"
      - Select "Desktop app" as the application type
      - Name your OAuth client (e.g., "WhipScribe Desktop")
      - Click "Create"
      - Download the JSON or copy the client ID and client secret
   
   c. Configure the app:
      ```bash
      cp .env.example .env
      ```
      Edit `.env` and add your credentials:
      ```
      GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
      GOOGLE_CLIENT_SECRET=your-client-secret
      ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Run the application:**
   ```bash
   npm start
   ```

## Google Calendar

### OAuth Flow

The app uses the standard OAuth 2.0 authorization code flow with PKCE for desktop applications:

1. User clicks "Connect Google Calendar"
2. App starts a local HTTP server on `http://127.0.0.1:<random-port>/callback`
3. System browser opens to Google's authorization page
4. User authenticates and grants calendar read permission
5. Google redirects back to the local server with an authorization code
6. App exchanges the code for access and refresh tokens
7. Tokens are stored securely in macOS Keychain via `keytar`

### Credentials Storage

- **Access tokens:** macOS Keychain (service: `whipscribe-desktop`, account: `google-access-token`)
- **Refresh tokens:** macOS Keychain (service: `whipscribe-desktop`, account: `google-refresh-token`)
- **Token expiry:** macOS Keychain (service: `whipscribe-desktop`, account: `google-token-expiry`)

Tokens are automatically refreshed when they expire (5-minute buffer before expiration).

### Disconnecting

To disconnect Google Calendar:
1. Click "Disconnect" in the app header (when connected)
2. This removes tokens from the macOS Keychain
3. To fully revoke access, visit [Google Account Permissions](https://myaccount.google.com/permissions)

### API Usage

The app fetches:
- **Primary calendar only** (not all calendars)
- **Next 7 days** of events
- **Maximum 10 events** per request
- **Timed events only** (all-day events are included but displayed differently)
- **Confirmed and tentative events** (cancelled events are filtered out)

Event data includes:
- Title, start time, end time
- Location (if present)
- Meeting links (Google Meet, Zoom, Teams, Webex automatically detected)
- Conference provider information

### Troubleshooting

**"Calendar service not configured"**
- Ensure `.env` file exists with valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Restart the app after adding credentials

**"Authentication expired. Please reconnect."**
- Your refresh token is invalid or expired
- Click "Reconnect Calendar" or disconnect and connect again

**"OAuth error: access_denied"**
- You denied calendar access in the Google consent screen
- Try connecting again and click "Allow"

**Browser window didn't open**
- Check if your default browser is set correctly
- Try manually opening the authorization URL from the console logs

## Development

### Available Scripts

- `npm run build` - Build main, preload, and renderer processes
- `npm run build:main` - Build only the Electron main process
- `npm run build:preload` - Build only the preload script
- `npm run build:renderer` - Build only the React renderer
- `npm run dev` - Build and run in development mode
- `npm run dev:renderer` - Start webpack dev server for renderer (port 8080)
- `npm start` - Build and launch the application
- `npm run clean` - Remove build artifacts

### Project Structure

```
apps/sanjay-kirti/
├── src/
│   ├── main/              # Electron main process
│   │   ├── calendar/      # Google Calendar integration (future)
│   │   ├── recording/     # Recording session management (future)
│   │   ├── whipscribe/    # WhipScribe API client (future)
│   │   ├── mcp/           # MCP library integration (future)
│   │   ├── native/        # Swift native binaries
│   │   │   ├── fixed-recorder
│   │   │   └── recover-session
│   │   └── index.ts       # Main process entry point
│   ├── preload/           # Secure IPC bridge
│   │   └── index.ts
│   └── renderer/          # React UI
│       ├── components/
│       ├── hooks/
│       └── styles/
├── fixed-recorder.swift   # Swift source (reference)
├── recover-session.swift  # Swift source (reference)
└── package.json
```

## What Works

✅ **Currently Implemented:**
- Electron application scaffold
- React renderer with TypeScript
- Secure preload bridge (context isolation enabled)
- TypeScript compilation and build system
- Webpack bundler for renderer
- Native Swift recorder binaries integrated (`fixed-recorder`, `recover-session`)
- Development and production build scripts
- **Google Calendar integration:**
  - OAuth 2.0 with PKCE (loopback redirect)
  - Secure token storage in macOS Keychain
  - Automatic token refresh
  - Upcoming events display (next 7 days)
  - Meeting link detection (Google Meet, Zoom, Teams, Webex)
  - All connection states (disconnected, connecting, connected, error, empty)
  - Manual refresh
  - Disconnect/reconnect flow

## What Does Not Work Yet

The following features are **not yet implemented**:

❌ Recording controls and UI
❌ Recording session management
❌ Transcription via WhipScribe API
❌ Transcript display (speaker-labeled)
❌ Library management via MCP
❌ Crash recovery UI
❌ Settings panel
❌ Keyboard shortcuts
❌ System notifications
❌ Production UX polish (animations, transitions, advanced error handling)

## Native Recorder

The app includes production-ready Swift binaries for audio capture:

- **fixed-recorder:** ScreenCaptureKit + AVFoundation recorder
  - Captures system audio, microphone, or both simultaneously
  - 5-second chunk rotation (crash-resistant)
  - Validated with 50+ test rotations, no crashes
  - Manifest-based session tracking

- **recover-session:** Session reconstruction tool
  - Recovers interrupted recordings from chunks
  - Validates and merges audio chunks
  - Maximum audio loss: ~5 seconds per crash

These binaries are located in `src/main/native/` and are ready for integration.

## Security

- ✅ Context isolation enabled
- ✅ Node.js integration disabled in renderer
- ✅ Secure IPC bridge via preload script
- ✅ Content Security Policy configured
- ✅ Secrets excluded from git (`.env` in `.gitignore`)

**Important:** Never commit real API keys or OAuth credentials. Use `.env` for local secrets and macOS Keychain for production token storage.

## Known Issues

- MCP OAuth flow not yet documented (required for library management)
- System audio recording requires manual permission grant in System Settings
- Google OAuth client must be configured before calendar integration

## Next Steps

Implementation will proceed in the official Track 2 order:

1. **Calendar** - Google Calendar OAuth and event listing
2. **Recording** - Swift recorder integration with UI controls
3. **Transcription** - WhipScribe API integration and transcript display
4. **Library** - MCP server integration for library management
5. **Polish** - Production UX, states, shortcuts, notifications

## License

Built for WhipScribe Buildathon Track 2

---

**Track 2 Status:** Step 1 complete (scaffold), Step 2 complete (Google Calendar), Steps 3-5 pending (recording → transcription → library → polish)
