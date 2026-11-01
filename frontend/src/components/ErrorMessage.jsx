import React from 'react';

/**
 * ErrorMessage:
 * Red error alert box with message prop and optional retry callback.
 */
const ErrorMessage = ({ message = 'An unexpected error occurred.', onRetry }) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 text-danger rounded-lg p-4 my-3 flex items-start gap-3 shadow-sm"
    >
      <span className="text-xl leading-none select-none" aria-hidden="true">
        ⚠️
      </span>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-red-900">Error</h4>
        <p className="text-sm text-red-800 mt-0.5">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-danger underline hover:text-red-800 focus:outline-none"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
