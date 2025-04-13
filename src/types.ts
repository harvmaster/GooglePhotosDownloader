export type MediaItem = {
  id: string;
  description: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: MediaMetadata;
  contributorInfo: ContributorInfo;
  filename: string;
};

export type BaseMediaMetadata = {
  creationTime: string;
  width: string;
  height: string;
};

export type PhotoMetadata = BaseMediaMetadata & {
  photo: Photo;
};

export type VideoMetadata = BaseMediaMetadata & {
  video: Video;
};

export type MediaMetadata = PhotoMetadata | VideoMetadata;

export type Photo = {
  cameraMake: string;
  cameraModel: string;
  focalLength: number;
  apertureFNumber: number;
  isoEquivalent: number;
  exposureTime: string;
};

export type Video = {
  cameraMake: string;
  cameraModel: string;
  fps: number;
  status: VideoProcessingStatus;
};

export type VideoProcessingStatus = 'UNSPECIFIED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type ContributorInfo = {
  profilePictureBaseUrl: string;
  displayName: string;
};

export type Album = {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  shareInfo: ShareInfo;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
};

export type ShareInfo = {
  id: string;
  title: string;
  productUrl: string;
  isWriteable: boolean;
  shareInfo: ShareInfo;
  mediaItemsCount: string;
  coverPhotoBaseUrl: string;
  coverPhotoMediaItemId: string;
};

export type SharedAlbumOptions = {
  isCollaborative: boolean;
  isCommentable: boolean;
};

export type MediaItemsResponse = {
  mediaItems: MediaItem[];
  nextPageToken: string;
};
