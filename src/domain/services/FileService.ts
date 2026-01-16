import type { File } from '../entities/File.js';
import type { IOneDriveRepository } from '../repositories/IOneDriveRepository.js';

export class FileService {
  private fileCount = 0;
  private readonly logInterval = 20;

  constructor(private readonly oneDriveRepository: IOneDriveRepository) {}

  async getFilesRecursively(folderId: string, accessToken: string, userId?: string): Promise<File[]> {
    this.fileCount = 0;
    const allFiles: File[] = [];
    const startTime = Date.now();
    
    await this.processFolder(folderId, accessToken, allFiles, userId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Procesamiento completado: ${this.fileCount} archivos encontrados en ${duration}s`);
    
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

      const folders: string[] = [];
      const files: File[] = [];

      for (const item of items) {
        if (item.folder) {
          folders.push(item.id);
        } else if (item.file) {
          const file = this.oneDriveRepository.mapItemToFile(item, folderId);
          files.push(file);
        }
      }

      allFiles.push(...files);
      this.fileCount += files.length;

      if (this.fileCount % this.logInterval === 0 && this.fileCount > 0) {
        console.log(`📊 Procesados ${this.fileCount} archivos...`);
      }

      if (folders.length > 0) {
        await Promise.all(
          folders.map(folderId => this.processFolder(folderId, accessToken, allFiles, userId))
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al procesar carpeta ${folderId}: ${errorMessage}`);
    }
  }
}
