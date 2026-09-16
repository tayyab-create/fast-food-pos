import { useState, type ReactNode } from 'react';

interface ItemImageProps {
  src: string;
  className: string;
  /** What to show if the image fails to load; defaults to a neutral photo placeholder in the same box. */
  fallback?: ReactNode;
}

/** An <img> that never shows the browser's broken-image icon — a failed
 * load swaps in a quiet placeholder of the same size instead. */
export function ItemImage({ src, className, fallback }: ItemImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return fallback ?? (
      <span className={`${className} image-fallback`} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <img className={className} src={src} alt="" onError={() => setFailed(true)} />;
}
