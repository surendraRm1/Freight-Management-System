const multer = require('multer');

const storage = multer.memoryStorage();
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.KYC_MAX_FILE_SIZE || `${5 * 1024 * 1024}`, 10), // default 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload PDF or image files only.'));
    }
    return cb(null, true);
  },
});

module.exports = upload;
