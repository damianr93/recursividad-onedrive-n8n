import type { File } from '../../domain/entities/File.js';
import type { FileService } from '../../domain/services/FileService.js';

export class GetFilesRecursivelyUseCase {
  constructor(private readonly fileService: FileService) {}

  async execute(folderId: string, accessToken: string, userId?: string): Promise<Array<{ json: File }>> {
    if (!folderId || folderId.trim() === '') {
      throw new Error('folderId es requerido y no puede estar vacío');
    }

    if (!accessToken || accessToken.trim() === '') {
      throw new Error('accessToken es requerido y no puede estar vacío');
    }

    const files = await this.fileService.getFilesRecursively(folderId, accessToken, userId);
    return files.map((file) => ({ json: file }));
  }
}
