const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Receipts live outside the public web root and are only served through an
// authenticated route (see projectController.getReceipt).
const RECEIPT_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');
fs.mkdirSync(RECEIPT_DIR, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPT_DIR),
    // Random name: the original name never touches the disk path.
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + (ALLOWED_TYPES[file.mimetype] || '')),
  }),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      const err = new Error('The receipt must be a JPG, PNG or WebP image, or a PDF');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Reads one file from the form field "receipt" and turns upload problems into
// readable 400 responses.
function receiptUpload(req, res, next) {
  upload.single('receipt')(req, res, (err) => {
    if (!err) return next();
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The receipt must be 5 MB or smaller';
    next(err);
  });
}

// Absolute path of a stored receipt (basename only, so a name can never escape the folder).
function receiptPath(fileName) {
  return path.join(RECEIPT_DIR, path.basename(fileName));
}

// Removes a stored receipt; a missing file is not an error.
function removeReceiptFile(fileName) {
  if (!fileName) return;
  fs.unlink(receiptPath(fileName), () => {});
}

module.exports = { receiptUpload, receiptPath, removeReceiptFile };
