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
- Google Cloud OAuth credentials with Calendar API enabled

## Setup

1. **Clone and navigate to the app:**
   ```bash
   cd apps/sanjay-kirti
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment (optional for now):**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials when implementing features
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Run the application:**
   ```bash
   npm start
   ```

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

## What Does Not Work Yet

The following features are **not yet implemented**:

❌ Google Calendar integration
❌ Recording controls and UI
❌ Recording session management
❌ Transcription via WhipScribe API
❌ Transcript display (speaker-labeled)
❌ Library management via MCP
❌ Crash recovery UI
❌ Settings panel
❌ Empty/loading/error states
❌ Keyboard shortcuts
❌ System notifications
❌ Production UX polish

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

**Track 2 Status:** Scaffold complete, feature implementation pending
