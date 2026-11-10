import api from '../api/axios';

// An official's round picture: the profile picture they uploaded in Settings (through
// their own account), otherwise the first letter of their name.
// className sets the size and ring; letterClass the style of the letter.
export default function OfficialAvatar({ official, className = 'h-12 w-12', letterClass = 'text-brand-700 font-bold' }) {
  const photo = official?.accountPhoto
    ? `${api.defaults.baseURL}/auth/avatar/${official.accountPhoto.userId}?v=${official.accountPhoto.version}`
    : null;
  if (photo) {
    return <img src={photo} alt="" className={`shrink-0 rounded-full bg-white object-cover ${className}`} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 ${letterClass} ${className}`}>
      {official?.name?.charAt(0) || '?'}
    </div>
  );
}
