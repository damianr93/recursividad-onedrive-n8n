import { Router } from 'express';
import type { FileController } from '../controllers/FileController.js';

export function createFileRoutes(fileController: FileController): Router {
  const router = Router();

  router.post('/get-files', (req, res) => {
    fileController.getFiles(req, res).catch((error) => {
      console.error('Error no manejado en getFiles:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    });
  });

  router.post('/get-files-header', (req, res) => {
    fileController.getFilesWithHeader(req, res).catch((error) => {
      console.error('Error no manejado en getFilesWithHeader:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    });
  });

  router.post('/set-token', (req, res) => {
    fileController.setToken(req, res).catch((error) => {
      console.error('Error no manejado en setToken:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    });
  });

  router.get('/auth/login', (req, res) => {
    fileController.oauth2Login(req, res).catch((error: unknown) => {
      console.error('Error no manejado en oauth2Login:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    });
  });

  router.get('/auth/callback', (req, res) => {
    fileController.oauth2Callback(req, res).catch((error: unknown) => {
      console.error('Error no manejado en oauth2Callback:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
          </body>
        </html>
      `);
    });
  });

  router.get('/health', (req, res) => {
    fileController.healthCheck(req, res);
  });

  return router;
}
