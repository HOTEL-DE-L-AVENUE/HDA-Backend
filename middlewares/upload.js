// middlewares/upload.js
// Upload générique de fichiers (photos, pièces d'identité, contrats, devis...)
// stockés sur disque local et servis statiquement depuis /uploads (voir server.js).
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      // Une simple Error (pas MulterError) pour que le message personnalisé
      // survive : MulterError ignore le message fourni et le remplace par un
      // texte générique basé sur son code.
      return cb(new Error('Type de fichier non autorisé (images ou PDF uniquement)'));
    }
    cb(null, true);
  },
});

module.exports = { upload, UPLOAD_DIR };
