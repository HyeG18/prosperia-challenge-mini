import Tesseract from 'tesseract.js';
import { logger } from '../config/logger.js';
import fs from 'fs/promises';
import { createRequire } from 'module';

/**
 * SOLUCIÓN DE COMPATIBILIDAD (ESM vs CommonJS):
 * Node.js moderno usa 'import', pero 'pdf-parse' es una librería antigua (CommonJS).
 * Al importarla directamente con 'import', Node v22 intenta buscar un 'default export' que no existe.
 * * 'createRequire' nos permite construir una función 'require()' personalizada
 * para cargar librerías antiguas dentro de este módulo moderno sin errores.
 */
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse'); 

export interface OcrProvider {
  extractText(imagePath: string): Promise<string>;
}

export class TesseractOcr implements OcrProvider {

  async extractText(filePath: string): Promise<string> {
    logger.info(`[OCR] Processing file at ${filePath}...`);

    try {
      // Leemos el archivo como un Buffer (datos binarios crudos) en lugar de texto.
      // Esto es necesario para poder inspeccionar los bytes de cabecera.
      const fileBuffer = await fs.readFile(filePath);

      /**
       * DETECCIÓN ROBUSTA DE TIPO (Magic Bytes):
       * No confiamos en la extensión del archivo (ej. .png, .pdf) ya que el usuario puede cambiarla.
       * Inspeccionamos los primeros 5 bytes (cabecera) del archivo real.
       * * - Si los bytes son "%PDF-", el archivo es garantizado un PDF real.
       * - Si no, asumimos que es una imagen y dejamos que Tesseract intente procesarlo.
       */
      const isPdfHeader = fileBuffer.subarray(0, 5).toString() === '%PDF-';

      if (isPdfHeader) {
        return await this.processPdf(fileBuffer);
      } else {
        return await this.processImage(filePath);
      }

    } catch (error) {
      logger.error(`[OCR] Error extracting text: ${error}`);
      throw error;
    }
  }

  private async processImage(imagePath: string): Promise<string> {
    logger.info('[OCR] Image detected. Using Tesseract engine...');
    const result = await Tesseract.recognize(imagePath, 'eng+spa');
    return result.data.text;
  }

  private async processPdf(dataBuffer: Buffer): Promise<string> {
    logger.info('[OCR] PDF detected. Extracting text layer...');

    // Gracias al 'require' manual del inicio, 'pdf' es ahora la función constructora correcta.
    // Le pasamos el Buffer directamente para extraer el texto de la capa de datos.
    const data = await pdf(dataBuffer);

    logger.info(`[OCR] PDF extraction complete. Info: ${data.info?.Title || 'No title'}`);
    return data.text.trim();
  }
}

export class MockOcr implements OcrProvider {
  async extractText(_imagePath: string): Promise<string> {
    logger.info('[OCR] Using mock OCR provider');
    // Return sample receipt text for testing
    return `SUPERMARKET ABC
    123 Main Street
    Invoice #INV-2024-001
    Date: 2024-01-15
    
    Item 1: $50.00
    Item 2: $30.00
    ─────────────────
    Subtotal: $80.00
    Tax (10%): $8.00
    ─────────────────
    TOTAL: $88.00
    
    Thank you for your purchase!`;
  }
}

export function getOcrProvider(provider: string): OcrProvider {
  if (provider === 'tesseract') {
    return new TesseractOcr();
  }
  return new MockOcr();
}
