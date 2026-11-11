// An official's round initial (the first letter of their name). There are no profile
// pictures. className sets the size and ring; letterClass the style of the letter.
export default function OfficialAvatar({ official, className = 'h-12 w-12', letterClass = 'text-brand-700 font-bold' }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 ${letterClass} ${className}`}>
      {official?.name?.charAt(0) || '?'}
    </div>
  );
}
