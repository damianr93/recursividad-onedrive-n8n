import type { File } from '../entities/File.js';
import type { IOneDriveRepository } from '../repositories/IOneDriveRepository.js';

export class FileService {
  constructor(private readonly oneDriveRepository: IOneDriveRepository) {}

  async getFilesRecursively(folderId: string, accessToken: string, userId?: string): Promise<File[]> {
    const allFiles: File[] = [];
    await this.processFolder(folderId, accessToken, allFiles, userId);
    return allFiles;
  }

  private async processFolder(
    folderId: string,
    accessToken: string,
    allFiles: File[],
    userId?: string
  ): Promise<void> {
    try {
      const items = await this.oneDriveRepository.getItemsByFolderId(folderId, accessToken, userId);

      for (const item of items) {
        if (item.folder) {
          await this.processFolder(item.id, accessToken, allFiles, userId);
        } else if (item.file) {
          const file = this.oneDriveRepository.mapItemToFile(item, folderId);
          allFiles.push(file);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error procesando carpeta ${folderId}:`, errorMessage);
      throw new Error(`Error al procesar carpeta ${folderId}: ${errorMessage}`);
    }
  }
}
