import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { fileTypeFromBuffer } from 'file-type';
import { getTextExtractor } from 'office-text-extractor';
import * as XLSX from 'xlsx';

export interface ExtractionResult {
  pageContent: string;
  fileType: string;
}

export interface ExtractionError {
  id: string;
  name: string;
  path: string | null;
  status: string;
}

export class TextExtractionService {
  // Extensiones de archivo soportadas para extracción de texto
  private readonly supportedExtensions = [
    '.pdf', '.doc', '.docx', '.docm', '.dotx', '.dotm',
    '.xls', '.xlsx', '.txt', '.md', '.json', '.csv'
  ];

  // Extensiones explícitamente no soportadas (rechazar inmediatamente)
  private readonly unsupportedExtensions = [
    '.inf', '.exe', '.dll', '.sys', '.bin', '.dat', '.log',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.iso', '.img', '.vhd', '.vhdx'
  ];

  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult> {
    const normalizedMimeType = mimeType.toLowerCase();
    const normalizedFileName = fileName.toLowerCase();
    
    // Validar extensión del archivo antes de procesar
    const fileExtension = this.getFileExtension(normalizedFileName);
    
    // Rechazar explícitamente extensiones no soportadas
    if (this.unsupportedExtensions.includes(fileExtension)) {
      throw new Error(`Formato de archivo no soportado: ${fileExtension.toUpperCase()}. Los archivos de este tipo no pueden ser vectorizados.`);
    }
    
    // Verificar si la extensión está en la lista de soportadas
    const isSupportedExtension = this.supportedExtensions.some(ext => normalizedFileName.endsWith(ext));
    
    const detected = await this.detectFileType(buffer);
    const combinedMimeType = `${normalizedMimeType} ${detected.mimeType || ''}`.trim();
    const combinedFileName = `${normalizedFileName}${detected.extensionSuffix || ''}`;
    const isPdf = combinedMimeType.includes('pdf') || combinedFileName.endsWith('.pdf');
    // Detectar archivos antiguos primero (antes de los modernos)
    // .doc antiguo: tiene x-cfb o msword pero NO wordprocessingml, y el nombre original termina en .doc
    const isOldDoc = normalizedFileName.endsWith('.doc') && 
                     (combinedMimeType.includes('x-cfb') || 
                      (combinedMimeType.includes('msword') && !combinedMimeType.includes('wordprocessingml')));
    
    // .xls antiguo: el nombre original termina en .xls pero NO tiene spreadsheetml
    const isOldExcel = normalizedFileName.endsWith('.xls') && 
                      !combinedMimeType.includes('spreadsheetml');
    
    const isDoc =
      combinedMimeType.includes('wordprocessingml') ||
      combinedMimeType.includes('msword') ||
      combinedMimeType.includes('x-cfb') ||
      combinedFileName.endsWith('.docx') ||
      combinedFileName.endsWith('.docm') ||
      combinedFileName.endsWith('.dotx') ||
      combinedFileName.endsWith('.dotm') ||
      combinedFileName.endsWith('.doc');
    
    const isExcel =
      combinedMimeType.includes('spreadsheetml') ||
      combinedMimeType.includes('ms-excel') ||
      combinedFileName.endsWith('.xlsx') ||
      combinedFileName.endsWith('.xls');
    const isImage =
      combinedMimeType.includes('image') ||
      combinedFileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
    const isPlainText =
      combinedMimeType.includes('text') ||
      combinedFileName.match(/\.(txt|md|json|csv)$/i);

    if (isPdf) {
      return this.extractFromPdf(buffer);
    }

    // Verificar archivos antiguos primero (antes de los modernos)
    if (isOldDoc) {
      return this.extractFromOldDoc(buffer);
    }
    
    if (isOldExcel) {
      return this.extractFromOldExcel(buffer);
    }

    if (isDoc) {
      return this.extractFromDocx(buffer);
    }

    if (isExcel) {
      return this.extractFromExcel(buffer);
    }

    if (isImage) {
      throw new Error('Archivo de imagen no vectorizable sin OCR');
    }

    if (isPlainText) {
      return this.extractFromText(buffer);
    }

    if (this.looksLikePlainText(buffer)) {
      // Solo permitir texto plano si la extensión está soportada o es .txt explícitamente
      if (isSupportedExtension || fileExtension === '.txt') {
        return this.extractFromText(buffer);
      }
    }

    // Si llegamos aquí y la extensión no está soportada, rechazar
    if (!isSupportedExtension) {
      throw new Error(`Formato de archivo no soportado: ${fileExtension.toUpperCase()} (${fileName}). Formatos soportados: ${this.supportedExtensions.join(', ')}`);
    }

    throw new Error(`Formato de archivo no soportado: ${mimeType} (${fileName})`);
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1 || lastDot === fileName.length - 1) {
      return '';
    }
    return fileName.substring(lastDot).toLowerCase();
  }

  private async extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    let text = '';
    
    // Método 1: Extracción estándar con la nueva API de pdf-parse
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      
      if (result && result.text) {
        text = typeof result.text === 'string' ? result.text : String(result.text || '');
      }
    } catch (error) {
      // Continuar con métodos alternativos
    }

    // Método 2: Si no hay texto, intentar con opciones diferentes
    if (!this.hasAnyText(text)) {
      try {
        const fallbackText = await this.extractPdfTextWithPagerender(buffer);
        if (this.hasAnyText(fallbackText)) {
          text = fallbackText;
        }
      } catch (fallbackError) {
        // Continuar con método 3
      }
    }

    // Método 3: Extracción con lineEnforce
    if (!this.hasAnyText(text)) {
      try {
        const pageByPageText = await this.extractPdfPageByPage(buffer);
        if (this.hasAnyText(pageByPageText)) {
          text = pageByPageText;
        }
      } catch (pageError) {
        // Continuar
      }
    }

    // Normalizar el texto extraído
    text = this.normalizeText(text);

    // Validación final más flexible
    if (!this.hasAnyText(text)) {
      throw new Error('PDF sin texto extraíble (posiblemente escaneado o solo imágenes)');
    }

    return {
      pageContent: text,
      fileType: 'pdf',
    };
  }

  private async extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    let text = '';
    let isDocx = true;
    
    // Método 1: Intentar con mammoth (solo funciona con .docx)
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
      
      if (typeof text !== 'string') {
        text = String(text);
      }
      
      text = this.normalizeText(text);
    } catch (rawTextError) {
      // Si mammoth falla, puede ser un .doc antiguo
      isDocx = false;
    }

    // Método 2: Si mammoth falló, intentar con office-text-extractor
    // Primero intentar como .docx, luego como .doc
    if (!this.hasAnyText(text)) {
      try {
        const extractor = getTextExtractor();
        // Intentar primero como .docx
        try {
          const extractedText = await extractor.extractText({ 
            input: buffer, 
            type: 'buffer' 
          });
          if (extractedText && typeof extractedText === 'string') {
            text = extractedText;
            text = this.normalizeText(text);
          }
        } catch (docxError) {
          // Si falla, puede ser un .doc antiguo - office-text-extractor no lo soporta bien
          // En este caso, lanzar un error más descriptivo
          throw new Error('Archivo .doc antiguo no soportado. Por favor, convierte el archivo a .docx');
        }
      } catch (extractorError) {
        const errorMsg = extractorError instanceof Error ? extractorError.message : 'Error desconocido';
        // Si el error indica que no hay método para el tipo, es un .doc antiguo
        if (errorMsg.includes('could not find a method') || errorMsg.includes('x-cfb')) {
          throw new Error('Archivo .doc antiguo no soportado. Por favor, convierte el archivo a .docx');
        }
        // Si el error ya fue lanzado (docxError), propagarlo
        if (extractorError instanceof Error && extractorError.message.includes('no soportado')) {
          throw extractorError;
        }
        // Continuar con método 3 solo si no es un error de formato no soportado
      }
    }

    // Método 3: Si aún no hay texto, intentar HTML con mammoth (solo para .docx)
    if (!this.hasAnyText(text) && isDocx) {
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        const htmlText = htmlResult.value || '';
        if (htmlText) {
          text = htmlText
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          text = this.normalizeText(text);
        }
      } catch (htmlError) {
        // Método HTML falló
      }
    }
    
    if (!this.hasAnyText(text)) {
      throw new Error('Documento Word sin texto extraíble');
    }

    return {
      pageContent: text,
      fileType: isDocx ? 'docx' : 'doc',
    };
  }

  private async extractFromExcel(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const textParts: string[] = [];

      workbook.worksheets.forEach((worksheet) => {
        worksheet.eachRow((row, _rowNumber) => {
          const rowValues: string[] = [];
          
          row.eachCell({ includeEmpty: false }, (cell) => {
            const cellValue = cell.value;
            if (cellValue !== null && cellValue !== undefined) {
              let cellText = '';
              
              if (typeof cellValue === 'string' || typeof cellValue === 'number' || typeof cellValue === 'boolean') {
                cellText = String(cellValue).trim();
              } else if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
                cellText = String((cellValue as any).text).trim();
              } else if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
                cellText = String((cellValue as any).result).trim();
              } else if (cellValue && typeof cellValue === 'object' && 'richText' in cellValue) {
                const richText = (cellValue as any).richText;
                if (Array.isArray(richText)) {
                  cellText = richText.map((rt: any) => rt.text || '').join('').trim();
                }
              } else if (cellValue && typeof cellValue === 'object') {
                cellText = JSON.stringify(cellValue).trim();
              }
              
              if (cellText.length > 0) {
                rowValues.push(cellText);
              }
            }
          });
          
          if (rowValues.length > 0) {
            textParts.push(rowValues.join(' '));
          }
        });
      });

      let text = textParts.join('\n');
      text = this.normalizeText(text);

      if (!this.hasAnyText(text)) {
        throw new Error('Archivo Excel sin contenido extraíble (hojas vacías o solo formato)');
      }

      return {
        pageContent: text,
        fileType: 'xlsx',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      if (errorMessage.includes('sin contenido extraíble')) {
        throw error;
      }
      throw new Error(`Error al extraer texto del archivo Excel: ${errorMessage}`);
    }
  }

  private async extractFromOldExcel(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const textParts: string[] = [];

      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        sheetData.forEach((row: any) => {
          if (Array.isArray(row)) {
            const rowValues = row
              .map((cell: any) => {
                if (cell !== null && cell !== undefined && cell !== '') {
                  return String(cell).trim();
                }
                return '';
              })
              .filter((val: string) => val.length > 0);
            
            if (rowValues.length > 0) {
              textParts.push(rowValues.join(' '));
            }
          }
        });
      });

      let text = textParts.join('\n');
      text = this.normalizeText(text);

      if (!this.hasAnyText(text)) {
        throw new Error('Archivo Excel antiguo sin contenido extraíble');
      }

      return {
        pageContent: text,
        fileType: 'xls',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al extraer texto del archivo Excel antiguo: ${errorMessage}`);
    }
  }

  private async extractFromOldDoc(buffer: Buffer): Promise<ExtractionResult> {
    // Intentar extraer texto de archivos .doc antiguos usando office-text-extractor
    // Si falla, intentar leer el formato OLE2/CFB directamente (limitado)
    try {
      const extractor = getTextExtractor();
      const extractedText = await extractor.extractText({ input: buffer, type: 'buffer' });
      
      if (extractedText && typeof extractedText === 'string' && this.hasAnyText(extractedText)) {
        return {
          pageContent: this.normalizeText(extractedText),
          fileType: 'doc',
        };
      }
    } catch (error) {
      // office-text-extractor no soporta .doc antiguos
    }
    
    // Si office-text-extractor falla, intentar leer el formato OLE2/CFB básico
    // Esto es limitado pero puede extraer algo de texto en algunos casos
    try {
      const text = await this.extractTextFromOle2Doc(buffer);
      if (text && this.hasAnyText(text)) {
        return {
          pageContent: this.normalizeText(text),
          fileType: 'doc',
        };
      }
    } catch (oleError) {
      // Falló la extracción OLE2
    }
    
    throw new Error('No se pudo extraer texto del archivo .doc antiguo. Por favor, convierte el archivo a .docx');
  }

  private async extractTextFromOle2Doc(buffer: Buffer): Promise<string> {
    // Extracción básica de texto de archivos .doc antiguos (OLE2/CFB)
    // Esto es una implementación limitada que busca texto legible en el buffer
    const textMatches: string[] = [];
    // Buscar secuencias de texto legible (mínimo 5 caracteres, preferiblemente más)
    // Excluir caracteres de control y caracteres repetidos sospechosos
    const textPattern = /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF][\x20-\x7E\u00A0-\u00FF]{4,}/g;
    
    let match;
    const bufferString = buffer.toString('latin1'); // Usar latin1 para preservar bytes
    
    while ((match = textPattern.exec(bufferString)) !== null) {
      let text = match[0].trim();
      
      // Filtrar texto que tiene demasiados caracteres repetidos (probablemente basura)
      const uniqueChars = new Set(text.split(''));
      if (uniqueChars.size < text.length * 0.3) {
        // Si menos del 30% de los caracteres son únicos, probablemente es basura
        continue;
      }
      
      // Filtrar secuencias de caracteres repetidos (como ÿÿÿÿ)
      if (/(.)\1{4,}/.test(text)) {
        continue;
      }
      
      // Aceptar solo si tiene al menos algunos caracteres alfanuméricos
      if (text.length >= 5 && /[a-zA-Z0-9\u00C0-\u024F]{2,}/.test(text)) {
        // Limpiar caracteres no imprimibles al inicio/final
        text = text.replace(/^[\x00-\x1F\x7F-\x9F]+|[\x00-\x1F\x7F-\x9F]+$/g, '');
        if (text.length >= 5) {
          textMatches.push(text);
        }
      }
    }
    
    // Unir los fragmentos y limpiar
    let combinedText = textMatches.join(' ');
    
    // Limpiar caracteres no imprimibles y espacios excesivos
    combinedText = combinedText
      .replace(/[\x00-\x1F\x7F-\x9F]+/g, ' ') // Reemplazar caracteres de control con espacios
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
    
    // Limpiar fragmentos basura comunes al inicio (como "bjbj,E,E")
    combinedText = combinedText.replace(/^[a-z]{1,3}[,;:]\s*[A-Z]{1,3}[,;:]\s*/i, '');
    
    return combinedText.trim();
  }

  private async extractFromText(buffer: Buffer): Promise<ExtractionResult> {
    try {
      let text = buffer.toString('utf-8');
      text = this.normalizeText(text);

      if (!this.hasAnyText(text)) {
        throw new Error('Archivo de texto vacío');
      }

      return {
        pageContent: text,
        fileType: 'text',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al leer archivo de texto: ${errorMessage}`);
    }
  }

  private normalizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    return text
      .replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private hasAnyText(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return false;
    }
    
    // Filtrar metadata de paginación común en PDFs escaneados
    // Patrones como "-- 1 of 1 --", "-- Page 1 --", etc. (una sola instancia)
    const singlePaginationPattern = /^[\s\n\r]*--?\s*\d+\s+(of|page|página)\s+\d+\s*--?[\s\n\r]*$/i;
    if (singlePaginationPattern.test(trimmed)) {
      return false;
    }
    
    // Detectar múltiples patrones de paginación (PDFs escaneados con solo metadata)
    // Buscar si el texto consiste principalmente en patrones "-- X of Y --"
    const paginationMatches = trimmed.match(/--?\s*\d+\s+(of|page|página)\s+\d+\s*--?/gi);
    let nonPaginationText = trimmed;
    
    if (paginationMatches) {
      // Si más del 80% del texto es metadata de paginación, rechazar
      const paginationText = paginationMatches.join('');
      const paginationRatio = paginationText.length / trimmed.length;
      if (paginationRatio > 0.8) {
        return false;
      }
      
      // Remover paginación para analizar el contenido real
      nonPaginationText = trimmed.replace(/--?\s*\d+\s+(of|page|página)\s+\d+\s*--?/gi, '').trim();
      
      // Si hay muchas instancias de paginación pero poco otro contenido, rechazar
      // Ejemplo: "-- 1 of 13 --" repetido 13 veces sin otro contenido
      if (nonPaginationText.length < 20) {
        return false;
      }
    }
    
    // Si hay suficiente contenido sin paginación (más de 500 caracteres), es válido
    // Esto cubre casos donde el texto puede tener caracteres especiales o codificaciones diferentes
    // que no se reconocen bien como palabras pero sí como contenido
    if (nonPaginationText.length >= 500) {
      return true;
    }
    
    // Para textos más cortos, verificar caracteres alfanuméricos y palabras
    const alphanumericChars = nonPaginationText.match(/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g);
    if (!alphanumericChars || alphanumericChars.length < 10) {
      return false;
    }
    
    // Si hay al menos 100 caracteres sin paginación y algunos caracteres alfanuméricos, es válido
    // Esto permite PDFs con caracteres especiales que no se reconocen como palabras normales
    if (nonPaginationText.length >= 100 && alphanumericChars.length >= 20) {
      return true;
    }
    
    // Para textos más cortos, verificar que hay palabras reales diversas
    const words = nonPaginationText.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]{2,}/g);
    if (!words || words.length < 3) {
      return false;
    }
    
    // Verificar diversidad de palabras: si todas las palabras son iguales o muy similares, rechazar
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size < 3) {
      // Si hay menos de 3 palabras únicas Y el texto es corto, probablemente es solo metadata repetida
      return false;
    }
    
    return true;
  }

  validateExtractionResult(result: ExtractionResult): void {
    if (!result.pageContent || !this.hasAnyText(result.pageContent)) {
      throw new Error('No se pudo extraer texto del archivo');
    }
  }

  private async detectFileType(buffer: Buffer): Promise<{ mimeType: string; extensionSuffix: string }> {
    try {
      const detected = await fileTypeFromBuffer(buffer);
      if (!detected) {
        return { mimeType: '', extensionSuffix: '' };
      }

      return {
        mimeType: detected.mime.toLowerCase(),
        extensionSuffix: detected.ext ? `.${detected.ext.toLowerCase()}` : '',
      };
    } catch {
      return { mimeType: '', extensionSuffix: '' };
    }
  }

  private looksLikePlainText(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 4096);
    if (sampleSize === 0) {
      return false;
    }

    const sample = buffer.subarray(0, sampleSize);
    const text = sample.toString('utf-8');
    if (!text) {
      return false;
    }

    const nullChars = (text.match(/\u0000/g) || []).length;
    if (nullChars > 0) {
      return false;
    }

    const printable = (text.match(/[\t\n\r\x20-\x7E\u00A0-\u00FF]/g) || []).length;
    const ratio = printable / text.length;
    return ratio >= 0.8;
  }

  private async extractPdfTextWithPagerender(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText({
        disableNormalization: false,
      });
      
      if (result && result.text) {
        return this.normalizeText(typeof result.text === 'string' ? result.text : String(result.text || ''));
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  private async extractPdfPageByPage(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText({
        lineEnforce: true,
        disableNormalization: false,
      });
      
      if (result && result.text) {
        return typeof result.text === 'string' ? result.text : String(result.text || '');
      }
      return '';
    } catch (error) {
      return '';
    }
  }
}
