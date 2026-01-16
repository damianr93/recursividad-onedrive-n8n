import express from 'express';
import dotenv from 'dotenv';
import { MicrosoftGraphClient } from './infrastructure/clients/MicrosoftGraphClient.js';
import { OneDriveRepository } from './infrastructure/repositories/OneDriveRepository.js';
import { FileService } from './domain/services/FileService.js';
import { GetFilesRecursivelyUseCase } from './application/use-cases/GetFilesRecursivelyUseCase.js';
import { FileController } from './presentation/controllers/FileController.js';
import { createFileRoutes } from './presentation/routes/fileRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const graphClient = new MicrosoftGraphClient();
const oneDriveRepository = new OneDriveRepository(graphClient);
const fileService = new FileService(oneDriveRepository);
const getFilesRecursivelyUseCase = new GetFilesRecursivelyUseCase(fileService);
const fileController = new FileController(getFilesRecursivelyUseCase);

const app = express();
app.use(express.json());

const fileRoutes = createFileRoutes(fileController);
app.use('/', fileRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Endpoint: POST http://localhost:${PORT}/get-files`);
  console.log(`📁 Endpoint alternativo: POST http://localhost:${PORT}/get-files-header`);
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health`);
});
