import type { File, Folder, OneDriveItem } from '../../domain/entities/File.js';
import type { IOneDriveRepository } from '../../domain/repositories/IOneDriveRepository.js';
import { MicrosoftGraphClient } from '../clients/MicrosoftGraphClient.js';

export class OneDriveRepository implements IOneDriveRepository {
  constructor(private readonly graphClient: MicrosoftGraphClient) {}

  async getItemsByFolderId(folderId: string, accessToken: string, userId?: string): Promise<OneDriveItem[]> {
    return this.graphClient.getItemsByFolderId(folderId, accessToken, userId);
  }

  mapItemToFile(item: OneDriveItem, _folderId: string): File {
    return {
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      size: item.size || 0,
      webUrl: item.webUrl || null,
      downloadUrl: item['@microsoft.graph.downloadUrl'] || null,
      createdDateTime: item.createdDateTime,
      lastModifiedDateTime: item.lastModifiedDateTime,
      eTag: item.eTag,
      cTag: item.cTag,
      createdBy: item.createdBy,
      lastModifiedBy: item.lastModifiedBy,
      parentReference: {
        id: item.parentReference.id,
        name: item.parentReference.name || null,
        path: item.parentReference.path || null,
        driveType: item.parentReference.driveType,
        driveId: item.parentReference.driveId,
        siteId: item.parentReference.siteId,
      },
      fileSystemInfo: item.fileSystemInfo,
      file: item.file
        ? {
            mimeType: item.file.mimeType,
            hashes: item.file.hashes,
          }
        : undefined,
    };
  }

  mapItemToFolder(item: OneDriveItem, _folderId: string): Folder {
    return {
      id: item.id,
      name: item.name,
      webUrl: item.webUrl || null,
      parentReference: {
        id: item.parentReference.id,
        name: item.parentReference.name || null,
        path: item.parentReference.path || null,
      },
    };
  }
}
