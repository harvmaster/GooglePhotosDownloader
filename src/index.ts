import 'dotenv/config';

import { ConfigService } from './services/config';
import { Indexer } from './services/indexer';
import { Queue } from './utils/queue';
import { ParallelProcessor } from './utils/parellel-processor';
import { DownloaderService } from './services/downloader';
import { AuthService } from './services/auth';
import { StorageService } from './services/storage';

import type { MediaItem } from './types';
type DownloadedItem = MediaItem & { downloaded: boolean };
let items: Array<DownloadedItem> = [];

const run = async () => {
  const config = ConfigService.from(process.env);
  const storage = new StorageService({
    configService: config,
  }, `${process.cwd()}/downloads`);

  const authService = await AuthService.create({ configService: config });

  await authService.waitFor('authed', (payload) => {
    console.log('Authed', payload);
    return true;
  }, 300000);

  const downloadQueue = new Queue<MediaItem>();
  const processor = new ParallelProcessor();

  const downloader = new DownloaderService({
    configService: config,
    authService: authService,
    downloadQueue: downloadQueue,
    processor,
  });

  const indexer = new Indexer({
    configService: config,
    authService: authService,
    downloadQueue,
    processor,
  });

  const metadataFilePath = `metadata.json`;

  let downloadedItems = 0;

  // Handle the item-added event
  downloadQueue.on('item-added', async (item) => {
    // Save the item into the an object storage, that way we can update it once its downloaded to mark it as completed
    const downloadItem: DownloadedItem = { ...item.item, downloaded: false };
    items.push(downloadItem);

    const result = await downloader.download(item.item);

    if (result) {
      // Update the downloaded items count
      downloadedItems++;
      console.log(`Downloaded ${item.item.filename} (${downloadedItems}/${downloadQueue.getTotalItems()})`);

      // Mark the item as downloaded
      downloadItem.downloaded = true;

      // Save the item with fs
      await storage.saveFile(item.item.filename, result);
      await storage.saveFile(metadataFilePath, JSON.stringify(items, null, 2));
    } else {
      console.error(`Failed to download ${item.item.filename}`);
    }
  });

  const metadata = await storage.readJsonFile<Array<DownloadedItem>>('metadata.json');
  if (metadata) {
    items = metadata;

    downloadQueue.addFilter((item) => {
      return items.some((metadataItem) => metadataItem.id === item.id && metadataItem.downloaded);
    });

    items.forEach((item) => {
      downloadQueue.addItem(item);
    });
  }

  await indexer.scanLibrary();
}

run();
