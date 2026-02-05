import { ReceiptData } from '../types/receipt.js';
import { logger } from '../config/logger.js';

export class ReceiptParser {
  /**
   * Helper para limpiar precios (ej: "$1,200.50" -> 1200.50)
   */
  private static parsePrice(text: string): number | undefined {
    // 1. Buscamos números que parezcan precios
    // Explicación Regex:
    // [\d,]+   -> Busca dígitos (0-9) o comas, uno o más veces.
    // \.       -> Busca un punto literal.
    // \d{2}    -> Busca exactamente 2 decimales.
    const match = text.match(/([\d,]+\.\d{2})/);

    if (match) {
      // Quitamos las comas (ej: "1,000" -> "1000") para que parseFloat funcione
      const cleanString = match[1].replace(/,/g, '');
      const number = parseFloat(cleanString);
      return isNaN(number) ? undefined : number;
    }
    return undefined;
  }

  /**
   * Método principal de análisis
   */
  static parse(rawText: string): ReceiptData {
    logger.info('[Parser] Parsing receipt data...');

    // Inicializamos el objeto vacío
    const data: ReceiptData = {
      rawText,
    };

    // 1. PRE-PROCESAMIENTO
    // Dividimos el texto en líneas para analizarlo ordenadamente
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // 2. EXTRACCIÓN: VENDOR NAME (Nombre del Vendedor)
    // Heurística: La primera línea que no esté vacía suele ser el nombre de la tienda.
    if (lines.length > 0) {
      data.vendorName = lines[0];
    }

    // 3. EXTRACCIÓN: FECHA
    // Regex: Busca DD/MM/YYYY o YYYY-MM-DD
    // \d{1,4} -> 1 a 4 dígitos
    // [-/.]   -> Separadores permitidos
    const dateMatch = rawText.match(/(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})/);
    if (dateMatch) {
      data.date = dateMatch[0];
    }

    // 4. EXTRACCIÓN: INVOICE / FACTURA
    // Regex: Busca palabras clave como Invoice, Folio, Ticket seguidas de letras/números
    const invoiceMatch = rawText.match(/(?:invoice|factura|folio|ticket|recibo)\s*[:#]?\s*([A-Z0-9-]+)/i);
    if (invoiceMatch) {
      data.invoiceNumber = invoiceMatch[1];
    }

    // 5. EXTRACCIÓN: IMPORTES (Total, Subtotal, Impuestos)
    // Buscamos línea por línea patrones de dinero

    // Convertimos a minúsculas una sola vez para buscar palabras clave sin preocuparnos por mayúsculas
    const lowerText = rawText.toLowerCase();

    // A. TOTAL
    // Buscamos explícitamente la palabra "total" seguida de un número
    const totalMatch = rawText.match(/total[\s\w]*[:$]?\s*([\d,]+\.\d{2})/i);
    if (totalMatch) {
      data.amount = this.parsePrice(totalMatch[1]);
    }

    // B. SUBTOTAL
    const subtotalMatch = rawText.match(/(?:subtotal|sub-total)[\s\w]*[:$]?\s*([\d,]+\.\d{2})/i);
    if (subtotalMatch) {
      data.subtotalAmount = this.parsePrice(subtotalMatch[1]);
    }

    // C. IMPUESTOS (Tax / IVA)
    const taxMatch = rawText.match(/(?:tax|iva|impuesto|vat)[\s\w]*[:$]?\s*([\d,]+\.\d{2})/i);
    if (taxMatch) {
      data.taxAmount = this.parsePrice(taxMatch[1]);
    }

    // 6. HEURÍSTICA DE RESPALDO (FALLBACK) PARA EL TOTAL
    // Si no encontramos la palabra "TOTAL", buscamos todos los números con formato de precio
    // y asumimos que el más grande es el total.
    if (!data.amount) {
      const allPrices: number[] = [];
      // Regex global (/g) para encontrar todos los precios en el texto
      const priceRegex = /[\$]?\s*([\d,]+\.\d{2})/g;
      let match;

      while ((match = priceRegex.exec(rawText)) !== null) {
        const price = this.parsePrice(match[1]);
        if (price) allPrices.push(price);
      }

      if (allPrices.length > 0) {
        // Math.max(...array) encuentra el número más grande
        data.amount = Math.max(...allPrices);
        logger.info(`[Parser] Total word not found. Using max value heuristic: ${data.amount}`);
      }
    }

    return data;
  }
}