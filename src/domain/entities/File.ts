export interface File {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webUrl: string | null;
  downloadUrl: string | null;
  createdDateTime: string;
  lastModifiedDateTime: string;
  parentReference: {
    id: string;
    name: string | null;
    path: string | null;
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
  folder?: {
    childCount?: number;
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
  parentReference: {
    id: string;
    name?: string;
    path?: string;
  };
}
