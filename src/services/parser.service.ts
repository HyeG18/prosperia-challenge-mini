import { ReceiptData } from '../types/receipt.js';
import { logger } from '../config/logger.js';

export class ReceiptParser {

  /**
   * Determina si un año es válido (no en el futuro lejano, no muy antiguo)
   */
  private static isValidDate(dateStr: string): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();
    const match = dateStr.match(/(\d{4})/);
    if (!match) return false;
    const year = parseInt(match[1]);

    // Permitimos hasta el año actual + 1 por temas de zona horaria o error leve
    return year >= 2000 && year <= currentYear + 1;
  }

  /**
   * Parsea precios manejando formatos internacionales:
   * Usa heurística de "3 dígitos" para distinguir miles de decimales.
   */
  private static parsePrice(text: string): number | undefined {
    // Limpieza: solo dejamos números, puntos y comas
    let cleanText = text.replace(/[^\d.,]/g, '').trim();
    // Quitamos puntuación final suelta (error OCR)
    cleanText = cleanText.replace(/[.,]+$/, '');

    if (!cleanText) return undefined;

    const hasComma = cleanText.includes(',');
    const hasDot = cleanText.includes('.');
    let normalizedNum = cleanText;

    if (hasComma && hasDot) {
      // Si tiene ambos, el último es el decimal
      const lastComma = cleanText.lastIndexOf(',');
      const lastDot = cleanText.lastIndexOf('.');
      if (lastComma > lastDot) {
        normalizedNum = cleanText.replace(/\./g, '').replace(',', '.'); // Europa/VE
      } else {
        normalizedNum = cleanText.replace(/,/g, ''); // US/Panamá
      }
    }
    else if (hasComma || hasDot) {
      // Si tiene solo uno, usamos la regla de los 3 dígitos
      const separator = hasComma ? ',' : '.';
      const parts = cleanText.split(separator);
      const lastPart = parts[parts.length - 1];

      if (lastPart.length === 3) {
        // "1.272" -> Probablemente miles
        normalizedNum = cleanText.replace(new RegExp(`\\${separator}`, 'g'), '');
      } else {
        // "50.00" o "12.5" -> Probablemente decimal
        normalizedNum = cleanText.replace(/,/g, '.');
      }
    }

    const number = parseFloat(normalizedNum);
    return isNaN(number) ? undefined : number;
  }

  static parse(rawText: string): ReceiptData {
    logger.info('[Parser] Parsing receipt data...');

    const data: ReceiptData = { rawText };

    // 1. LIMPIEZA DE LÍNEAS
    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      // Filtramos líneas muy cortas o sin contenido alfanumérico útil
      .filter(line => line.length > 3 && /[a-zA-Z0-9]/.test(line));

    // 2. VENDOR NAME (Lista negra y validación)
    const skipWords = [
      'BIENVENIDO', 'WELCOME', 'FACTURA', 'INVOICE', 'SENIAT', 'DGI',
      'RUC', 'RIF', 'NIT', 'FISCAL', 'ORIGINAL', 'COPIA', 'CLIENTE'
    ];

    for (const line of lines) {
      const upperLine = line.toUpperCase();
      // El nombre suele ser corto y no debe contener palabras clave fiscales
      if (!skipWords.some(word => upperLine.includes(word)) &&
        !upperLine.match(/^(CALLE|AV|JR)\.?\s/) &&
        line.length < 50) {
        data.vendorName = line;
        break;
      }
    }

    // 3. FECHA
    const dateRegex = /(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4})/;
    const allDateMatches = rawText.match(new RegExp(dateRegex, 'g')) || [];

    for (const dateStr of allDateMatches) {
      if (this.isValidDate(dateStr)) {
        data.date = dateStr;
        break;
      }
    }

    // Fallback: Si el OCR leyó mal el año (ej: 2026), intentamos corregirlo al actual
    if (!data.date && allDateMatches.length > 0) {
      const badDate = allDateMatches[0];
      if (badDate) {
        const currentYear = new Date().getFullYear();
        data.date = badDate.replace(/202[6-9]/, `${currentYear}`);
      }
    }

    // 4. FACTURA / INVOICE
    const invoiceMatch = rawText.match(/(?:factura|invoice|ticket|folio|chk|numero)\s*[:#.]?\s*([A-Z0-9-]+)/i);
    if (invoiceMatch) data.invoiceNumber = invoiceMatch[1];

    // 5. IMPORTES
    // Patrón genérico de número (soporta 1.000,00 o 1,000.00)
    const numberPattern = "([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)";

    // TAX / IVA
    const taxRegex = new RegExp(`(?:tax|iva|impuesto|itbms|vat)[^0-9\\n]*[:$]?\\s*${numberPattern}`, 'i');
    const taxMatch = rawText.match(taxRegex);
    if (taxMatch) data.taxAmount = this.parsePrice(taxMatch[1]);

    // SUBTOTAL
    const subtotalRegex = new RegExp(`(?:subtotal|sub-total)[^0-9\\n]*[:$]?\\s*${numberPattern}`, 'i');
    const subtotalMatch = rawText.match(subtotalRegex);
    if (subtotalMatch) data.subtotalAmount = this.parsePrice(subtotalMatch[1]);

    // TOTAL
    const totalRegex = new RegExp(`(?:total|pagar|amount|suma)[^0-9\\n]*[:$]?\\s*${numberPattern}`, 'i');
    const totalMatch = rawText.match(totalRegex);
    if (totalMatch) data.amount = this.parsePrice(totalMatch[1]);

    // 6. FALLBACK PARA TOTAL (Busca el monto mayor)
    if (!data.amount) {
      const fallbackRegex = new RegExp(`\\b${numberPattern}\\b`, 'g');
      const matches = rawText.match(fallbackRegex);

      if (matches) {
        const numericPrices = matches
          .map(p => this.parsePrice(p))
          .filter(p => p !== undefined && p > 0) as number[];

        if (numericPrices.length > 0) {
          data.amount = Math.max(...numericPrices);
        }
      }
    }

    return data;
  }
}