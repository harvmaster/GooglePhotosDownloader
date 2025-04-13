import type { MediaItem } from '../types';

import type { AuthService } from './auth';
import type { ConfigService } from './config';
import type { Queue } from '../utils/queue';
import type { ParallelProcessor } from '../utils/parellel-processor';

import debug, { Debug } from 'debug';
import { ExponentialBackoffRetry } from '../utils/exponential-backoff';

export type DownloaderDependencies = {
  authService: AuthService;
  configService: ConfigService;
  downloadQueue: Queue<MediaItem>;
  processor: ParallelProcessor;
};

export class DownloaderService {
  private logger: Debug;
  private exponentialBackoff: ExponentialBackoffRetry;

  constructor(private readonly dependencies: DownloaderDependencies) {
    this.logger = debug('downloader');
    this.exponentialBackoff = new ExponentialBackoffRetry({
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    });
  }

  async download(item: MediaItem) {
    const fetchFile = async () => {
      this.logger(`Downloading ${item.filename}`);

      let url: string;

      if ('video' in item.mediaMetadata) {
        url = `${item.baseUrl}=dv`;
      } else {
        url = `${item.baseUrl}=d`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file. Status: ${response.status} - ${response.statusText}`);
      }

      this.logger(`Downloaded ${item.filename}`);

      // Convert the response to a buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    };

    // Create the exponential backoff request
    const request = () => this.exponentialBackoff.execute(fetchFile);

    // Process the request in parallel with priority 1 (medium priority)
    const result = await this.dependencies.processor.process(request, 1);

    return result;
  }
}
