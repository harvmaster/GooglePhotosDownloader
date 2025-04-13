# Google Photos Downloader Project - Detailed Plan

## Overview
This project is a Node.js application written in TypeScript that downloads all photos from Google Photos to help clean up Google Drive storage space. The program downloads the original quality images along with all available metadata, including a separate list of all albums. It also creates a mapping to link photos to the albums they belong to.

## Requirements
- **Speed:** Use parallel downloads for efficiency.
- **Full Data Download:** All metadata available from the list APIs and a separate list of all albums should be preserved.
- **Original Quality:** Download photos in their original quality.
- **Graceful Error Handling:** Photo download failures should be logged and the program should continue. API call timeouts should be retried.
- **Resumability:** Prevent re-downloading files already obtained in previous runs using a mapping file.
- **Progress Indication:** Show percentage progress during the download phase.

## Design Considerations
- **Dependency Injection:**
  - Use dependency injection principles where applicable (though services are currently instantiated directly in `main`).

- **TypeScript Best Practices:**
  - Use classes, single responsibility principle, clean code, comments, JSDoc.

- **Google Photos API Integration (`googlephotos` library):**
  - Utilize OAuth2 for authentication, handled by `ExpressAuthService` for interactive login or using environment variables. **The `getTokens` function in `index.ts` now attempts automatic token refresh using `google-auth-library` if a refresh token is available.**
  - Create a `GooglePhotosService` using the `googlephotos` library, initialized with a valid access token.
  - Implement methods to list all media items, list all albums, and search within albums with pagination and retry logic.

- **Downloading Files:**
  - Use Node's built-in fetch within `DownloadService`.
  - Implement parallel downloads in `src/index.ts` using `p-limit` and `Promise.allSettled`.
  - Log percentage progress during the download phase.
  - Maintain a JSON log (`failed_downloads.json`) of download failures for the current run.
  - Maintain a JSON mapping file (`downloaded.json`) of successfully downloaded images to prevent re-downloading.

- **Handling Metadata & Albums:**
  - Fetch and save the complete list of media items to `imagelist.json` before starting downloads.
  - Fetch and save the complete list of albums to `albums.json`.
  - **Post-process albums:** Iterate through the album list, call the album search method for each, and build a photoId-to-albumTitle map.
  - **Save the mapping:** Store the generated photo-to-album map in `phototoalbum.json`.
  - Individual photo metadata is saved within `downloaded.json` upon successful download.
  - **Facial Recognition Data:**
    - Google Photos API does not provide direct access to this data.

## Project Structure
- `src/index.ts`: Entry point. Handles auth, calls listing methods, saves lists (`imagelist.json`, `albums.json`), performs post-processing to build and save the photo-to-album map (`phototoalbum.json`), orchestrates parallel downloads, updates mapping/failure logs (`downloaded.json`, `failed_downloads.json`).
- `src/services/GooglePhotosService.ts`: Service using `googlephotos` library for API interactions (list media, list albums, search album contents).
- `src/services/DownloadService.ts`: Service for downloading files using Node fetch.
- `src/services/ExpressAuthService.ts`: Service for interactive OAuth2 web flow.
- `downloads/`: Directory for output:
  - Images
  - `imagelist.json`: List of all media items found.
  - `albums.json`: List of all albums found.
  - `phototoalbum.json`: Map linking photo IDs to album titles.
  - `downloaded.json`: Mapping of successfully downloaded items.
  - `failed_downloads.json`: Log of download failures for the last run.
- `plan.md`: This detailed planning document.
- `README.md`: Setup and usage instructions.

## Workflow
1. **Setup & Configuration:**
   - Initialize project, install dependencies (`googlephotos`, `express`, `google-auth-library`, `p-limit`, `dotenv`).
   - Set up OAuth2 credentials in `.env`.

2. **Authentication:**
   - `src/index.ts` calls `getTokens`.
   - `getTokens` checks for environment variables (`ACCESS_TOKEN`, `REFRESH_TOKEN`).
   - If tokens exist, it uses `google-auth-library` to check expiry and attempt refresh via `oauth2Client.refreshAccessToken()` if necessary.
   - If no access token exists, uses `ExpressAuthService` for interactive login.
   - Returns valid `Credentials` (potentially refreshed).

3. **Listing Phase:**
   - `GooglePhotosService.listAllMediaItems()` is called to get all media items.
   - `GooglePhotosService.listAllAlbums()` is called to get all albums.
   - Results are saved to `imagelist.json` and `albums.json`.

4. **Album Content Processing Phase:**
   - Iterate through the `albums` list.
   - For each album ID, call `GooglePhotosService.getAlbumContents()`.
   - Build the `photoToAlbumMap` in memory.
   - Save the completed map to `phototoalbum.json`.

5. **Download Phase:**
   - Load `downloaded.json`.
   - Filter `imagelist.json` against `downloaded.json` to find items needing download.
   - Use `p-limit` and `Promise.allSettled` to download these items in parallel.
   - Log percentage progress.
   - Update `downloaded.json` on success.
   - Collect failures in memory.

6. **Finalization:**
   - Save collected download failures to `failed_downloads.json`.
   - Log completion message.

## Additional Considerations
- Implement automatic token refresh using `REFRESH_TOKEN`. **(DONE)**
- Add unit tests (Vitest).
- Make concurrency configurable.
- Consider more robust error handling (e.g., different retry strategies for different errors).
- Remove unused `AuthService.ts` if confirmed obsolete.

## Conclusion
This plan incorporates fetching album lists alongside media items, saving these lists, and performing parallel downloads with progress indication, building upon the previous structure. It now includes fetching album contents post-listing to create a direct mapping file (`phototoalbum.json`) linking photos to their respective albums, enhancing the metadata collected. 