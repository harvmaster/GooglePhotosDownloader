import 'dotenv/config';

import { ConfigService } from './services/config';
import { Indexer, IndexerError } from './services/indexer';
import { Queue } from './utils/queue';
import { ParallelProcessor } from './utils/parellel-processor';
import { DownloaderService } from './services/downloader';
import { AuthService } from './services/auth';

import { StorageService } from './services/file-storage';
import { DocumentStorageService } from './services/document-storage';

import type { MediaItem } from './types';

type DownloadedItem = MediaItem & { downloaded: number };
let items: Array<DownloadedItem> = [];

const run = async () => {
  const config = ConfigService.from(process.env);

  const documentStorageService = DocumentStorageService.create<{
    errors: IndexerError;
    media_items: DownloadedItem;
  }>({
    configService: config,
  });

  // Create the media_items table
  await documentStorageService.createTable('media_items')
    .ifNotExists()
    .addColumn('description', 'text')
    .addColumn('productUrl', 'text')
    .addColumn('baseUrl', 'text')
    .addColumn('mimeType', 'text')
    .addColumn('mediaMetadata', 'json')
    .addColumn('contributorInfo', 'json')
    .addColumn('filename', 'text')
    .addColumn('downloaded', 'bigint')
    .execute()

  await documentStorageService.createTable('errors')
    .ifNotExists()
    .addColumn('error', 'text')
    .addColumn('pageCount', 'integer')
    .addColumn('nextPageToken', 'text')
    .execute()

  const fileStorage = new StorageService({
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
    documentStorageService: documentStorageService,
    downloadQueue,
    processor,
  });

  let downloadedItems = 0;
  let downloadErrors = [];

  // Handle the item-added event
  downloadQueue.on('item-added', async (item) => {
    // Save the item into the an object storage, that way we can update it once its downloaded to mark it as completed
    const downloadItem: DownloadedItem = { ...item.item, downloaded: 0 };
    
    // Prepare the data for SQLite storage by extracting only the fields we need
    const dbItem = {
      id: downloadItem.id,
      description: downloadItem.description || '',
      productUrl: downloadItem.productUrl || '',
      baseUrl: downloadItem.baseUrl || '',
      mimeType: downloadItem.mimeType || '',
      filename: downloadItem.filename || '',
      downloaded: downloadItem.downloaded ? Date.now() : 0,
      mediaMetadata: JSON.stringify(downloadItem.mediaMetadata),
      contributorInfo: JSON.stringify(downloadItem.contributorInfo)
    };

    await documentStorageService.save('media_items', dbItem);

    try {
      const result = await downloader.download(item.item);

      if (result) {
        // Update the downloaded items count
        downloadedItems++;
        console.log(`Downloaded ${item.item.filename} (${downloadedItems}/${downloadQueue.getTotalItems()})`);

        // Mark the item as downloaded
        downloadItem.downloaded = Date.now();

        // Save the item with fs
        await fileStorage.save(item.item.filename, result);
        await documentStorageService.update('media_items', item.item.id, { downloaded: Date.now() });
      } else {
        console.error(`Failed to download ${item.item.filename}`);
      }
    } catch (err) {
      downloadErrors.push(err.message)
      fileStorage.save('errors.json', JSON.stringify(downloadErrors, null, 2))
    }
  });

  const metadata = await documentStorageService.findAll('media_items');
  if (metadata) {
    items = metadata.map(item => ({
      ...item,
      mediaMetadata: JSON.parse(item.mediaMetadata as unknown as string),
      contributorInfo: JSON.parse(item.contributorInfo as unknown as string)
    }));

    // no downloaded items
    downloadQueue.addFilter((item) => {
      return items.some((metadataItem) => metadataItem.id === item.id && metadataItem.downloaded > 0);
    });

    // no duplicates
    // downloadQueue.addFilter((item) => {
    //   return downloadQueue.getItems().some((i) => i.item.id === item.id);
    // });

    // items.forEach((item) => {
    //   if (item.downloaded > 0)
    //   downloadQueue.addItem(item);
    // });
  }

  await indexer.scanLibrary();
}

run();
