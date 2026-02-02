# Muestras de Recibos para Pruebas

Esta carpeta contiene muestras de recibos reales que puedes usar para probar tu implementación de OCR.

## Archivos de Prueba

- **`panama-receipt.png`** - Recibo de Panamá en formato PNG. Contiene estructura estándar de recibo con montos, impuestos y datos del vendedor.

- **`Ingreso-Derma.jpg`** - Comprobante de ingreso en formato JPG. Recibo de servicio con detalles de ingresos.

- **`PDF-TEST.pdf`** - Documento PDF para probar la extracción de texto desde archivos PDF.

## Cómo Usar

1. Sube cualquiera de estos archivos a través de la interfaz web en `http://localhost:3000`
2. El OCR extraerá el texto del archivo
3. El analizador extrae los datos estructurados
4. Verifica los resultados

## Qué Esperar

### panama-receipt.png

- Recibo completo con información de vendedor
- Montos, subtotal, impuestos
- Información de pago
- Datos de facturación

### Ingreso-Derma.jpg

- Comprobante de ingreso/servicio
- Detalles de concepto de pago
- Monto e información fiscal

### PDF-TEST.pdf

- Documento PDF con información de transacción
- Prueba la capacidad de Tesseract para procesar PDFs

## Tips para Pruebas

1. **Comienza con PNG/JPG** - Son más fáciles de procesar que PDFs
2. **Verifica el OCR** - Mira el `rawText` para entender qué extrae Tesseract
3. **Prueba el Parser** - Verifica que se extraigan correctamente: amount, vendor, fecha
4. **Maneja Errores** - El OCR puede fallar en imágenes de mala calidad
5. **Idiomas Múltiples** - Estos recibos contienen texto en español e inglés

## Agregar Más Muestras

Si quieres agregar más recibos para pruebas:

1. Coloca las imágenes/PDFs en esta carpeta
2. Actualiza este README con descripciones
3. Prueba tu implementación con cada uno
