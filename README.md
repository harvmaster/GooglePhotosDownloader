# Google Photos Downloader

A Node.js application written in TypeScript that downloads all photos from Google Photos in original quality along with full metadata.

## Overview
This tool allows you to download your Google Photos along with metadata such as albums. It uses dependency injection, clean TypeScript design practices, and re-run capability to avoid downloading duplicate files by referencing a JSON mapping file.

## Requirements
- Node.js (v18 or higher recommended for built-in fetch support).
- A Google Cloud project with the Google Photos API enabled.
- OAuth2 credentials (CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN, etc.).

## Setup Instructions

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd google-photos-downloader
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the project root (or set environment variables in your shell) with the following:

   ```env
   CLIENT_ID=your-client-id
   CLIENT_SECRET=your-client-secret
   ACCESS_TOKEN=your-access-token
   REFRESH_TOKEN=your-refresh-token   # optional
   EXPIRY_DATE=your-expiry-date-as-timestamp   # optional
   ```

4. **Run the Application**

   ```bash
   npm start
   ```

   The application will fetch media items from Google Photos, download new items to the `downloads/` directory, and log metadata. It uses a JSON mapping file (`downloads/downloaded.json`) to avoid re-downloading files, and any failed downloads are recorded in `downloads/failed_downloads.json`.

## Project Structure

- `src/index.ts`: Application entry point. Sets up services and orchestrates the download process.
- `src/services/GooglePhotosService.ts`: Service for interacting with the Google Photos API (handles OAuth2 authentication and listing media items).
- `src/services/DownloadService.ts`: Service for downloading files using Node's built-in fetch and saving metadata.
- `downloads/`: Directory for storing downloaded images and metadata files.
- `plan.md`: Detailed project plan and design considerations.

## Testing

This project uses Vitest for unit testing.

Run tests with:

```bash
npm test
```

## Notes

- The application is designed to run on bare-metal (no Docker required).
- If additional processing is needed (e.g., facial recognition data extraction), consider integrating additional libraries or cloud APIs.
- For full OAuth2 flow, further modifications may be necessary beyond this basic setup.

## License

MIT License 