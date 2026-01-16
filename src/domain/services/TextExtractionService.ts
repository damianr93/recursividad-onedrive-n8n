import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

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
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult> {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes('pdf')) {
      return this.extractFromPdf(buffer);
    }

    if (
      normalizedMimeType.includes('wordprocessingml') ||
      normalizedMimeType.includes('msword') ||
      fileName.toLowerCase().endsWith('.docx') ||
      fileName.toLowerCase().endsWith('.doc')
    ) {
      return this.extractFromDocx(buffer);
    }

    if (
      normalizedMimeType.includes('spreadsheetml') ||
      fileName.toLowerCase().endsWith('.xlsx') ||
      fileName.toLowerCase().endsWith('.xls')
    ) {
      return this.extractFromExcel(buffer);
    }

    if (
      normalizedMimeType.includes('image') ||
      fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)
    ) {
      throw new Error('Archivo de imagen no vectorizable sin OCR');
    }

    if (
      normalizedMimeType.includes('text') ||
      fileName.match(/\.(txt|md|json|csv)$/i)
    ) {
      return this.extractFromText(buffer);
    }

    throw new Error(`Formato de archivo no soportado: ${mimeType} (${fileName})`);
  }

  private async extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const options = {
        max: 0,
      };
      
      const data = await (pdfParse as any)(buffer, options);
      let text = data.text || '';
      
      if (typeof text !== 'string') {
        text = String(text);
      }
      
      text = this.normalizeText(text);

      if (!this.hasValidText(text)) {
        const numPages = data.numpages || 0;
        console.warn(`PDF con ${numPages} páginas pero sin texto extraíble. Texto crudo: "${text.substring(0, 100)}"`);
        throw new Error('PDF sin texto extraíble (posiblemente escaneado o solo imágenes)');
      }

      return {
        pageContent: text,
        fileType: 'pdf',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      if (errorMessage.includes('sin texto extraíble')) {
        throw error;
      }
      console.error('Error detallado al extraer PDF:', errorMessage);
      throw new Error(`Error al extraer texto del PDF: ${errorMessage}`);
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    let text = '';
    
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
      
      if (typeof text !== 'string') {
        text = String(text);
      }
      
      text = this.normalizeText(text);
    } catch (rawTextError) {
      console.warn('Error al extraer texto raw del DOCX, intentando HTML:', rawTextError);
    }

    if (!this.hasValidText(text)) {
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
        console.warn('Error al intentar extraer HTML del DOCX:', htmlError);
      }
    }
    
    if (!this.hasValidText(text)) {
      console.warn(`DOCX sin texto extraíble. Texto crudo: "${text.substring(0, 100)}"`);
      throw new Error('Documento Word sin texto extraíble');
    }

    return {
      pageContent: text,
      fileType: 'docx',
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

      if (!this.hasValidText(text)) {
        console.warn(`Excel sin contenido extraíble. Texto crudo: "${text.substring(0, 100)}"`);
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

  private async extractFromText(buffer: Buffer): Promise<ExtractionResult> {
    try {
      let text = buffer.toString('utf-8');
      text = this.normalizeText(text);

      if (!this.hasValidText(text)) {
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
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private hasValidText(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return false;
    }
    
    const nonWhitespaceChars = trimmed.replace(/\s/g, '').length;
    
    return nonWhitespaceChars >= 3;
  }

  validateExtractionResult(result: ExtractionResult): void {
    if (!result.pageContent || !this.hasValidText(result.pageContent)) {
      throw new Error('No se pudo extraer texto del archivo');
    }
  }
}
