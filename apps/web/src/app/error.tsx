'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-error-container/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error.digest && (
            <p className="text-on-surface-variant text-xs mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
