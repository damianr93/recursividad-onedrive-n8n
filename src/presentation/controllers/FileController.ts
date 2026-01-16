import type { Request, Response } from 'express';
import type { GetFilesRecursivelyUseCase } from '../../application/use-cases/GetFilesRecursivelyUseCase.js';
import { TokenStorage } from '../../infrastructure/auth/TokenStorage.js';
import type { OAuth2Service } from '../../infrastructure/auth/OAuth2Service.js';
import { MicrosoftGraphClient } from '../../infrastructure/clients/MicrosoftGraphClient.js';
import { TextExtractionService } from '../../domain/services/TextExtractionService.js';

export class FileController {
  private readonly graphClient: MicrosoftGraphClient;
  private readonly textExtractionService: TextExtractionService;

  constructor(
    private readonly getFilesRecursivelyUseCase: GetFilesRecursivelyUseCase,
    private readonly oauth2Service?: OAuth2Service
  ) {
    this.graphClient = new MicrosoftGraphClient();
    this.textExtractionService = new TextExtractionService();
  }

  async getFiles(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const { folderId: rawFolderId, accessToken: bodyAccessToken, userId } = body;
      
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
        
        if (!accessToken && this.oauth2Service && TokenStorage.hasRefreshToken()) {
          try {
            const refreshToken = TokenStorage.getRefreshToken();
            if (refreshToken) {
              await this.oauth2Service.refreshAccessToken(refreshToken);
              accessToken = TokenStorage.getToken();
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error al renovar token:', errorMessage);
          }
        }
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
        folderId = process.env.ONEDRIVE_ROOT_FOLDER_ID?.trim();
      }

      if (!folderId) {
        res.status(400).json({ 
          error: 'folderId es requerido. Puede pasarlo en el body o configurarlo en ONEDRIVE_ROOT_FOLDER_ID en .env'
        });
        return;
      }

      if (!accessToken || accessToken === 'Bearer') {
        res.status(401).json({ 
          error: 'accessToken es requerido. Autentica primero usando GET /auth/login o pasa el token en el body/header.'
        });
        return;
      }

      const result = await this.getFilesRecursivelyUseCase.execute(folderId, accessToken, userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en getFiles:', errorMessage);
      
      const statusCode = errorMessage.includes('autenticación') || errorMessage.includes('token') ? 401 : 500;
      
      res.status(statusCode).json({
        error: 'Error al obtener archivos',
        message: errorMessage,
      });
    }
  }

  async getFilesWithHeader(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      let { folderId, userId } = body;
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.replace('Bearer ', '');

      if (!folderId) {
        folderId = process.env.ONEDRIVE_ROOT_FOLDER_ID?.trim();
      }

      if (!folderId) {
        res.status(400).json({ 
          error: 'folderId es requerido. Puede pasarlo en el body o configurarlo en ONEDRIVE_ROOT_FOLDER_ID en .env'
        });
        return;
      }

      if (!accessToken) {
        res.status(401).json({ error: 'accessToken es requerido en el header Authorization' });
        return;
      }

      const result = await this.getFilesRecursivelyUseCase.execute(folderId, accessToken, userId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en getFilesWithHeader:', errorMessage);
      
      const statusCode = errorMessage.includes('autenticación') || errorMessage.includes('token') ? 401 : 500;
      
      res.status(statusCode).json({
        error: 'Error al obtener archivos',
        message: errorMessage,
      });
    }
  }

  async setToken(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const { token, expiresIn } = body;
      const authHeader = req.headers.authorization;

      let tokenToStore: string | undefined = token;

      if (!tokenToStore && authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          const tokenPart = authHeader.replace('Bearer ', '').trim();
          if (tokenPart && tokenPart !== 'Bearer' && tokenPart.length > 10) {
            tokenToStore = tokenPart;
          }
        } else if (authHeader !== 'Bearer' && authHeader.length > 10) {
          tokenToStore = authHeader.trim();
        }
      }

      if (!tokenToStore) {
        res.status(400).json({ 
          error: 'token es requerido. Puede pasarlo en el body como "token" o en el header Authorization (Bearer token)'
        });
        return;
      }

      TokenStorage.setToken(tokenToStore, expiresIn);
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

