import { OAuth2Client } from 'google-auth-library';
import * as readline from 'readline';

/**
 * Service to handle OAuth2 authentication for the Google Photos Downloader.
 * @class AuthService
 */
export class AuthService {
  private oauth2Client: OAuth2Client;

  /**
   * Initializes the AuthService with client credentials.
   * @param {string} clientId - The OAuth2 client ID.
   * @param {string} clientSecret - The OAuth2 client secret.
   * @param {string} redirectUri - The redirect URI (e.g., 'urn:ietf:wg:oauth:2.0:oob').
   */
  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  /**
   * Generates an authentication URL for obtaining user consent.
   * @returns {string} The authentication URL.
   */
  public generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/photoslibrary.readonly'
    ];
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
    return authUrl;
  }

  /**
   * Retrieves tokens using the provided authorization code.
   * @param {string} code - The authorization code received from the consent page.
   * @returns {Promise<void>}
   */
  public async getTokens(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    console.log('Tokens acquired:');
    console.log(tokens);
  }

  /**
   * Runs the interactive authentication process.
   * @returns {Promise<void>}
   */
  public async authenticate(): Promise<void> {
    const authUrl = this.generateAuthUrl();
    console.log('Authorize this app by visiting the following url:');
    console.log(authUrl);
    const code = await this.promptUser('Enter the authorization code: ');
    await this.getTokens(code);
  }

  /**
   * Prompts the user for input from the command line.
   * @param {string} prompt - The prompt message.
   * @returns {Promise<string>} The user's input.
   */
  private promptUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise<string>((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }
} 