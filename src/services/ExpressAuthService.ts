import express, { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

/**
 * Service to handle OAuth2 authentication using an Express web server.
 * This allows redirect-based authentication without requiring manual token copy-paste.
 * @class ExpressAuthService
 */
export class ExpressAuthService {
  private oauth2Client: OAuth2Client;
  private app = express();
  private port: number;

  /**
   * Initializes the ExpressAuthService with client credentials.
   * @param {string} clientId - The OAuth2 client ID.
   * @param {string} clientSecret - The OAuth2 client secret.
   * @param {string} redirectUri - The redirect URI (should match the one set in Google Cloud Console, e.g. http://localhost:3000/oauth2callback).
   * @param {number} port - The port on which the Express server will run (default is 3000).
   */
  constructor(clientId: string, clientSecret: string, redirectUri: string, port = 3000) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.port = port;
  }

  /**
   * Generates an authentication URL for redirect-based OAuth2.
   * @returns {string} The authentication URL.
   */
  public generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/photoslibrary.readonly'
    ];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
  }

  /**
   * Starts the Express server to listen for the OAuth2 callback and exchanges the authorization code for tokens.
   * @returns {Promise<any>} Resolves with the OAuth tokens.
   */
  public async authenticate(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const server = this.app.listen(this.port, () => {
        console.log(`Express server running on port ${this.port} for OAuth2 callback.`);
      });

      // Define the callback route to handle OAuth2 redirects
      this.app.get('/oauth2callback', async (req: Request, res: Response) => {
        const code = req.query.code as string;
        if (!code) {
          res.status(400).send('Missing code parameter.');
          return;
        }
        try {
          // Exchange the code for tokens
          const { tokens } = await this.oauth2Client.getToken(code);
          this.oauth2Client.setCredentials(tokens);
          res.send('Authentication successful! You can close this window.');
          resolve(tokens);
        } catch (error) {
          res.status(500).send('Authentication failed.');
          reject(error);
        } finally {
          server.close();
        }
      });

      // Log the authentication URL
      console.log('Open the following URL in your browser to authenticate:');
      console.log(this.generateAuthUrl());
    });
  }
} 