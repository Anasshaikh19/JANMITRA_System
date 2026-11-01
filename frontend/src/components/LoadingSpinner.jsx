import React from 'react';

/**
 * LoadingSpinner:
 * Centred loading indicator with customizable size and label.
 */
const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  }[size] || 'h-8 w-8 border-3';

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full" role="status">
      <div
        className={`animate-spin rounded-full border-primary border-t-transparent ${sizeClasses}`}
        aria-label="Loading animation"
      />
      {message && (
        <p className="mt-3 text-sm font-medium text-slate-600 animate-pulse">{message}</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
};

export default LoadingSpinner;
