import type { Request, Response } from 'express';
import type { GetFilesRecursivelyUseCase } from '../../application/use-cases/GetFilesRecursivelyUseCase.js';
import { TokenStorage } from '../../infrastructure/auth/TokenStorage.js';

export class FileController {
  constructor(private readonly getFilesRecursivelyUseCase: GetFilesRecursivelyUseCase) {}

  async getFiles(req: Request, res: Response): Promise<void> {
    try {
      const { folderId: rawFolderId, accessToken: bodyAccessToken, userId } = req.body;
      
      let headerAccessToken: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          const tokenPart = authHeader.replace('Bearer ', '').trim();
          if (tokenPart && tokenPart !== 'Bearer' && tokenPart.length > 10) {
            headerAccessToken = tokenPart;
          }
        } else if (authHeader !== 'Bearer' && authHeader.length > 10) {
          headerAccessToken = authHeader.trim();
        }
      }

      let accessToken = bodyAccessToken || headerAccessToken;
      
      if (!accessToken) {
        accessToken = TokenStorage.getToken();
      }

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

      if (!accessToken || accessToken === 'Bearer') {
        res.status(400).json({ 
          error: 'accessToken es requerido. Si usas n8n con "Predefined Credential Type", asegúrate de que la autenticación esté correctamente configurada. ' +
            'Si pasas el token manualmente, debe estar en el body como "accessToken" o en el header Authorization como "Bearer <token>".'
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

  async setToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, expiresIn } = req.body;

      if (!token) {
        res.status(400).json({ error: 'token es requerido' });
        return;
      }

      TokenStorage.setToken(token, expiresIn);
      res.json({
        success: true,
        message: 'Token almacenado correctamente',
        hasToken: TokenStorage.hasToken(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en setToken:', errorMessage);
      res.status(500).json({
        error: 'Error al almacenar token',
        message: errorMessage,
      });
    }
  }

  healthCheck(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      message: 'Servidor funcionando correctamente',
      timestamp: new Date().toISOString(),
      hasStoredToken: TokenStorage.hasToken(),
    });
  }
}
