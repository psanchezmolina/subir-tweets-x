/**
 * Upload Routes
 *
 * POST /api/upload - Subir archivo CSV/Excel con tweets
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/supabase');
const FileParser = require('../modules/fileParser');

// Configurar multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');

    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Nombre único: timestamp + nombre original
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Máx 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV y Excel (.csv, .xlsx, .xls)'));
    }
  }
});

/**
 * POST /api/upload
 * Subir archivo CSV/Excel y guardar tweets en base de datos
 */
router.post('/', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    filePath = req.file.path;

    console.log(`📁 Procesando archivo: ${req.file.originalname}`);
    console.log(`   Tamaño: ${(req.file.size / 1024).toFixed(2)} KB`);

    // Parsear archivo
    const fileParser = new FileParser();
    const tweets = fileParser.parse(filePath);

    // Analizar threads
    const analysis = fileParser.analyzeThreads(tweets);

    console.log(`📊 Análisis:`);
    console.log(`   Total tweets: ${analysis.totalTweets}`);
    console.log(`   Threads: ${analysis.threadsCount}`);
    console.log(`   Tweets individuales: ${analysis.individualTweets}`);

    // Guardar en base de datos
    const result = await db.createTweets(tweets);

    if (!result.success) {
      throw new Error(result.error || 'Error al guardar tweets en base de datos');
    }

    // Eliminar archivo temporal
    fs.unlinkSync(filePath);

    await db.createLog('info', `Archivo ${req.file.originalname} procesado: ${analysis.totalTweets} tweets cargados`);

    res.json({
      success: true,
      message: `${analysis.totalTweets} tweets cargados exitosamente`,
      data: {
        totalTweets: analysis.totalTweets,
        threadsCount: analysis.threadsCount,
        individualTweets: analysis.individualTweets,
        filename: req.file.originalname
      }
    });

  } catch (error) {
    console.error('Error processing upload:', error);

    // Eliminar archivo temporal si existe
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Retornar error detallado
    res.status(400).json({
      success: false,
      error: error.message || 'Error al procesar el archivo'
    });
  }
});

/**
 * POST /api/upload/test
 * Validar archivo sin guardarlo (preview)
 */
router.post('/test', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    filePath = req.file.path;

    // Solo parsear, no guardar
    const fileParser = new FileParser();
    const tweets = fileParser.parse(filePath);
    const analysis = fileParser.analyzeThreads(tweets);

    // Eliminar archivo temporal
    fs.unlinkSync(filePath);

    // Retornar preview de primeros 5 tweets
    const preview = tweets.slice(0, 5).map(t => ({
      texto: t.texto.length > 50 ? t.texto.substring(0, 50) + '...' : t.texto,
      thread_id: t.thread_id,
      fecha_publicacion: t.fecha_publicacion,
      tiene_imagen: !!t.imagen_url
    }));

    res.json({
      success: true,
      analysis,
      preview
    });

  } catch (error) {
    console.error('Error testing upload:', error);

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Error al validar el archivo'
    });
  }
});

module.exports = router;