  async oauth2Callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, error, error_description } = req.query;

      if (error) {
        res.status(400).json({
          error: 'Error en autenticación OAuth2',
          message: error_description || error,
        });
        return;
      }

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Código de autorización no recibido' });
        return;
      }

      if (!this.oauth2Service) {
        res.status(500).json({ error: 'OAuth2 no configurado' });
        return;
      }

      await this.oauth2Service.exchangeCodeForToken(code);

      res.send(`
        <html>
          <head><title>Autenticación exitosa</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>✅ Autenticación exitosa</h1>
            <p>La aplicación se ha conectado correctamente con Microsoft Graph.</p>
            <p>Puedes cerrar esta ventana y usar la API normalmente.</p>
            <p><a href="/health">Verificar estado</a></p>
          </body>
        </html>
      `);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en oauth2Callback:', errorMessage);
      res.status(500).send(`
        <html>
          <head><title>Error de autenticación</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Error de autenticación</h1>
            <p>${errorMessage}</p>
            <p><a href="/auth/login">Intentar de nuevo</a></p>
          </body>
        </html>
      `);
    }
  }

  async oauth2Login(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.oauth2Service) {
        res.status(500).json({ error: 'OAuth2 no configurado. Verifica las variables de entorno.' });
        return;
      }

      const authUrl = this.oauth2Service.getAuthorizationUrl();
      res.redirect(authUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en oauth2Login:', errorMessage);
      res.status(500).json({
        error: 'Error al generar URL de autenticación',
        message: errorMessage,
      });
    }
  }

  async extractText(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      const { fileId, accessToken: bodyAccessToken, userId } = body;

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

        if (!accessToken && this.oauth2Service && TokenStorage.hasRefreshToken()) {
          try {
            const refreshToken = TokenStorage.getRefreshToken();
            if (refreshToken) {
              await this.oauth2Service.refreshAccessToken(refreshToken);
              accessToken = TokenStorage.getToken();
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error('Error al renovar token:', errorMessage);
          }
        }
      }

      if (!fileId) {
        res.status(400).json({ error: 'fileId es requerido' });
        return;
      }

      if (!accessToken || accessToken === 'Bearer') {
        res.status(401).json({ 
          error: 'accessToken es requerido. Autentica primero usando GET /auth/login o pasa el token en el body/header.'
        });
        return;
      }

      const metadata = await this.graphClient.getFileMetadata(fileId, accessToken, userId);
      const { buffer, mimeType } = await this.graphClient.downloadFile(fileId, accessToken, userId);

      try {
        const extractionResult = await this.textExtractionService.extractText(
          buffer,
          mimeType,
          metadata.name
        );

        this.textExtractionService.validateExtractionResult(extractionResult);

        const base64Data = buffer.toString('base64');
        
        const response = [
          {
            json: {
              pageContent: extractionResult.pageContent,
              id: metadata.id,
              name: metadata.name,
              size: metadata.size,
              webUrl: metadata.webUrl,
              metadata: {
                fileName: metadata.name,
                fileId: metadata.id,
                fileSize: metadata.size,
                fileType: extractionResult.fileType,
                source: 'onedrive',
                webUrl: metadata.webUrl,
                processedDate: new Date().toISOString(),
              },
            },
            binary: {
              data: {
                data: base64Data,
                mimeType: mimeType,
                fileName: metadata.name,
              },
            },
          },
        ];

        res.setHeader('Content-Type', 'application/json');
        res.json(response);
      } catch (extractionError) {
        const errorMessage = extractionError instanceof Error ? extractionError.message : 'Error desconocido al extraer texto';
        
        const errorResponse = {
          error: 'Archivo no vectorizable',
          id: metadata.id,
          name: metadata.name,
          path: metadata.parentReference.path,
          status: errorMessage,
        };

        res.status(422).json(errorResponse);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en extractText:', errorMessage);

      const statusCode = errorMessage.includes('autenticación') || errorMessage.includes('token') ? 401 : 500;

      res.status(statusCode).json({
        error: 'Error al procesar archivo',
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
      hasRefreshToken: TokenStorage.hasRefreshToken(),
    });
  }
}
