import type { Request, Response } from 'express';
import type { GetFilesRecursivelyUseCase } from '../../application/use-cases/GetFilesRecursivelyUseCase.js';

export class FileController {
  constructor(private readonly getFilesRecursivelyUseCase: GetFilesRecursivelyUseCase) {}

  async getFiles(req: Request, res: Response): Promise<void> {
    try {
      const { folderId: rawFolderId, accessToken: bodyAccessToken, userId } = req.body;
      
      let headerAccessToken: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          headerAccessToken = authHeader.replace('Bearer ', '').trim();
        } else {
          headerAccessToken = authHeader.trim();
        }
      }

      const accessToken = bodyAccessToken || headerAccessToken;

      let folderId = rawFolderId;
      if (typeof folderId === 'string' && folderId.includes("'")) {
        const match = folderId.match(/'([^']+)'/);
        if (match) {
          folderId = match[1];
        }
      }
      folderId = folderId?.trim();

      if (!folderId) {
        res.status(400).json({ error: 'folderId es requerido' });
        return;
      }

      if (!accessToken) {
        console.log('Headers recibidos:', Object.keys(req.headers));
        console.log('Body recibido:', JSON.stringify(req.body));
        res.status(400).json({ 
          error: 'accessToken es requerido. Puede pasarlo en el body o en el header Authorization (Bearer token)',
          debug: {
            hasAuthHeader: !!authHeader,
            hasBodyToken: !!bodyAccessToken,
            headers: Object.keys(req.headers)
          }
        });
        return;
      }

      if (!accessToken.includes('.')) {
        console.error('Token recibido no parece ser un JWT válido. Longitud:', accessToken.length);
        console.error('Primeros 50 caracteres:', accessToken.substring(0, 50));
        res.status(400).json({
          error: 'El accessToken no es válido. Asegúrate de que n8n esté enviando el token correctamente en el header Authorization',
          hint: 'El token debe ser un JWT válido con puntos (.). Verifica que la autenticación OAuth2 esté configurada correctamente en n8n.'
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
