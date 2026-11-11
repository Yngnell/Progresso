const prisma = require('../prisma');
const { photoPath, removePhotoFile } = require('../middleware/upload');
const { isManager } = require('../utils/roles');

// Pictures of projects. The officials and the admin add them; the uploader, the SK
// Chairperson and the admin delete them; viewing is public. Pictures of a project the
// public cannot see (proposed, rejected, archived) are only listed to the SK side.

// The fields sent to the browser (never the stored file name).
const PHOTO_FIELDS = {
  id: true,
  caption: true,
  uploadedByName: true,
  uploadedById: true,
  createdAt: true,
  projectId: true,
  eventId: true,
};

// Captions arrive as "captions" (one per picture, same order as the files); a single
// "caption" still works and applies to every picture.
function captionsFor(body, count) {
  let list = body.captions;
  if (list === undefined) list = [];
  if (!Array.isArray(list)) list = [list];
  const shared = String(body.caption || '').trim();
  return Array.from({ length: count }, (_, i) => String(list[i] ?? shared).trim().slice(0, 200) || null);
}

async function savePhotos(req, res, target) {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ message: 'Choose at least one picture to upload' });
  }
  const captions = captionsFor(req.body, files.length);
  await prisma.photo.createMany({
    data: files.map((f, i) => ({
      ...target,
      caption: captions[i],
      fileName: f.filename,
      mimeType: f.mimetype,
      uploadedByName: req.user.name,
      uploadedById: req.user.id,
    })),
  });
  const photos = await prisma.photo.findMany({
    where: target,
    orderBy: { createdAt: 'desc' },
    select: PHOTO_FIELDS,
  });
  return res.status(201).json({ photos });
}

// Files that were saved before a request failed are removed again.
function discard(req) {
  (req.files || []).forEach((f) => removePhotoFile(f.filename));
}

// POST /api/projects/:id/photos — officials and admin. multipart: photos (up to 10)
// + captions (one per picture).
async function addProjectPhotos(req, res, next) {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      discard(req);
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.archivedAt) {
      discard(req);
      return res.status(400).json({ message: 'Archived projects cannot get new photos' });
    }
    await savePhotos(req, res, { projectId: project.id });
  } catch (err) {
    discard(req);
    next(err);
  }
}

// DELETE /api/photos/:id — the uploader or the SK Admin.
async function deletePhoto(req, res, next) {
  try {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
    const isUploader = photo.uploadedById && photo.uploadedById === req.user.id;
    if (!isUploader && !isManager(req.user)) {
      return res.status(403).json({ message: 'Only the uploader or the SK Admin can delete this picture.' });
    }
    await prisma.photo.delete({ where: { id: photo.id } });
    removePhotoFile(photo.fileName);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/photos/:id/file — the image itself. An <img> tag cannot send the login
// token, so files are served by their random id; who may see which photos is decided
// where they are listed (a hidden project's photos are only listed to the staff).
async function getPhotoFile(req, res, next) {
  try {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
    res.set('Cache-Control', 'public, max-age=86400');
    res.type(photo.mimeType);
    res.sendFile(photoPath(photo.fileName), (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'Photo file is missing' });
    });
  } catch (err) {
    next(err);
  }
}

// Photos shown on a project page.
async function photosForProject(projectId) {
  return prisma.photo.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: PHOTO_FIELDS,
  });
}

module.exports = {
  PHOTO_FIELDS,
  addProjectPhotos,
  deletePhoto,
  getPhotoFile,
  photosForProject,
};
