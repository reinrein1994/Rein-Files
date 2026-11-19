import {useState} from 'react';
import {Palmtree} from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ResilientImage({src, alt, className = '', fallbackLabel}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#e7f3ee] via-[#eef2f6] to-[#dfe8f2] text-[#0f8a65] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Palmtree className="w-8 h-8 mb-2 opacity-75" />
        <span className="text-xs font-medium text-gray-600 line-clamp-2 max-w-[200px]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
