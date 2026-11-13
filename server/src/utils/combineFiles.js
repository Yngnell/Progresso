const fs = require('fs');
const archiver = require('archiver');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Downloads of a project's files:
//   combinePdf - receipts or Purchase Request files as ONE PDF (oldest upload first). PDF files
//                keep their own pages; JPG and PNG images become pages of their own. Images are
//                embedded as they are (never re-compressed), so the original quality is kept.
//   sendZip    - the project's pictures as one ZIP (stored as they are, not re-compressed).

const A4 = [595.28, 841.89]; // points
const MARGIN = 24;

// "SK Basketball League 2026" -> "SK_Basketball_League_2026" (safe in every file system).
function fileBase(title) {
  const base = String(title || '')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 80);
  return base || 'Project';
}

// The real type from the first bytes (the stored type could be wrong).
function kindOf(bytes) {
  if (bytes.length > 4 && bytes.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x89 && bytes.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  return null;
}

// An image on its own page: A4, turned to landscape for wide images, scaled down only when it
// is larger than the page (the full-resolution image is still inside the PDF).
function addImagePage(out, image) {
  const landscape = image.width > image.height;
  const [W, H] = landscape ? [A4[1], A4[0]] : A4;
  const scale = Math.min((W - MARGIN * 2) / image.width, (H - MARGIN * 2) / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  const page = out.addPage([W, H]);
  page.drawImage(image, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
}

function addNotePage(out, font, text) {
  const page = out.addPage(A4);
  page.drawText(text, { x: MARGIN * 2, y: A4[1] - MARGIN * 3, size: 12, font, color: rgb(0.6, 0.1, 0.1), maxWidth: A4[0] - MARGIN * 4 });
}

// files: [{ path, originalName }] already in order. Returns the PDF as a Buffer.
async function combinePdf(files) {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  for (const file of files) {
    try {
      const buf = fs.readFileSync(file.path);
      const kind = kindOf(buf);
      // pdf-lib reads the whole underlying memory and ignores a Buffer's offset (small files
      // share Node's buffer pool), so give it a fresh copy of exactly the file's bytes.
      const bytes = new Uint8Array(buf);
      if (kind === 'pdf') {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else if (kind === 'jpg') {
        addImagePage(out, await out.embedJpg(bytes));
      } else if (kind === 'png') {
        addImagePage(out, await out.embedPng(bytes));
      } else {
        throw new Error('not a PDF, JPG or PNG file');
      }
    } catch (err) {
      // A missing or broken file must not stop the download: say so on its own page.
      const name = String(file.originalName || 'file').replace(/[^\x20-\x7E]/g, '?');
      addNotePage(out, font, `This file could not be added: ${name} (${err.code === 'ENOENT' ? 'the file is missing' : 'unreadable file'}).`);
    }
  }
  return Buffer.from(await out.save());
}

function sendPdf(res, buffer, name) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

// entries: [{ path, name }]. Streams the ZIP; files that are missing on disk are skipped.
function sendZip(res, entries, name) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  const zip = archiver('zip', { store: true });
  zip.on('error', (err) => res.destroy(err));
  zip.pipe(res);
  entries.forEach((e) => {
    if (fs.existsSync(e.path)) zip.file(e.path, { name: e.name });
  });
  return zip.finalize();
}

module.exports = { fileBase, combinePdf, sendPdf, sendZip };
