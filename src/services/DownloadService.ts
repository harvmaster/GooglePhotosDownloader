import * as fs from 'fs/promises';

/**
 * Service to download images and save metadata using Node's built-in fetch.
 * @class DownloadService
 */
export class DownloadService {
  /**
   * Downloads a file from the given URL and saves it to the destination path.
   * @param {string} url - URL of the file to download.
   * @param {string} destination - File system path where the downloaded file will be saved.
   * @returns {Promise<void>}
   */
  public async downloadFile(url: string, destination: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file. Status: ${response.status} - ${response.statusText}`);
    }
    // Convert the response to a buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destination, buffer);
  }

  /**
   * Saves metadata to a JSON file at the specified destination.
   * @param {any} metadata - The metadata to be saved.
   * @param {string} destination - File system path for the JSON file.
   * @returns {Promise<void>}
   */
  public async saveMetadata(metadata: any, destination: string): Promise<void> {
    await fs.writeFile(destination, JSON.stringify(metadata, null, 2));
  }
} 