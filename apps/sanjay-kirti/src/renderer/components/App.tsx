import React from 'react';

export function App(): JSX.Element {
  const electronVersion = window.electronAPI?.getVersion() || 'unknown';

  return (
    <div className="app">
      <header className="app-header">
        <h1>WhipScribe Desktop</h1>
        <p className="subtitle">Track 2 - Desktop Meeting Recorder</p>
      </header>

      <main className="app-main">
        <div className="status-card">
          <h2>Application Status</h2>
          <p>✅ Electron application running</p>
          <p>✅ React renderer loaded</p>
          <p>✅ TypeScript compiled</p>
          <p>✅ Native Swift recorder integrated</p>
          <p className="version">Electron v{electronVersion}</p>
        </div>

        <div className="status-card pending">
          <h2>Pending Implementation</h2>
          <ul>
            <li>Google Calendar integration</li>
            <li>Recording controls and UI</li>
            <li>Transcription display</li>
            <li>Library management (MCP)</li>
            <li>Production UX and polish</li>
          </ul>
        </div>
      </main>

      <footer className="app-footer">
        <p>WhipScribe Buildathon Track 2</p>
      </footer>
    </div>
  );
}
