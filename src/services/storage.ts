import fs from 'fs/promises';
import { ConfigService } from './config';
import path from 'path';

export type StorageServiceDependencies = {
  configService: ConfigService;
};

export class StorageService {
  constructor(private readonly dependencies: StorageServiceDependencies, private readonly basePath: string) {}

  private getPath(filename: string) {
    return path.join(this.basePath, filename);
  }

  async saveFile(filename: string, buffer: Buffer | string) {
    const filePath = this.getPath(filename);

    // Make sure the directories exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, buffer);
  }

  async readFile(filename: string) {
    const filePath = this.getPath(filename);
    return fs.readFile(filePath, 'utf8');
  }

  async readJsonFile<T>(filename: string): Promise<T | null> {
    const filePath = this.getPath(filename);

    // Check if the file exists (it doesnt have to if this is the first run)
    try {
      await fs.access(filePath);
    } catch (error) {
      return null;
    }

    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  }
}

