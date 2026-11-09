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

// ---------- Progress photos (public) ----------

const PHOTO_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_PHOTOS = 10;

const photoUploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PHOTO_DIR),
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (PHOTO_TYPES[file.mimetype] || '')),
  }),
  limits: { fileSize: MAX_SIZE, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) => {
    if (!PHOTO_TYPES[file.mimetype]) {
      const err = new Error('Pictures must be JPG, JPEG, PNG or WEBP images');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Reads up to 10 images from the form field "photos".
function photoUpload(req, res, next) {
  photoUploader.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (!err) return next();
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Each picture must be 5 MB or smaller';
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `You can upload up to ${MAX_PHOTOS} pictures at a time`;
    }
    next(err);
  });
}

// One image from the given form field: a profile picture ("photo") or the SK logo ("logo").
function singleImage(field) {
  return (req, res, next) => {
    photoUploader.single(field)(req, res, (err) => {
      if (!err) return next();
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The picture must be 5 MB or smaller';
      if (err.code === 'LIMIT_UNEXPECTED_FILE') err.message = 'Upload one picture';
      next(err);
    });
  };
}

function photoPath(fileName) {
  return path.join(PHOTO_DIR, path.basename(fileName));
}

function removePhotoFile(fileName) {
  if (!fileName) return;
  fs.unlink(photoPath(fileName), () => {});
}

module.exports = {
  receiptUpload,
  receiptPath,
  removeReceiptFile,
  photoUpload,
  avatarUpload: singleImage('photo'),
  logoUpload: singleImage('logo'),
  photoPath,
  removePhotoFile,
  MAX_PHOTOS,
};
