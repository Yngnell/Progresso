const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Receipt liquidation files live outside the public web root and are only served through
// an authenticated route (see projectController.getLiquidationFile).
const RECEIPT_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');
fs.mkdirSync(RECEIPT_DIR, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES = 10; // per upload

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPT_DIR),
    // Random name: the original name never touches the disk path.
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + (ALLOWED_TYPES[file.mimetype] || '')),
  }),
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      const err = new Error('Files must be JPG, PNG or PDF');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Reads up to 10 files from the form field "files" and turns upload problems into
// readable 400 responses.
function liquidationUpload(req, res, next) {
  upload.array('files', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Each file must be 5 MB or smaller';
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Upload up to ${MAX_FILES} files at a time`;
    }
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

// One image from the given form field (the SK logo, "logo").
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

// ---------- Project files (Forms 3, 6, 7 and 8) ----------
// One module for every project document: kept with the receipts (never public) and served
// only through the authenticated file route. PDF, DOCX, JPG and PNG, up to 10 MB each.

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PROJECT_FILE_TYPES = { 'application/pdf': '.pdf', [DOCX]: '.docx', 'image/jpeg': '.jpg', 'image/png': '.png' };
const PROJECT_FILE_MAX = 10 * 1024 * 1024;

// Some browsers send a Word file as a generic type; the .docx name decides then.
function projectFileType(file) {
  if (PROJECT_FILE_TYPES[file.mimetype]) return file.mimetype;
  const generic = ['application/octet-stream', 'application/zip', 'application/x-zip-compressed', ''];
  if (generic.includes(file.mimetype || '') && /.docx$/i.test(file.originalname || '')) return DOCX;
  return null;
}

const projectFileUploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPT_DIR),
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (PROJECT_FILE_TYPES[projectFileType(file)] || '')),
  }),
  limits: { fileSize: PROJECT_FILE_MAX, files: 2 },
  fileFilter: (_req, file, cb) => {
    const type = projectFileType(file);
    if (!type) {
      const err = new Error('Files must be PDF, DOCX, JPG or PNG');
      err.status = 400;
      return cb(err);
    }
    file.mimetype = type;
    cb(null, true);
  },
});

// Reads the named single-file fields, e.g. projectFiles(['file']) or
// projectFiles(['report', 'liquidation']). The files arrive in req.files[field][0].
function projectFiles(fields) {
  const handler = projectFileUploader.fields(fields.map((name) => ({ name, maxCount: 1 })));
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) return next();
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Each file must be 10 MB or smaller';
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') err.message = 'Upload one file per field';
      next(err);
    });
  };
}

// Every file a projectFiles() request carried (to remove them when the request is refused).
const uploadedFiles = (req) => Object.values(req.files || {}).flat();

module.exports = {
  liquidationUpload,
  receiptPath,
  removeReceiptFile,
  photoUpload,
  logoUpload: singleImage('logo'),
  officialPhotoUpload: singleImage('photo'),
  photoPath,
  removePhotoFile,
  MAX_PHOTOS,
  projectFiles,
  uploadedFiles,
  PROJECT_FILE_MAX,
};
