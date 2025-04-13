import 'dotenv/config';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { GooglePhotosService } from './services/GooglePhotosService';
import { DownloadService } from './services/DownloadService';
import { ExpressAuthService } from './services/ExpressAuthService';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Retrieves OAuth2 tokens, either from environment variables or via interactive flow.
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} redirectUri
 * @returns {Promise<Credentials>} - The OAuth2 credentials containing the access token.
 */
async function getTokens(clientId: string, clientSecret: string, redirectUri: string): Promise<Credentials> {
  const accessToken = process.env.ACCESS_TOKEN;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (accessToken) {
    console.log('Using existing access token from environment variables.');
    // If we have an access token, assume it's valid for now or can be refreshed.
    // Construct a partial Credentials object.
    // Note: google-auth-library might auto-refresh if refresh token is present.
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: process.env.EXPIRY_DATE ? parseInt(process.env.EXPIRY_DATE) : Date.now() + 3600 * 1000,
      token_type: 'Bearer'
    };
  } else {
    console.log('No ACCESS_TOKEN found. Starting OAuth2 authentication via Express server...');
    const expressAuthService = new ExpressAuthService(clientId, clientSecret, redirectUri);
    try {
      const tokens = await expressAuthService.authenticate();
      console.log('Authentication successful. Received new tokens:', tokens);
      // TODO: Consider saving these tokens back to .env or a secure store
      return tokens;
    } catch (error) {
      console.error('Authentication failed:', error);
      process.exit(1);
    }
  }
}

/**
 * Main execution function that orchestrates the downloading process.
 */
async function main() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI || 'http://localhost:3000/oauth2callback';

  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID and CLIENT_SECRET must be set in environment variables.');
    process.exit(1);
  }

  // Obtain tokens (either from env or via interactive flow)
  const tokens = await getTokens(clientId, clientSecret, redirectUri);

  if (!tokens.access_token) {
    console.error('Failed to obtain access token.');
    process.exit(1);
  }

  // Initialize services with the obtained access token
  const googlePhotosService = new GooglePhotosService(tokens.access_token);
  const downloadService = new DownloadService();

  console.log('Fetching media items from Google Photos...');
  const mediaItems = await googlePhotosService.listAllMediaItems();
  console.log(`Fetched ${mediaItems.length} media items.`);

  // Paths for mapping files
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const downloadMappingFile = path.join(downloadsDir, 'downloaded.json');
  const failedDownloadsFile = path.join(downloadsDir, 'failed_downloads.json');

  // Ensure downloads directory exists
  try {
    await fs.mkdir(downloadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating downloads directory:', err);
    // Decide if we should exit or continue
  }

  let downloadedMapping: Record<string, any> = {};
  let failedDownloads: any[] = [];

  // Load existing download mapping if it exists
  try {
    const mappingData = await fs.readFile(downloadMappingFile, 'utf8');
    downloadedMapping = JSON.parse(mappingData);
    console.log(`Loaded ${Object.keys(downloadedMapping).length} entries from download mapping.`);
  } catch (err) {
    console.log('Download mapping file not found or could not be read. Starting fresh.');
    downloadedMapping = {};
  }

  // Iterate through each media item
  for (const item of mediaItems) {
    const imageId = item.id;
    if (!item.baseUrl || !item.filename) {
      console.warn(`Skipping item ${imageId || '(no id)'} due to missing baseUrl or filename.`);
      continue;
    }
    if (downloadedMapping[imageId]) {
      // console.log(`Skipping "${item.filename}" (already downloaded).`); // Verbose
      continue;
    }

    // Construct download URL for original quality image (append '=d')
    // Note: Check if 'googlephotos' library provides a direct download URL or method
    const downloadUrl = `${item.baseUrl}=d`;
    const destination = path.join(downloadsDir, item.filename);
    try {
      console.log(`Downloading "${item.filename}"...`);
      await downloadService.downloadFile(downloadUrl, destination);
      // Update download mapping with metadata
      downloadedMapping[imageId] = {
        filename: item.filename,
        downloadUrl,
        metadata: item // Store the whole item for now
      };
      // Write updated mapping to file after each successful download
      await fs.writeFile(downloadMappingFile, JSON.stringify(downloadedMapping, null, 2));
      // console.log(`Downloaded "${item.filename}" successfully.`); // Verbose
    } catch (error: any) {
      console.error(`Failed to download "${item.filename}": ${error.message}`);
      failedDownloads.push({
        id: imageId,
        filename: item.filename,
        downloadUrl,
        error: error.message,
        metadata: item
      });
    }
  }

  // Write failed downloads log if any failures occurred
  if (failedDownloads.length > 0) {
    await fs.writeFile(failedDownloadsFile, JSON.stringify(failedDownloads, null, 2));
    console.log(`${failedDownloads.length} downloads failed. See ${failedDownloadsFile} for details.`);
  } else {
    console.log('All downloads checked. Process complete.');
  }
}

main().catch(err => console.error('Unhandled error in main:', err));
