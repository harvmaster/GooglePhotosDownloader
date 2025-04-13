
import type { ConfigService } from './config';

import { OAuth2Client } from 'google-auth-library';
import express, { Request, Response, Express } from 'express';

import debug, { Debug } from 'debug';
import { EventEmitter } from '../utils/event-emitter';

export type AuthServiceDependencies = {
  configService: ConfigService;
};

export type AuthDependencies = {
  configService: ConfigService;
  oauth2Client: OAuth2Client;
  express: Express;
  logger: Debug;
};

export type AuthServiceEventMap = {
  'authed': {
    accessToken: string;
    refreshToken: string;
  }
}

export class AuthService extends EventEmitter<AuthServiceEventMap> {
  constructor(private readonly dependencies: AuthDependencies) {
    super();

    this.dependencies.logger = debug('auth');

    // Set up route for OAuth2 callback
    this.dependencies.express.get('/oauth2callback', (req, res) => {
      this.handleRedirect(req, res);
    });

    // If no access token, generate an auth URL and log it to the console
    if (!this.dependencies.configService.config.ACCESS_TOKEN) {
      const authUrl = this.generateAuthUrl();
      this.dependencies.logger('Open the following URL in your browser to authenticate:');
      this.dependencies.logger(authUrl);
    }

    if (this.dependencies.configService.config.REFRESH_TOKEN) {
      this.refreshAccessToken();
    }
  }

  static async create(dependencies: AuthServiceDependencies) {
    const oauth2Client = new OAuth2Client(
      dependencies.configService.config.CLIENT_ID,
      dependencies.configService.config.CLIENT_SECRET,
      dependencies.configService.config.REDIRECT_URI
    );

    const logger = debug('auth');

    const app = express();
    app.listen(3000, () => {
      logger('Server is running on port 3000');
    });

    const authService = new AuthService({
      configService: dependencies.configService,
      oauth2Client,
      express: app,
      logger,
    });

    return authService;
  }

  /**
   * Generates an authentication URL for redirect-based OAuth2.
   * @returns {string} The authentication URL.
   */
  public generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/photoslibrary.readonly'
    ];
    return this.dependencies.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
  }

  public async handleRedirect(req: Request, res: Response) {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send('Missing code parameter.');
      return;
    }

    this.dependencies.logger('Handling redirect with code:', code);

    try {
      // Exchange the code for tokens
      const { tokens } = await this.dependencies.oauth2Client.getToken(code);
      this.dependencies.logger('Tokens:', tokens);
      this.dependencies.oauth2Client.setCredentials(tokens);

      if (!tokens.access_token || !tokens.refresh_token) {
        this.dependencies.logger('No access token or refresh token found');
        throw new Error('No access token or refresh token found');
      }

      this.dependencies.configService.config.ACCESS_TOKEN = tokens.access_token;
      this.dependencies.configService.config.REFRESH_TOKEN = tokens.refresh_token;

      this.emit('authed', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });

      res.send('Authentication successful! You can close this window.');
    } catch (error) {
      res.status(500).send('Authentication failed.');
    }
  }

  public async refreshAccessToken() {
    this.dependencies.logger('Refreshing access token');

    if (!this.dependencies.configService.config.REFRESH_TOKEN) {
      this.dependencies.logger('Failed to refresh access token: No refresh token found');
      throw new Error('Failed to refresh access token: No refresh token found');
    }

    this.dependencies.logger('Setting credentials');
    this.dependencies.oauth2Client.setCredentials({
      access_token: this.dependencies.configService.config.ACCESS_TOKEN,
      refresh_token: this.dependencies.configService.config.REFRESH_TOKEN,
      token_type: 'Bearer',
    });

    const { credentials: refreshedCredentials } = await this.dependencies.oauth2Client.refreshAccessToken();

    if (!refreshedCredentials.access_token || !refreshedCredentials.refresh_token) {
      this.dependencies.logger('Failed to refresh access token: No access token or refresh token found AFTER refreshing');
      throw new Error('Failed to refresh access token: No access token or refresh token found AFTER refreshing');
    }

    // Set an interval to refresh the access token every duration*0.8
    if (!refreshedCredentials.expiry_date) {
      this.dependencies.logger('Failed to refresh access token: No expiry date found AFTER refreshing');
      throw new Error('Failed to refresh access token: No expiry date found AFTER refreshing');
    }

    const duration = refreshedCredentials.expiry_date - Date.now();
    const refreshInterval = duration * 0.8;
    setInterval(() => {
      this.refreshAccessToken();
    }, refreshInterval);

    // Update the config with the refreshed credentials
    this.dependencies.configService.config.ACCESS_TOKEN = refreshedCredentials.access_token;
    this.dependencies.configService.config.REFRESH_TOKEN = refreshedCredentials.refresh_token;

    this.emit('authed', {
      accessToken: refreshedCredentials.access_token,
      refreshToken: refreshedCredentials.refresh_token,
    });
  }
}