import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Check, X } from 'lucide-react';
import { Button } from './ui';

// "Take Photo" for File Upload. Opens the camera (the back camera on phones and tablets, the
// webcam on computers), shows a preview with Retake and Use Photo, and hands back a JPG File.
// Pages opened over plain http on a phone cannot use the live camera, so the phone's own
// camera app is opened instead. Without a camera, the message says to upload a file.

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const asPhotoFile = (blob) => new File([blob], `Photo_${stamp()}.jpg`, { type: 'image/jpeg' });

// Whether the live camera can be used here (it needs https or localhost).
export const canUseLiveCamera = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

// A picture from the phone's camera app can be PNG or HEIC: redraw it as a JPG.
export function toJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('not converted'))), 'image/jpeg', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not an image'));
    };
    img.src = url;
  });
}

function cameraMessage(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow the camera for this site in your browser settings, or upload a file instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Upload a file instead.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is being used by another app. Close it and try again, or upload a file instead.';
  }
  return 'The camera could not be opened. Upload a file instead.';
}

// initialPhoto: a JPG already taken with the phone's camera app (shown as the preview).
export default function CameraCapture({ initialPhoto = null, onUse, onCancel, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeRef = useRef(null);
  const runRef = useRef(0); // each camera start; an older one that finishes late is stopped
  const [mode, setMode] = useState(initialPhoto ? 'preview' : 'starting'); // starting | live | preview
  const [photo, setPhoto] = useState(initialPhoto); // the captured JPG
  const [photoUrl, setPhotoUrl] = useState(null);
  const live = canUseLiveCamera();

  function stop() {
    runRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setMode('starting');
    if (!live) {
      // The phone's camera app (also shows the file picker on computers without camera access).
      nativeRef.current?.click();
      return;
    }
    const run = ++runRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (run !== runRef.current) {
        stream.getTracks().forEach((t) => t.stop()); // closed or restarted meanwhile
        return;
      }
      streamRef.current = stream;
      setMode('live');
    } catch (err) {
      if (run === runRef.current) onError(cameraMessage(err));
    }
  }

  useEffect(() => {
    if (!initialPhoto) start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  }, [mode]);

  // The preview address lives exactly as long as the photo it shows.
  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function showPhoto(blob) {
    setPhoto(blob);
    setMode('preview');
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return onError('The photo could not be taken. Try again, or upload a file instead.');
      stop();
      showPhoto(blob);
    }, 'image/jpeg', 0.9);
  }

  return (
    <div className="space-y-3 rounded-control border border-line bg-slate-50 p-3">
      <input
        ref={nativeRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            toJpeg(f).then(showPhoto, () => onError('This picture could not be read. Take it again, or upload a file instead.'));
          } else if (mode === 'starting') onCancel();
        }}
      />
      {mode === 'live' && (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="aspect-video w-full rounded-control bg-ink object-contain"
          aria-label="Camera view"
        />
      )}
      {mode === 'preview' && photoUrl && (
        <img src={photoUrl} alt="Preview of the captured photo" className="max-h-80 w-full rounded-control bg-ink object-contain" />
      )}
      {mode === 'starting' && (
        <p className="text-sm text-slate-600" role="status">Opening the camera…</p>
      )}
      <div className="flex flex-wrap gap-2">
        {mode === 'live' && (
          <Button size="sm" onClick={capture}>
            <Camera size={16} aria-hidden="true" /> Capture
          </Button>
        )}
        {mode === 'preview' && (
          <>
            <Button size="sm" onClick={() => onUse(asPhotoFile(photo))}>
              <Check size={16} aria-hidden="true" /> Use Photo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setPhoto(null); start(); }}>
              <RotateCcw size={16} aria-hidden="true" /> Retake
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => { stop(); onCancel(); }}>
          <X size={16} aria-hidden="true" /> Cancel
        </Button>
      </div>
    </div>
  );
}
