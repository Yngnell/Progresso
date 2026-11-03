import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from 'lucide-react';
import { photosApi } from '../api/photos';
import { Button } from './ui';
import { formatDate } from '../utils/format';

// Grid of progress photos with a click-to-enlarge viewer.
// target:   { projectId }; when given with canUpload, shows the upload box.
// onChange: called after an upload or a delete so the page can refetch.
export default function PhotoGallery({ photos = [], target, canUpload = false, onChange, emptyText }) {
  const [open, setOpen] = useState(null); // index of the photo shown large

  return (
    <div>
      {canUpload && target && <UploadBox target={target} onDone={onChange} />}

      {photos.length === 0 ? (
        <p className="text-slate-600">{emptyText || 'No photos yet.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label={`Open photo${p.caption ? `: ${p.caption}` : ''}`}
              >
                <img
                  src={photosApi.url(p.id)}
                  alt={p.caption || 'Project photo'}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </button>
              {p.caption && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{p.caption}</p>}
              <p className="text-xs text-slate-500">{formatDate(p.createdAt)}</p>
              {canUpload && <DeleteButton photo={p} onDone={onChange} />}
            </li>
          ))}
        </ul>
      )}

      {open !== null && photos[open] && (
        <Viewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function UploadBox({ target, onDone }) {
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  async function upload() {
    setError('');
    setProgress(0);
    try {
      await photosApi.upload(target, files, caption.trim(), setProgress);
      setFiles([]);
      setCaption('');
      if (input.current) input.current.value = '';
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'The photos could not be uploaded.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary cursor-pointer px-4 py-2 text-[15px]">
          <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
          Choose photos
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 6))}
          />
        </label>
        <span className="text-sm text-slate-600">
          {files.length ? `${files.length} selected` : 'JPG, PNG or WebP, up to 6 at a time, 5 MB each'}
        </span>
      </div>
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="label">Caption (optional)</span>
            <input
              className="input"
              maxLength={200}
              placeholder="e.g. Week 2: court lines repainted"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <Button variant="primary" onClick={upload} disabled={progress !== null}>
            {progress !== null ? `Uploading… ${progress}%` : 'Upload'}
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DeleteButton({ photo, onDone }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm('Delete this photo? It will be removed from the public site.')) return;
    setBusy(true);
    try {
      await photosApi.remove(photo.id);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-red-700 shadow-card hover:bg-white"
      aria-label="Delete photo"
    >
      <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function Viewer({ photos, index, onIndex, onClose }) {
  const photo = photos[index];
  const many = photos.length > 1;
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (many && e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      if (many && e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, many, photos.length, onClose, onIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onClick={onClose}
    >
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Close">
          <X size={26} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
        {many && (
          <button
            type="button"
            onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
            className="rounded-md p-2 text-white hover:bg-white/10"
            aria-label="Previous photo"
          >
            <ChevronLeft size={30} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        <img
          src={photosApi.url(photo.id)}
          alt={photo.caption || 'Photo'}
          className="max-h-full min-w-0 max-w-full rounded-lg object-contain"
        />
        {many && (
          <button
            type="button"
            onClick={() => onIndex((index + 1) % photos.length)}
            className="rounded-md p-2 text-white hover:bg-white/10"
            aria-label="Next photo"
          >
            <ChevronRight size={30} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-white" onClick={(e) => e.stopPropagation()}>
        {photo.caption && <span className="font-semibold">{photo.caption}</span>}
        <span className="text-brand-100">
          {photo.caption ? ' · ' : ''}
          {formatDate(photo.createdAt)}
          {many ? ` · ${index + 1} of ${photos.length}` : ''}
        </span>
      </p>
    </div>
  );
}
