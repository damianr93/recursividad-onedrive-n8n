import express from 'express';
import dotenv from 'dotenv';
import { MicrosoftGraphClient } from './infrastructure/clients/MicrosoftGraphClient.js';
import { OneDriveRepository } from './infrastructure/repositories/OneDriveRepository.js';
import { FileService } from './domain/services/FileService.js';
import { GetFilesRecursivelyUseCase } from './application/use-cases/GetFilesRecursivelyUseCase.js';
import { FileController } from './presentation/controllers/FileController.js';
import { createFileRoutes } from './presentation/routes/fileRoutes.js';
import { OAuth2Service } from './infrastructure/auth/OAuth2Service.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

let oauth2Service: OAuth2Service | undefined;

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  oauth2Service = new OAuth2Service({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: tenantId,
    redirectUri: REDIRECT_URI,
  });
  console.log('✅ OAuth2 configurado. Usa GET /auth/login para autenticarte');
  console.log(`   Tenant: ${tenantId} (usa "common" para permitir cuentas personales y organizacionales)`);
} else {
  console.log('⚠️  OAuth2 no configurado. Configura MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET en .env');
  console.log('   MICROSOFT_TENANT_ID es opcional (por defecto usa "common")');
}

const graphClient = new MicrosoftGraphClient();
const oneDriveRepository = new OneDriveRepository(graphClient);
const fileService = new FileService(oneDriveRepository);
const getFilesRecursivelyUseCase = new GetFilesRecursivelyUseCase(fileService);
const fileController = new FileController(getFilesRecursivelyUseCase, oauth2Service);

const app = express();
app.use(express.json());

const fileRoutes = createFileRoutes(fileController);
app.use('/', fileRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Endpoint: POST http://localhost:${PORT}/get-files`);
  console.log(`📁 Endpoint alternativo: POST http://localhost:${PORT}/get-files-header`);
  console.log(`📄 Extraer texto: POST http://localhost:${PORT}/extract-text`);
  console.log(`🔑 Almacenar token: POST http://localhost:${PORT}/set-token`);
  if (oauth2Service) {
    console.log(`🔐 Autenticación OAuth2: GET http://localhost:${PORT}/auth/login`);
    console.log(`   Callback: http://localhost:${PORT}/auth/callback`);
  }
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health`);
});
