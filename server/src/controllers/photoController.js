const prisma = require('../prisma');
const { photoPath, removePhotoFile } = require('../middleware/upload');

// Progress photos of projects. Uploading and deleting are for the admin;
// viewing is public. Photos of a project the public cannot see (proposed, rejected,
// archived) are only listed to the admin and the chairman, since that page is hidden.

// The fields sent to the browser (never the stored file name).
const PHOTO_FIELDS = {
  id: true,
  caption: true,
  uploadedByName: true,
  createdAt: true,
  projectId: true,
  eventId: true,
};

async function savePhotos(req, res, target) {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ message: 'Choose at least one photo to upload' });
  }
  const caption = String(req.body.caption || '').trim().slice(0, 200) || null;
  await prisma.photo.createMany({
    data: files.map((f) => ({
      ...target,
      caption,
      fileName: f.filename,
      mimeType: f.mimetype,
      uploadedByName: req.user.name,
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

// POST /api/projects/:id/photos — admin. multipart: photos (up to 6) + caption.
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

// DELETE /api/photos/:id — admin.
async function deletePhoto(req, res, next) {
  try {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
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
