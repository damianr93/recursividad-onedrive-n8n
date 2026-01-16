import type { Request, Response } from 'express';
import type { GetFilesRecursivelyUseCase } from '../../application/use-cases/GetFilesRecursivelyUseCase.js';

export class FileController {
  constructor(private readonly getFilesRecursivelyUseCase: GetFilesRecursivelyUseCase) {}

  async getFiles(req: Request, res: Response): Promise<void> {
    try {
      const { folderId, accessToken: bodyAccessToken, userId } = req.body;
      const authHeader = req.headers.authorization;
      const headerAccessToken = authHeader?.replace('Bearer ', '');

      const accessToken = bodyAccessToken || headerAccessToken;

      if (!folderId) {
        res.status(400).json({ error: 'folderId es requerido' });
        return;
      }

      if (!accessToken) {
        res.status(400).json({ 
          error: 'accessToken es requerido. Puede pasarlo en el body o en el header Authorization (Bearer token)' 
        });
        return;
      }

      const result = await this.getFilesRecursivelyUseCase.execute(folderId, accessToken, userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en getFiles:', errorMessage);
      res.status(500).json({
        error: 'Error al obtener archivos',
        message: errorMessage,
      });
    }
  }

  async getFilesWithHeader(req: Request, res: Response): Promise<void> {
    try {
      const { folderId, userId } = req.body;
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.replace('Bearer ', '');

      if (!folderId) {
        res.status(400).json({ error: 'folderId es requerido' });
        return;
      }

      if (!accessToken) {
        res.status(400).json({ error: 'accessToken es requerido en el header Authorization' });
        return;
      }

      const result = await this.getFilesRecursivelyUseCase.execute(folderId, accessToken, userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en getFilesWithHeader:', errorMessage);
      res.status(500).json({
        error: 'Error al obtener archivos',
        message: errorMessage,
      });
    }
  }

  healthCheck(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      message: 'Servidor funcionando correctamente',
      timestamp: new Date().toISOString(),
    });
  }
}
