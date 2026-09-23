import { shell } from 'electron';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import * as keytar from 'keytar';
import * as crypto from 'crypto';

const SERVICE_NAME = 'whipscribe-desktop';
const ACCESS_TOKEN_KEY = 'google-access-token';
const REFRESH_TOKEN_KEY = 'google-refresh-token';
const TOKEN_EXPIRY_KEY = 'google-token-expiry';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // timestamp in milliseconds
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

/**
 * Google OAuth 2.0 service for desktop apps using loopback redirect
 * Implements RFC 8252 (OAuth 2.0 for Native Apps) with PKCE
 */
export class GoogleOAuthService {
  private config: OAuthConfig;
  private codeVerifier: string | null = null;
  private server: ReturnType<typeof createServer> | null = null;
  private port: number = 0;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { verifier: string; challenge: string } {
    // Code verifier: 43-128 characters from [A-Z][a-z][0-9]-._~
    const verifier = crypto.randomBytes(32).toString('base64url');
    
    // Code challenge: base64url(sha256(verifier))
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return { verifier, challenge };
  }

  /**
   * Start the OAuth flow
   * Opens system browser and starts local server to receive callback
   */
  async startAuthFlow(): Promise<OAuthTokens> {
    return new Promise((resolve, reject) => {
      const { verifier, challenge } = this.generatePKCE();
      this.codeVerifier = verifier;

      // Create HTTP server on random available port
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleCallback(req, res, resolve, reject);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to start local server'));
          return;
        }

        this.port = address.port;
        const redirectUri = `http://127.0.0.1:${this.port}/callback`;

        // Build authorization URL
        const authUrl = this.buildAuthUrl(redirectUri, challenge);

        // Open system browser
        shell.openExternal(authUrl);
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Build Google OAuth authorization URL
   */
  private buildAuthUrl(redirectUri: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to ensure refresh token
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle OAuth callback from browser
   */
  private async handleCallback(
    req: IncomingMessage,
    res: ServerResponse,
    resolve: (tokens: OAuthTokens) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    const url = new URL(req.url || '', `http://127.0.0.1:${this.port}`);

    // Send response to browser
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhipScribe Authentication</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 1rem;
              backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Authentication Successful</h1>
            <p>You can close this window and return to WhipScribe Desktop.</p>
          </div>
        </body>
      </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);

    // Close server
    this.server?.close();
    this.server = null;

    // Check for error
    const error = url.searchParams.get('error');
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || error;
      reject(new Error(`OAuth error: ${errorDescription}`));
      return;
    }

    // Get authorization code
    const code = url.searchParams.get('code');
    if (!code) {
      reject(new Error('No authorization code received'));
      return;
    }

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code, `http://127.0.0.1:${this.port}/callback`);
      
      // Store tokens securely
      await this.storeTokens(tokens);
      
      resolve(tokens);
    } catch (error) {
      reject(error as Error);
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.codeVerifier) {
      throw new Error('Code verifier not found');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      code_verifier: this.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthTokens> {
    const refreshToken = await keytar.getPassword(SERVICE_NAME, REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await this.storeTokens(tokens);

    return tokens;
  }

  /**
   * Get valid access token (refreshing if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    try {
      const accessToken = await keytar.getPassword(SERVICE_NAME, ACCESS_TOKEN_KEY);
      const expiryStr = await keytar.getPassword(SERVICE_NAME, TOKEN_EXPIRY_KEY);
      
      if (!accessToken || !expiryStr) {
        return null;
      }

      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();

      // Refresh if token expires within 5 minutes
      if (expiry - now < 5 * 60 * 1000) {
        const tokens = await this.refreshAccessToken();
        return tokens.accessToken;
      }

      return accessToken;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await keytar.getPassword(SERVICE_NAME, ACCESS_TOKEN_KEY);
    const refreshToken = await keytar.getPassword(SERVICE_NAME, REFRESH_TOKEN_KEY);
    return !!(accessToken && refreshToken);
  }

  /**
   * Store tokens securely in keychain
   */
  private async storeTokens(tokens: OAuthTokens): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, ACCESS_TOKEN_KEY, tokens.accessToken);
    await keytar.setPassword(SERVICE_NAME, TOKEN_EXPIRY_KEY, tokens.expiresAt.toString());
    
    if (tokens.refreshToken) {
      await keytar.setPassword(SERVICE_NAME, REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  }

  /**
   * Clear stored tokens (disconnect)
   */
  async clearTokens(): Promise<void> {
    await keytar.deletePassword(SERVICE_NAME, ACCESS_TOKEN_KEY);
    await keytar.deletePassword(SERVICE_NAME, REFRESH_TOKEN_KEY);
    await keytar.deletePassword(SERVICE_NAME, TOKEN_EXPIRY_KEY);
  }

  /**
   * Cleanup (close server if running)
   */
  cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
