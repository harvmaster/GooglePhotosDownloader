# Google Photos Downloader Project - Detailed Plan

## Overview
This project is a Node.js application written in TypeScript that downloads all photos from Google Photos to help clean up Google Drive storage space. The program downloads the original quality images along with all available metadata.

## Requirements
- **Speed:** The process should be reasonably fast.
- **Full Data Download:** All metadata, including albums, should be preserved.
- **Original Quality:** Download photos in their original quality.
- **Graceful Error Handling:** Photo download failures should be logged and the program should continue with the next download. A JSON log of failed downloads will be maintained for reattempts.
- **Minimal External Dependencies:** Use Node's built-in fetch instead of axios.

## Design Considerations
- **Dependency Injection:**
  - Use dependency injection to decouple services (e.g., injecting GooglePhotosService and DownloadService into the main application).

- **TypeScript Best Practices:**
  - Use classes by default and apply the single responsibility principle.
  - Write clean, readable code with comprehensive comments and JSDoc annotations.

- **Google Photos API Integration:**
  - Utilize OAuth2 for authentication using the official Google APIs client library.
  - Create a `GooglePhotosService` to handle interactions with the Google Photos API, such as listing media items and albums.

- **Downloading Files:**
  - Use Node's built-in fetch for downloading images.
  - Implement error handling where each download is wrapped in try/catch to record any failures without stopping the entire process.
  - Maintain a JSON log of failed downloads including details like filename, URL, and error messages for manual reattempt or automated retries.
  - Additionally, maintain a separate JSON file that maps downloaded images and their metadata. This file will be referenced on subsequent runs to prevent re-downloading images that have already been obtained.

- **Handling Metadata & Albums:**
  - Download and store all metadata along with the images.
  - Optionally, include album information by integrating additional API endpoints to fetch album data.
  - **Facial Recognition Data:**
    - Note that Google Photos API does not provide direct access to raw facial recognition data. If required, additional processing (using external libraries or cloud APIs) would be needed after download.

## Project Structure
- `src/index.ts`: Entry point of the application.
- `src/services/GooglePhotosService.ts`: Service for interacting with the Google Photos API (handling OAuth2, listing media, albums, etc.).
- `src/services/DownloadService.ts`: Service for downloading files using Node's fetch and handling error logging gracefully.
- `downloads/`: Directory where downloaded images and metadata files are stored.
- `plan.md`: This detailed planning document outlining the project design and considerations.

## Workflow
1. **Setup & Configuration:**
   - Initialize the Node.js project with TypeScript.
   - Set up OAuth2 with Google API credentials (secured via environment variables).

2. **Implement `GooglePhotosService`:**
   - Handle OAuth2 authentication.
   - Retrieve media items and optional album data.

3. **Implement `DownloadService`:**
   - Use Node's built-in fetch to download files, ensuring error handling and retry logging.
   - Save each image in original quality and record its metadata.

4. **Orchestrate in Main Application (`src/index.ts`):**
   - Use dependency injection to integrate services.
   - Loop through media items, download images, store metadata, and log any download failures.

5. **Testing & Deployment:**
   - Write unit tests using Vitest for each service and for the overall process.
   - Run the application on bare-metal (no Docker required).

## Additional Considerations
- Future enhancements might include implementing retry logic for failed downloads.
- If detailed facial/object recognition data is required, consider an additional processing pipeline after download (e.g., using cloud-based vision APIs or local libraries like face-api.js).
- Ensure proper logging and graceful error handling throughout the application.

## Conclusion
By following this plan, the application will be modular, maintainable, and robust, efficiently downloading Google Photos in original quality while preserving metadata and handling errors gracefully. This plan sets a solid foundation for further enhancements and reliability in managing large photo libraries. 