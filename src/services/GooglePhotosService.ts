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
} 