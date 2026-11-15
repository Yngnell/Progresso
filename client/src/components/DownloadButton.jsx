import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from './ui';

// "Download" for one section of a project (receipts, Purchase Request files, pictures).
//   empty:      no files yet: the button is disabled and says so
//   onDownload: async; makes and saves the file. While it runs the button shows "Preparing…".
//   onError:    gets a readable message if the download fails
export default function DownloadButton({ empty, onDownload, onError, label = 'Download' }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await onDownload();
    } catch (err) {
      onError?.(await errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button size="sm" variant="secondary" disabled={empty || busy} onClick={run} aria-busy={busy}>
        {busy ? (
          <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
        {busy ? 'Preparing…' : label}
      </Button>
      {empty && <span className="text-sm text-slate-500">No files to download.</span>}
      {busy && <span className="sr-only" role="status">Preparing the download…</span>}
    </div>
  );
}

// A failed blob request carries its JSON message inside a Blob.
async function errorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || 'The download could not be made.';
    } catch {
      return 'The download could not be made.';
    }
  }
  return data?.message || 'The download could not be made.';
}
