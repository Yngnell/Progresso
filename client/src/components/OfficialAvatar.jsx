import { useState } from 'react';
import { officialsApi } from '../api/officials';

// An official's photo, or their round initial (the first letter of their name) when no
// photo was uploaded or it cannot be loaded. className sets the size and ring; letterClass
// the style of the letter.
export default function OfficialAvatar({ official, className = 'h-12 w-12', letterClass = 'text-brand-700 font-bold' }) {
  const [failed, setFailed] = useState(false);
  if (official?.hasPhoto && !failed) {
    return (
      <img
        src={officialsApi.photoUrl(official)}
        alt={official.name ? `Photo of ${official.name}` : 'Official photo'}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full bg-brand-100 object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 ${letterClass} ${className}`}>
      {official?.name?.charAt(0) || '?'}
    </div>
  );
}
