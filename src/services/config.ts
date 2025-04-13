type Config = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  ACCESS_TOKEN?: string;
  REFRESH_TOKEN?: string;

  STORAGE_PATH: string;
};

export class ConfigService {
  public config: Config = {
    CLIENT_ID: '',
    CLIENT_SECRET: '',
    REDIRECT_URI: '',
    STORAGE_PATH: 'metadata.db',
  };

  constructor(config: Config) {
    this.config = config;
  }

  public static from(config: any) {
    // Required config
    if (!config.CLIENT_ID) {
      throw new Error('CLIENT_ID is not set');
    }

    if (!config.CLIENT_SECRET) {
      throw new Error('CLIENT_SECRET is not set');
    }

    if (!config.REDIRECT_URI) {
      throw new Error('REDIRECT_URI is not set');
    }

    return new ConfigService({
      // Required config
      CLIENT_ID: config.CLIENT_ID,
      CLIENT_SECRET: config.CLIENT_SECRET,
      REDIRECT_URI: config.REDIRECT_URI,
      // Optional tokens
      ACCESS_TOKEN: config.ACCESS_TOKEN,
      REFRESH_TOKEN: config.REFRESH_TOKEN,
      STORAGE_PATH: config.STORAGE_PATH || 'metadata.db',
    });
  }
}