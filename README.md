# Google Photos Downloader

A Node.js application written in TypeScript that downloads all photos from Google Photos in original quality along with full metadata.

## Overview
This tool allows you to download your Google Photos along with metadata such as albums. It uses dependency injection, clean TypeScript design practices, and re-run capability to avoid downloading duplicate files by referencing a JSON mapping file. It fetches the full list of media items and albums first, saves them for reference, processes album contents to create a photo-to-album link map, and then downloads new items in parallel.

## Requirements
- Node.js (v18 or higher recommended for built-in fetch support).
- A Google Cloud project with the Google Photos API enabled.
- OAuth2 credentials (CLIENT_ID, CLIENT_SECRET, potentially ACCESS_TOKEN, REFRESH_TOKEN).

## Setup Instructions

1. **Clone the Repository**

   ```bash
   git clone git@github.com:harvmaster/GooglePhotosDownloader.git
   cd GooglePhotosDownloader
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
   ACCESS_TOKEN=your-access-token          # Optional: If present, skips interactive login
   REFRESH_TOKEN=your-refresh-token        # Optional but RECOMMENDED for automatic token refresh
   EXPIRY_DATE=your-expiry-date-as-timestamp # Optional: Helps determine if refresh is needed
   REDIRECT_URI=http://localhost:3000/oauth2callback # Or your configured redirect URI
   ```
   *Note: If `ACCESS_TOKEN` is not provided, the script will start a web server on port 3000 (or as configured by `REDIRECT_URI`) to handle the OAuth2 login flow. If `ACCESS_TOKEN` and `REFRESH_TOKEN` are provided, the script will attempt to automatically refresh the access token if it's expired.* 

4. **Run the Application**

   ```bash
   npm start
   ```

   The application will:
   - Authenticate (interactively if needed, **attempting automatic refresh if tokens are present and expired**).
   - Fetch all media items and save the list to `downloads/imagelist.json`.
   - Fetch all albums and save the list to `downloads/albums.json`.
   - Process each album to determine which photos belong to it.
   - Save a mapping of photo IDs to album titles in `downloads/phototoalbum.json`.
   - Load existing downloaded items from `downloads/downloaded.json`.
   - Download any new items in parallel (up to 10 concurrently by default) into the `downloads/` directory.
   - Update `downloads/downloaded.json` after each successful download.
   - Log any download failures to `downloads/failed_downloads.json`.
   - Display percentage progress during the download phase.

## Project Structure

- `src/index.ts`: Application entry point. Handles auth, listing, saving lists, post-processing album contents, and orchestrates parallel downloads.
- `src/services/GooglePhotosService.ts`: Service interacting with the Google Photos API (using `googlephotos` library) for listing media items, albums, and searching within albums.
- `src/services/DownloadService.ts`: Service for downloading files using Node's built-in fetch.
- `src/services/ExpressAuthService.ts`: Service to handle interactive OAuth2 login via a temporary web server.
- `downloads/`: Directory for storing:
  - Downloaded images.
  - `imagelist.json`: Full list of all media items found in Google Photos.
  - `albums.json`: Full list of all albums found.
  - `phototoalbum.json`: Mapping of photo IDs to the titles of albums they belong to.
  - `downloaded.json`: Mapping of successfully downloaded item IDs and their metadata.
  - `failed_downloads.json`: Log of items that failed to download during the last run.
- `plan.md`: Detailed project plan and design considerations.

## Testing

This project uses Vitest for unit testing (tests not yet implemented).

Run tests with:

```bash
npm test
```

## Notes

- The application is designed to run on bare-metal (no Docker required).
- Facial recognition data is not available via the API.
- Automatic token refresh using `REFRESH_TOKEN` is **implemented**. If refresh occurs, you will be prompted to update your `.env` file.
- Consider adjusting the `CONCURRENCY` constant in `src/index.ts` based on your network capacity.

## License

MIT License 