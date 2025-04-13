import 'dotenv/config';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { GooglePhotosService } from './services/GooglePhotosService';
import { DownloadService } from './services/DownloadService';
import { ExpressAuthService } from './services/ExpressAuthService';
import * as fs from 'fs/promises';
import * as path from 'path';
import pLimit from 'p-limit';

/**
 * Retrieves OAuth2 tokens, either from environment variables or via interactive flow.
 * Handles automatic token refresh if needed and refresh token is available.
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} redirectUri
 * @returns {Promise<Credentials>} - The OAuth2 credentials containing the access token.
 */
async function getTokens(clientId: string, clientSecret: string, redirectUri: string): Promise<Credentials> {
  const accessToken = process.env.ACCESS_TOKEN;
  const refreshToken = process.env.REFRESH_TOKEN;
  const expiryDateEnv = process.env.EXPIRY_DATE;

  // Initialize OAuth2Client regardless of source
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

  if (accessToken && refreshToken) {
    console.log('Using existing tokens from environment variables.');
    const credentials: Credentials = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDateEnv ? parseInt(expiryDateEnv) : null, // Use null if not set
      token_type: 'Bearer'
    };
    oauth2Client.setCredentials(credentials);

    // Check if the token is expired or close to expiring (e.g., within 5 mins)
    const expiryThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
    const isTokenExpired = credentials.expiry_date ? (credentials.expiry_date - expiryThreshold < Date.now()) : true; // Assume expired if no date

    if (isTokenExpired) {
      console.log('Access token expired or nearing expiry. Attempting refresh...');
      try {
        const { credentials: refreshedCredentials } = await oauth2Client.refreshAccessToken();
        console.log('Token refreshed successfully.');
        // Note: The refreshed credentials are automatically set on oauth2Client by refreshAccessToken()
        // We return the *new* credentials. Consider prompting user to update .env
        console.warn('ACTION NEEDED: Please update ACCESS_TOKEN and potentially REFRESH_TOKEN/EXPIRY_DATE in your .env file with the latest values for future runs.');
        console.log('New Credentials:', refreshedCredentials);
        return refreshedCredentials;
      } catch (refreshError: any) {
        console.error('Failed to refresh access token:', refreshError.message);
        console.log('Proceeding with potentially expired token or requiring new login...');
        // Fall through to interactive login if refresh fails catastrophically
        // or decide to just return the old credentials and let the API calls fail later
      }
    } else {
       console.log('Existing access token is still valid.');
    }
    // Return the original (or potentially refreshed) credentials set on the client
    return oauth2Client.credentials;

  } else if (accessToken && !refreshToken) {
     console.warn('Access token found in environment, but no refresh token. Automatic refresh disabled.');
     // Return partial credentials, hoping the access token is still valid
     return {
      access_token: accessToken,
      refresh_token: null,
      expiry_date: expiryDateEnv ? parseInt(expiryDateEnv) : null,
      token_type: 'Bearer'
    };

  } else {
    // No access token found, initiate interactive login
    console.log('No ACCESS_TOKEN found. Starting OAuth2 authentication via Express server...');
    const expressAuthService = new ExpressAuthService(clientId, clientSecret, redirectUri);
    try {
      const tokens = await expressAuthService.authenticate();
      console.log('Authentication successful. Received new tokens:');
      // Ensure we have a refresh token if possible for future runs
      if (!tokens.refresh_token) {
          console.warn('Warning: Did not receive a refresh token during authentication. Automatic refresh will not be possible on subsequent runs.');
      }
      console.warn('ACTION NEEDED: Please save the following tokens (especially refresh_token) to your .env file for future runs:');
      console.log('Tokens:', tokens);
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
  const CONCURRENCY = 10; // Max number of parallel downloads

  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID and CLIENT_SECRET must be set in environment variables.');
    process.exit(1);
  }

  // --- Phase 1: Authentication & Listing --- 
  const tokens = await getTokens(clientId, clientSecret, redirectUri);
  if (!tokens.access_token) {
    console.error('Failed to obtain access token.');
    process.exit(1);
  }

  const googlePhotosService = new GooglePhotosService(tokens.access_token);
  const downloadService = new DownloadService();

  console.log('Phase 1a: Fetching media items list from Google Photos...');
  const mediaItems = await googlePhotosService.listAllMediaItems();
  console.log(`Phase 1a Complete: Fetched ${mediaItems.length} total media items.`);

  console.log('\nPhase 1b: Fetching album list from Google Photos...');
  const albums = await googlePhotosService.listAllAlbums();
  console.log(`Phase 1b Complete: Fetched ${albums.length} total albums.`);

  // Define file paths
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const imageListFile = path.join(downloadsDir, 'imagelist.json');
  const albumListFile = path.join(downloadsDir, 'albums.json');
  const photoToAlbumMapFile = path.join(downloadsDir, 'phototoalbum.json');
  const downloadMappingFile = path.join(downloadsDir, 'downloaded.json');
  const failedDownloadsFile = path.join(downloadsDir, 'failed_downloads.json');

  // Ensure downloads directory exists
  try {
    await fs.mkdir(downloadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating downloads directory:', err);
  }

  // Save the full list of items found
  try {
    await fs.writeFile(imageListFile, JSON.stringify(mediaItems, null, 2));
    console.log(`Full media item list saved to ${imageListFile}`);
  } catch (err) {
    console.error(`Error saving image list to ${imageListFile}:`, err);
  }

  // Save the full list of albums found
  try {
    await fs.writeFile(albumListFile, JSON.stringify(albums, null, 2));
    console.log(`Full album list saved to ${albumListFile}`);
  } catch (err) {
    console.error(`Error saving album list to ${albumListFile}:`, err);
  }

  // --- Phase 1c: Build Photo-to-Album Mapping --- 
  console.log('\nPhase 1c: Building photo-to-album mapping...');
  const photoToAlbumMap: Record<string, string[]> = {}; // Map<photoId, albumTitle[]> 

  for (const album of albums) {
    if (!album.id || !album.title) {
      console.warn('Skipping album due to missing ID or Title:', album);
      continue;
    }
    try {
      const albumPhotos = await googlePhotosService.getAlbumContents(album.id);
      for (const photo of albumPhotos) {
        if (photo.id) {
          if (!photoToAlbumMap[photo.id]) {
            photoToAlbumMap[photo.id] = [];
          }
          // Avoid duplicate album titles if a photo somehow appears twice in API result for album
          if (!photoToAlbumMap[photo.id].includes(album.title)) {
             photoToAlbumMap[photo.id].push(album.title);
          }
        }
      }
      console.log(`Processed album "${album.title}" (${album.id}) - Found ${albumPhotos.length} photos.`);
    } catch (error) {
       console.error(`Failed to process contents for album "${album.title}" (${album.id}):`, error);
       // Decide if we should stop or continue to next album
    }
  }

  // Save the photo-to-album mapping
  try {
    await fs.writeFile(photoToAlbumMapFile, JSON.stringify(photoToAlbumMap, null, 2));
    console.log(`Photo-to-album mapping saved to ${photoToAlbumMapFile}`);
  } catch (err) {
    console.error(`Error saving photo-to-album map to ${photoToAlbumMapFile}:`, err);
  }

  console.log('Phase 1c Complete: Finished building photo-to-album map.');

  // --- Phase 2: Parallel Downloading --- 
  console.log('\nPhase 2: Starting parallel download process...');

  let downloadedMapping: Record<string, any> = {};
  let failedDownloads: any[] = []; // Track failures specifically from this run

  // Load existing download mapping
  try {
    const mappingData = await fs.readFile(downloadMappingFile, 'utf8');
    downloadedMapping = JSON.parse(mappingData);
    console.log(`Loaded ${Object.keys(downloadedMapping).length} entries from existing download mapping.`);
  } catch (err) {
    console.log('Existing download mapping file not found or could not be read. Starting fresh.');
    downloadedMapping = {};
  }

  // Filter items that need downloading
  const itemsToDownload = mediaItems.filter(item => item && item.id && !downloadedMapping[item.id]);
  const totalToDownload = itemsToDownload.length;
  console.log(`Found ${totalToDownload} items requiring download.`);

  if (totalToDownload === 0) {
    console.log('No new items to download. Process complete.');
    return;
  }

  // Setup concurrency limiter
  const limit = pLimit(CONCURRENCY);
  let processedCount = 0;

  // Create an array of download tasks (promises)
  const downloadTasks = itemsToDownload.map((item) =>
    limit(async () => {
      const imageId = item.id;
      if (!item.baseUrl || !item.filename) {
        console.warn(`Skipping item ${imageId || '(no id)'} in download phase due to missing baseUrl or filename.`);
        failedDownloads.push({ id: imageId, filename: item.filename, error: 'Missing baseUrl or filename' });
        return; // Skip this item
      }

      const downloadUrl = `${item.baseUrl}=d`;
      const destination = path.join(downloadsDir, item.filename);

      try {
        await downloadService.downloadFile(downloadUrl, destination);
        // Update mapping immediately after successful download
        downloadedMapping[imageId] = {
          filename: item.filename,
          downloadUrl,
          downloadTimestamp: new Date().toISOString(),
          metadata: item, // Store the whole item for now
          // Optionally add album info here if needed, though the separate map exists
          // albums: photoToAlbumMap[imageId] || [] 
        };
        await fs.writeFile(downloadMappingFile, JSON.stringify(downloadedMapping, null, 2));
      } catch (error: any) {
        console.error(`Failed download: "${item.filename}" (${imageId}): ${error.message}`);
        failedDownloads.push({
          id: imageId,
          filename: item.filename,
          downloadUrl,
          error: error.message,
          metadata: item
        });
      } finally {
        processedCount++;
        const percentage = ((processedCount / totalToDownload) * 100).toFixed(2);
        if (processedCount % 10 === 0 || processedCount === totalToDownload) {
             console.log(`Download progress: ${processedCount}/${totalToDownload} (${percentage}%)`);
        }
      }
    })
  );

  await Promise.allSettled(downloadTasks);
  console.log('\nParallel download phase complete.');

  if (failedDownloads.length > 0) {
    try {
      await fs.writeFile(failedDownloadsFile, JSON.stringify(failedDownloads, null, 2));
      console.log(`${failedDownloads.length} downloads failed during this run. See ${failedDownloadsFile} for details.`);
    } catch (err) {
       console.error(`Error writing failed downloads log to ${failedDownloadsFile}:`, err);
    }
  } else {
    console.log('All attempted downloads completed without logged errors.');
  }

  console.log('Process finished.');
}

main().catch(err => console.error('Unhandled error in main:', err));
