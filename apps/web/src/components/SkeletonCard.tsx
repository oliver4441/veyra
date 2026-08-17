'use client';

interface SkeletonCardProps {
  size?: 'sm' | 'md' | 'lg';
  count?: number;
  variant?: 'poster' | 'backdrop' | 'list';
}

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`bg-surface-container rounded-lg animate-pulse ${className}`} />;
}

export function SkeletonPoster({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const posterHeight = {
    sm: 'h-[225px] md:h-[278px]',
    md: 'h-[300px] md:h-[390px]',
    lg: 'h-[390px] md:h-[510px]',
  };
  const width = {
    sm: 'min-w-[150px] w-[150px] md:min-w-[185px] md:w-[185px]',
    md: 'min-w-[200px] w-[200px] md:min-w-[260px] md:w-[260px]',
    lg: 'min-w-[260px] w-[260px] md:min-w-[340px] md:w-[340px]',
  };

  return (
    <div className={`flex-shrink-0 ${width[size]}`}>
      <div className={`${posterHeight[size]} rounded-xl overflow-hidden`}>
        <SkeletonPulse className="w-full h-full" />
      </div>
      <div className="px-1 pt-3 space-y-2">
        <SkeletonPulse className="h-4 w-3/4" />
        <SkeletonPulse className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonBackdrop() {
  return (
    <div className="min-w-[200px] w-[200px] md:min-w-[280px] md:w-[280px] flex-shrink-0">
      <div className="h-[130px] md:h-[180px] rounded-xl overflow-hidden">
        <SkeletonPulse className="w-full h-full" />
      </div>
      <div className="px-1 pt-3 space-y-2">
        <SkeletonPulse className="h-4 w-3/4" />
        <SkeletonPulse className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonRow({ count = 6, variant = 'poster' }: { count?: number; variant?: 'poster' | 'backdrop' }) {
  return (
    <div className="flex gap-3 md:gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) =>
        variant === 'backdrop' ? (
          <SkeletonBackdrop key={i} />
        ) : (
          <SkeletonPoster key={i} size="md" />
        )
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 10, size = 'sm' }: { count?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPoster key={i} size={size} />
      ))}
    </div>
  );
}

export default function SkeletonCard({ size = 'md', count = 1, variant = 'poster' }: SkeletonCardProps) {
  if (count > 1) {
    return <SkeletonGrid count={count} size={size} />;
  }
  return <SkeletonPoster size={size} />;
}
