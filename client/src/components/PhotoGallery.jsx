import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, Upload, X } from 'lucide-react';
import { photosApi } from '../api/photos';
import { Button } from './ui';
import { formatDate } from '../utils/format';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

// Gallery grid of pictures with a larger view (Next / Previous).
// target:    { projectId }; with canUpload, shows the Add Pictures button.
// canDelete: (photo) => boolean; who may delete a picture (the uploader, the SK
//            Chairperson and the admin).
// onChange:  called after an upload or a delete so the page can refetch.
export default function PhotoGallery({ photos = [], target, canUpload = false, canDelete, onChange, emptyText }) {
  const [open, setOpen] = useState(null); // index of the picture shown large

  return (
    <div>
      {canUpload && target && <UploadBox target={target} onDone={onChange} />}

      {photos.length === 0 ? (
        <p className="text-slate-600">{emptyText || 'No pictures yet.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                aria-label={`Open picture${p.caption ? `: ${p.caption}` : ''}`}
              >
                <img
                  src={photosApi.url(p.id)}
                  alt={p.caption || 'Project picture'}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              </button>
              {p.caption && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{p.caption}</p>}
              <p className="text-xs text-slate-500">
                {formatDate(p.createdAt)}
                {p.uploadedByName ? ` · ${p.uploadedByName}` : ''}
              </p>
              {canDelete?.(p) && <DeleteButton photo={p} onDone={onChange} />}
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

// "Add Pictures": choose up to 10 images, see them before uploading, remove any, and give
// each an optional caption.
function UploadBox({ target, onDone }) {
  const input = useRef(null);
  const [items, setItems] = useState([]); // { key, file, url, caption }
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  // Free the preview images when the uploader goes away.
  const urls = useRef(new Set());
  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function release(item) {
    URL.revokeObjectURL(item.url);
    urls.current.delete(item.url);
  }

  function choose(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const problems = [];
    const ok = [];
    picked.forEach((file) => {
      if (!TYPES.includes(file.type)) problems.push(`${file.name}: only JPG, JPEG, PNG and WEBP pictures are accepted.`);
      else if (file.size > MAX_BYTES) problems.push(`${file.name}: larger than 5 MB.`);
      else ok.push(file);
    });
    const room = Math.max(0, MAX_FILES - items.length);
    if (ok.length > room) {
      problems.push(`Only ${MAX_FILES} pictures per upload: ${ok.length - room} were left out.`);
    }
    const added = ok.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { key: `${file.name}-${file.lastModified}-${Math.random()}`, file, url, caption: '' };
    });
    setItems((cur) => [...cur, ...added]);
    setError(problems.join(' '));
  }

  function removeItem(key) {
    setItems((cur) => {
      const it = cur.find((x) => x.key === key);
      if (it) release(it);
      return cur.filter((x) => x.key !== key);
    });
  }

  function clearAll() {
    items.forEach(release);
    setItems([]);
  }

  async function upload() {
    setError('');
    setProgress(0);
    try {
      await photosApi.upload(target, items, setProgress);
      clearAll();
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'The pictures could not be uploaded.');
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" onClick={() => input.current?.click()} disabled={busy || items.length >= MAX_FILES}>
          <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
          Add Pictures
        </Button>
        <span className="text-sm text-slate-600">
          JPG, JPEG, PNG or WEBP · up to 5 MB each · up to {MAX_FILES} at a time
        </span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={choose}
        />
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-4 rounded-card border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            {items.length} picture{items.length === 1 ? '' : 's'} ready to upload
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <li key={it.key} className="flex gap-3 rounded-lg bg-panel p-2 ring-1 ring-slate-200">
                <div className="relative shrink-0">
                  <img src={it.url} alt="" className="h-20 w-24 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    disabled={busy}
                    className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-700 shadow-card ring-1 ring-slate-200 hover:text-red-700"
                    aria-label={`Remove ${it.file.name}`}
                  >
                    <X size={14} strokeWidth={2.25} aria-hidden="true" />
                  </button>
                </div>
                <label className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-slate-600">{it.file.name}</span>
                  <input
                    className="input mt-1"
                    maxLength={200}
                    placeholder="Caption (optional)"
                    aria-label={`Caption for picture ${i + 1}`}
                    value={it.caption}
                    onChange={(e) =>
                      setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, caption: e.target.value } : x)))
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={upload} disabled={busy}>
              <Upload size={18} strokeWidth={1.75} aria-hidden="true" />
              {busy ? `Uploading… ${progress}%` : `Upload ${items.length} picture${items.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" onClick={clearAll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteButton({ photo, onDone }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm('Delete this picture? It will be removed from the project page.')) return;
    setBusy(true);
    try {
      await photosApi.remove(photo.id);
      onDone?.();
    } catch (err) {
      window.alert(err.response?.data?.message || 'The picture could not be deleted.');
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
      aria-label="Delete picture"
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
      aria-label="Picture"
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
            className="inline-flex items-center gap-1 rounded-md p-2 text-white hover:bg-white/10"
            aria-label="Previous picture"
          >
            <ChevronLeft size={30} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden text-sm font-semibold sm:inline">Previous</span>
          </button>
        )}
        <img
          src={photosApi.url(photo.id)}
          alt={photo.caption || 'Picture'}
          className="max-h-full min-w-0 max-w-full rounded-lg object-contain"
        />
        {many && (
          <button
            type="button"
            onClick={() => onIndex((index + 1) % photos.length)}
            className="inline-flex items-center gap-1 rounded-md p-2 text-white hover:bg-white/10"
            aria-label="Next picture"
          >
            <span className="hidden text-sm font-semibold sm:inline">Next</span>
            <ChevronRight size={30} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-white" onClick={(e) => e.stopPropagation()}>
        {photo.caption && <span className="font-semibold">{photo.caption}</span>}
        <span className="text-brand-100">
          {photo.caption ? ' · ' : ''}
          {formatDate(photo.createdAt)}
          {photo.uploadedByName ? ` · ${photo.uploadedByName}` : ''}
          {many ? ` · ${index + 1} of ${photos.length}` : ''}
        </span>
      </p>
    </div>
  );
}
