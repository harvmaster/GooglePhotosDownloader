import type { MediaItem, MediaItemsResponse } from '../types';

import type { AuthService } from './auth';
import type { ConfigService } from './config';
import type { Queue } from '../utils/queue';
import type { ParallelProcessor } from '../utils/parellel-processor';

import { ExponentialBackoffRetry } from '../utils/exponential-backoff';

import debug, { Debug } from 'debug';
import Photos from 'googlephotos';

export type IndexerDependencies = {
  authService: AuthService;
  configService: ConfigService;
  downloadQueue: Queue<MediaItem>;
  processor: ParallelProcessor;
};

export class Indexer {
  private photos: Photos;
  private logger: Debug;

  constructor(private readonly dependencies: IndexerDependencies) {
    this.logger = debug('indexer');

    if (!this.dependencies.configService.config.ACCESS_TOKEN) {
      this.logger('No access token found');
      throw new Error('No access token found');
    }

    this.logger(`Creating photos instance with access token: ${this.dependencies.configService.config.ACCESS_TOKEN}`);

    // Create the photos instance
    this.photos = new Photos(this.dependencies.configService.config.ACCESS_TOKEN)

    this.logger('Photos instance created');
  }

  /**
   * Scan through the user's library, getting the media items and adding them to the queue
   */
  async scanLibrary() {
    this.logger('Scanning library');

    // Create the exponential backoff retry
    const exponentialBackoff = new ExponentialBackoffRetry({
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    });

    // Define the variables
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;

    // Scan through the library
    do {
      // Define the request function
      const fetchItems = async () => {
        this.logger(`Fetching page ${pageCount + 1}`);

        const response: MediaItemsResponse = await this.photos.mediaItems.list(100, nextPageToken);
        nextPageToken = response.nextPageToken;
        return response;
      }

      // Execute the request with exponential backoff
      const request = () => exponentialBackoff.execute(fetchItems);

      // Add this to the queue with priority 0 (highest priority)
      const result = await this.dependencies.processor.process(request, 0);

      // Add items to the queue
      result.mediaItems.forEach(item => {
        this.dependencies.downloadQueue.addItem(item);
      });

      // Update the next page token
      nextPageToken = result.nextPageToken;
      pageCount++;
    } while(nextPageToken);

    this.logger(`Scanned ${pageCount} pages`);
  }
}