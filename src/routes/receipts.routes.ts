import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID as uuidv4 } from 'crypto';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { getOcrProvider } from '../services/ocr.service.js';
import { ReceiptParser } from '../services/parser.service.js';
import { ReceiptResult } from '../types/receipt.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

// Setup multer for file uploads
const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only images and PDFs are allowed'));
    }
  },
});

// In-memory storage (for simplicity)
const receipts = new Map<string, ReceiptResult>();

/**
 * POST /api/receipts
 * Upload a receipt image/PDF and extract information
 * TODO: Implement the endpoint
 * 1. Validate file upload
 * 2. Extract text using OCR
 * 3. Parse the extracted text
 * 4. Store the result
 * 5. Return the parsed data
 */
router.post('/api/receipts', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }

    logger.info(`[Receipt] Processing file: ${req.file.originalname}`);

    //Generar ID único
    const id = uuidv4();

    //Instancia el servicio de OCR (lee .env para saber si es mock o tesseract)
    const ocrProvider = getOcrProvider(config.ocrProvider);

    //Extraer texto 
    const rawText = await ocrProvider.extractText(req.file.path);

    //Analizar el texto 
    const parsedData = ReceiptParser.parse(rawText);

    //Construir el objeto final
    const receiptResult: ReceiptResult = {
      id,
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString(), //Fecha actual
      data: parsedData,       //Datos extraídos (amount, vendor, etc.)
    };

    //Guardar en memoria
    receipts.set(id, receiptResult);
    logger.info(`[Receipt] Successfully processed receipt ${id}`);

    /*
      LIMPIEZA: Borrar el archivo temporal para no llenar el disco 
      Usamos unlink de forma asíncrona y no bloqueante
     */
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      logger.warn(`[Receipt] Failed to delete temp file: ${req.file.path}`);
    }

    // Responder al cliente
    res.status(201).json(receiptResult);

  } catch (error) {
    logger.error(`[Receipt] Error uploading receipt: ${error}`);
    // Si algo falló y el archivo se quedó almacenado, se intenta borrar por seguridad
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch { }
    }

    const appError = error instanceof AppError ? error : new AppError(500, 'Failed to process receipt');
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * GET /api/receipts/:id
 * Retrieve a previously processed receipt
 */
router.get('/api/receipts/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const receipt = receipts.get(id);

    if (!receipt) {
      throw new AppError(404, 'Receipt not found');
    }

    res.json(receipt);
  } catch (error) {
    logger.error(`[Receipt] Error fetching receipt: ${error}`);
    const appError = error instanceof AppError ? error : new AppError(500, 'Failed to fetch receipt');
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * GET /api/receipts
 * List all processed receipts
 */
router.get('/api/receipts', (req: Request, res: Response) => {
  try {
    const receiptsList = Array.from(receipts.values());
    res.json(receiptsList);
  } catch (error) {
    logger.error(`[Receipt] Error listing receipts: ${error}`);
    res.status(500).json({ error: 'Failed to list receipts' });
  }
});

export default router;
