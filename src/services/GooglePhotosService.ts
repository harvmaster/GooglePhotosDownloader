import Photos from 'googlephotos';

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Service to interact with the Google Photos API using the 'googlephotos' library.
 * @class GooglePhotosService
 */
export class GooglePhotosService {
  private photos: Photos;
  private maxRetries = 3; // Maximum number of retries for API calls
  private initialRetryDelay = 1000; // Initial delay in ms

  /**
   * Creates an instance of GooglePhotosService using an access token.
   * @param {string} accessToken - The Google OAuth2 access token.
   */
  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Access token is required to initialize GooglePhotosService.');
    }
    // Initialize the 'googlephotos' library client
    this.photos = new Photos(accessToken);
  }

  /**
   * Lists all media items from Google Photos, logging progress and implementing retries.
   * @returns {Promise<any[]>} - Array of media items.
   */
  public async listAllMediaItems(): Promise<any[]> {
    console.log("Starting to fetch media items...");
    const mediaItems: any[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;
    do {
      pageCount++;
      let retries = 0;
      let success = false;
      let response: any;

      while (retries < this.maxRetries && !success) {
        try {
          // Assuming pageSize is first arg, pageToken is second for googlephotos.mediaItems.list
          response = await this.photos.mediaItems.list(100, nextPageToken);
          success = true; // Mark as success if the call completes without error

        } catch (error: any) {
          retries++;
          const isTimeout = error.name === 'TimeoutError';
          console.error(`Error fetching page ${pageCount} (Attempt ${retries}/${this.maxRetries}):`, error.message);

          if (retries >= this.maxRetries || !isTimeout) {
            // If max retries reached or it's not a timeout error, re-throw
            console.error(`Failed to fetch page ${pageCount} after ${this.maxRetries} attempts.`);
            throw error;
          }

          // Calculate delay with exponential backoff
          const delay = this.initialRetryDelay * Math.pow(2, retries - 1);
          console.log(`Retrying page ${pageCount} in ${delay}ms...`);
          await sleep(delay);
        }
      }

      // Process the successful response
      if (success && response) {
        const fetchedCount = response.mediaItems ? response.mediaItems.length : 0;
        if (fetchedCount > 0) {
          mediaItems.push(...response.mediaItems);
          console.log(`Fetched page ${pageCount}. Total items retrieved so far: ${mediaItems.length}`);
        }
        nextPageToken = response.nextPageToken;
      } else if (!success) {
        // Should not happen if errors are thrown correctly, but as a safeguard
        console.error(`Failed to get response for page ${pageCount} after retries.`);
        break; // Exit the loop if we somehow failed to get a response
      }

    } while (nextPageToken);

    console.log(`Finished fetching. Total media items found: ${mediaItems.length}`);
    return mediaItems;
  }

  /**
   * Lists all albums from Google Photos, logging progress and implementing retries.
   * @returns {Promise<any[]>} - Array of album objects.
   */
  public async listAllAlbums(): Promise<any[]> {
    console.log("Starting to fetch albums...");
    const albums: any[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;
    const pageSize = 50; // Max page size for albums is 50

    do {
      pageCount++;
      let retries = 0;
      let success = false;
      let response: any;

      while (retries < this.maxRetries && !success) {
        try {
          // Assuming pageSize is first arg, pageToken is second for googlephotos.albums.list
          response = await this.photos.albums.list(pageSize, nextPageToken);
          success = true;
        } catch (error: any) {
          retries++;
          const isTimeout = error.name === 'TimeoutError';
          console.error(`Error fetching albums page ${pageCount} (Attempt ${retries}/${this.maxRetries}):`, error.message);
          if (retries >= this.maxRetries || !isTimeout) {
            console.error(`Failed to fetch albums page ${pageCount} after ${this.maxRetries} attempts.`);
            throw error;
          }
          const delay = this.initialRetryDelay * Math.pow(2, retries - 1);
          console.log(`Retrying albums page ${pageCount} in ${delay}ms...`);
          await sleep(delay);
        }
      }

      if (success && response) {
        const fetchedCount = response.albums ? response.albums.length : 0;
        if (fetchedCount > 0) {
          albums.push(...response.albums);
          console.log(`Fetched albums page ${pageCount}. Total albums retrieved so far: ${albums.length}`);
        }
        nextPageToken = response.nextPageToken;
      } else if (!success) {
        console.error(`Failed to get response for albums page ${pageCount} after retries.`);
        break;
      }
    } while (nextPageToken);

    console.log(`Finished fetching. Total albums found: ${albums.length}`);
    return albums;
  }

  /**
   * Fetches all media items within a specific album using mediaItems.search.
   * Includes pagination and retry logic.
   * @param {string} albumId - The ID of the album.
   * @returns {Promise<any[]>} - Array of media item objects belonging to the album.
   */
  public async getAlbumContents(albumId: string): Promise<any[]> {
    console.log(`Fetching contents for album ID: ${albumId}...`);
    const mediaItems: any[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;
    const pageSize = 100; // Max page size for search is 100

    do {
      pageCount++;
      let retries = 0;
      let success = false;
      let response: any;

      while (retries < this.maxRetries && !success) {
        try {
          // Use mediaItems.search with albumId
          response = await this.photos.mediaItems.search(albumId, pageSize, nextPageToken);
          success = true;
        } catch (error: any) {
          retries++;
          const isTimeout = error.name === 'TimeoutError';
          console.error(`Error searching album ${albumId} page ${pageCount} (Attempt ${retries}/${this.maxRetries}):`, error.message);
          if (retries >= this.maxRetries || !isTimeout) {
            console.error(`Failed to search album ${albumId} page ${pageCount} after ${this.maxRetries} attempts.`);
            throw error;
          }
          const delay = this.initialRetryDelay * Math.pow(2, retries - 1);
          console.log(`Retrying search for album ${albumId} page ${pageCount} in ${delay}ms...`);
          await sleep(delay);
        }
      }

      if (success && response) {
        const fetchedCount = response.mediaItems ? response.mediaItems.length : 0;
        if (fetchedCount > 0) {
          mediaItems.push(...response.mediaItems);
          // Optional: Add progress log for album content fetching if needed
          // console.log(`Fetched items page ${pageCount} for album ${albumId}. Total for album so far: ${mediaItems.length}`);
        }
        nextPageToken = response.nextPageToken;
      } else if (!success) {
        console.error(`Failed to get response for album ${albumId} page ${pageCount} after retries.`);
        break;
      }
    } while (nextPageToken);

    console.log(`Finished fetching contents for album ID: ${albumId}. Found ${mediaItems.length} items.`);
    return mediaItems;
  }
} 