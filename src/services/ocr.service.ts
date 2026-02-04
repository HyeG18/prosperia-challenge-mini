import Tesseract from 'tesseract.js';
import { logger } from '../config/logger.js';

export interface OcrProvider {
  extractText(imagePath: string): Promise<string>;
}

export class TesseractOcr implements OcrProvider {
  async extractText(imagePath: string): Promise<string> {
    logger.info(`[OCR] Extracting text from ${imagePath} using Tesseract...`);

    try {
      // TODO: Implement Tesseract OCR extraction
      // 1. Use Tesseract.recognize() to process the image file
      // 2. Extract text from languages: 'eng+spa'
      // 3. Return the raw extracted text
      // 4. Handle errors appropriately
      //
      // Hint: Tesseract.recognize(imagePath, 'eng+spa').then(result => result.data.text)
      
      //1. Se implementa la llamada a Tesseract para la extraccion
      //Se extrae el texto de los idiomas 'eng+spa' dependiendo del idioma del archivo subido
      //Se retorna el texto extraido en una constante para su posterior manejo
      //4. Se manejan los errores apropiadamente
      const result = await Tesseract.recognize(imagePath, 'eng+spa');
      
      //2. Se extrae la data proveniente de la imagen proporcionada. 
      const text = result.data.text;

      //3. Log verificacion de funcionamiento del servicio.
      logger.info(`[OCR] Extraction complete. Length: ${text.length}`)
      
      return text;

      //throw new Error('TODO: Implement Tesseract OCR extraction');
    } catch (error) {
      logger.error(`[OCR] Error extracting text: ${error}`);
      throw error;
    }
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
