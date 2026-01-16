import type { File, Folder, OneDriveItem } from '../entities/File.js';

export interface IOneDriveRepository {
  getItemsByFolderId(folderId: string, accessToken: string, userId?: string): Promise<OneDriveItem[]>;
  mapItemToFile(item: OneDriveItem, folderId: string): File;
  mapItemToFolder(item: OneDriveItem, folderId: string): Folder;
}
