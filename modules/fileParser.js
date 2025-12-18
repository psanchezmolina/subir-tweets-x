/**
 * File Parser para CSV y Excel
 *
 * Parsea archivos CSV y Excel (.xlsx, .xls) y los convierte en
 * un formato estándar para la aplicación.
 *
 * Formato esperado:
 * - texto (obligatorio)
 * - thread_id (opcional)
 * - fecha_publicacion (obligatorio)
 * - imagen_url (opcional)
 */

const Papa = require('papaparse');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class FileParser {
  /**
   * Parsear archivo (CSV o Excel)
   * @param {string} filePath - Ruta absoluta del archivo
   * @returns {Array} - Array de objetos validados
   */
  parse(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error('El archivo no existe');
    }

    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.csv') {
      return this.parseCSV(filePath);
    } else if (['.xlsx', '.xls'].includes(extension)) {
      return this.parseExcel(filePath);
    } else {
      throw new Error(`Formato no soportado: ${extension}. Solo CSV y Excel (.xlsx, .xls)`);
    }
  }

  /**
   * Parsear archivo CSV
   * @param {string} filePath - Ruta del archivo CSV
   * @returns {Array} - Datos parseados y validados
   */
  parseCSV(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase()
      });

      if (result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Fila ${e.row}: ${e.message}`).join(', ');
        throw new Error(`Errores al parsear CSV: ${errorMessages}`);
      }

      return this.validate(result.data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Archivo no encontrado');
      }
      throw error;
    }
  }

  /**
   * Parsear archivo Excel
   * @param {string} filePath - Ruta del archivo Excel
   * @returns {Array} - Datos parseados y validados
   */
  parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas');
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        throw new Error('La hoja de Excel está vacía');
      }

      // Normalizar nombres de columnas a minúsculas
      const normalized = data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
          newRow[key.trim().toLowerCase()] = row[key];
        });
        return newRow;
      });

      return this.validate(normalized);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Archivo no encontrado');
      }
      throw error;
    }
  }

  /**
   * Validar datos parseados
   * @param {Array} data - Datos parseados del archivo
   * @returns {Array} - Datos validados y normalizados
   */
  validate(data) {
    if (!data || data.length === 0) {
      throw new Error('El archivo está vacío o no contiene datos válidos');
    }

    const firstRow = data[0];
    const requiredColumns = ['texto', 'fecha_publicacion'];

    // Verificar columnas obligatorias
    for (const col of requiredColumns) {
      if (!(col in firstRow)) {
        throw new Error(`Falta la columna obligatoria: "${col}". Columnas encontradas: ${Object.keys(firstRow).join(', ')}`);
      }
    }

    // Validar cada fila
    const validatedData = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 porque Excel empieza en 1 y tiene header

      // Validar texto
      if (!row.texto || typeof row.texto !== 'string' || row.texto.trim() === '') {
        throw new Error(`Fila ${rowNumber}: El campo "texto" no puede estar vacío`);
      }

      const texto = row.texto.trim();

      if (texto.length > 280) {
        throw new Error(`Fila ${rowNumber}: El texto excede 280 caracteres (actual: ${texto.length})`);
      }

      // Validar fecha
      if (!row.fecha_publicacion) {
        throw new Error(`Fila ${rowNumber}: El campo "fecha_publicacion" es obligatorio`);
      }

      const fecha = this.parseDate(row.fecha_publicacion);
      if (!fecha || isNaN(fecha.getTime())) {
        throw new Error(`Fila ${rowNumber}: Fecha inválida "${row.fecha_publicacion}". Formato esperado: YYYY-MM-DD HH:MM`);
      }

      // Normalizar thread_id (puede estar vacío)
      const thread_id = row.thread_id && String(row.thread_id).trim() !== ''
        ? String(row.thread_id).trim()
        : null;

      // Normalizar imagen_url (puede estar vacío)
      const imagen_url = row.imagen_url && String(row.imagen_url).trim() !== ''
        ? String(row.imagen_url).trim()
        : null;

      // Validar URL de imagen si existe
      if (imagen_url && !this.isValidUrl(imagen_url)) {
        throw new Error(`Fila ${rowNumber}: La URL de imagen no es válida: "${imagen_url}"`);
      }

      validatedData.push({
        texto,
        thread_id,
        fecha_publicacion: fecha.toISOString(),
        imagen_url
      });
    });

    console.log(`✓ Archivo validado: ${validatedData.length} tweets cargados`);

    return validatedData;
  }

  /**
   * Parsear fecha flexible
   * @param {string|Date} dateInput - Fecha en múltiples formatos
   * @returns {Date} - Objeto Date
   */
  parseDate(dateInput) {
    if (dateInput instanceof Date) {
      return dateInput;
    }

    // Intentar parsear directamente
    let date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Intentar formato DD/MM/YYYY HH:MM
    const parts = String(dateInput).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (parts) {
      const [, day, month, year, hour, minute] = parts;
      date = new Date(year, month - 1, day, hour, minute);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  /**
   * Validar si una string es una URL válida
   * @param {string} url - URL a validar
   * @returns {boolean}
   */
  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Analizar tweets por thread
   * @param {Array} tweets - Array de tweets validados
   * @returns {Object} - Estadísticas: { totalTweets, threadsCount, individualTweets }
   */
  analyzeThreads(tweets) {
    const threads = new Set();
    let individualTweets = 0;

    tweets.forEach(tweet => {
      if (tweet.thread_id) {
        threads.add(tweet.thread_id);
      } else {
        individualTweets++;
      }
    });

    return {
      totalTweets: tweets.length,
      threadsCount: threads.size,
      individualTweets
    };
  }
}

module.exports = FileParser;
