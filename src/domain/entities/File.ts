export interface File {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webUrl: string | null;
  downloadUrl: string | null;
  createdDateTime: string;
  lastModifiedDateTime: string;
  eTag?: string;
  cTag?: string;
  createdBy?: {
    user: {
      email?: string;
      id?: string;
      displayName?: string;
    };
  };
  lastModifiedBy?: {
    user: {
      email?: string;
      id?: string;
      displayName?: string;
    };
  };
  parentReference: {
    id: string;
    name: string | null;
    path: string | null;
    driveType?: string;
    driveId?: string;
    siteId?: string;
  };
  fileSystemInfo?: {
    createdDateTime: string;
    lastModifiedDateTime: string;
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
}

export interface Folder {
  id: string;
  name: string;
  webUrl: string | null;
  parentReference: {
    id: string;
    name: string | null;
    path: string | null;
  };
}

export interface OneDriveItem {
  id: string;
  name: string;
  eTag?: string;
  cTag?: string;
  folder?: {
    childCount?: number;
    view?: {
      sortBy?: string;
      sortOrder?: string;
      viewType?: string;
    };
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  size?: number;
  webUrl?: string;
  '@microsoft.graph.downloadUrl'?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: {
    user: {
      email?: string;
      id?: string;
      displayName?: string;
    };
  };
  lastModifiedBy?: {
    user: {
      email?: string;
      id?: string;
      displayName?: string;
    };
  };
  parentReference: {
    id: string;
    name?: string;
    path?: string;
    driveType?: string;
    driveId?: string;
    siteId?: string;
  };
  fileSystemInfo?: {
    createdDateTime: string;
    lastModifiedDateTime: string;
  };
}
