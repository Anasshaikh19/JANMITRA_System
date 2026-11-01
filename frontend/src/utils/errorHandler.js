/**
 * DRF Error Formatter for JANMITRA
 * Formats Django REST Framework error responses (strings, arrays, nested field errors)
 * into clean, user-friendly messages for UI alerts and toast components.
 */

export const formatDRFError = (error, fallback = 'An unexpected error occurred. Please try again.') => {
  if (!error) return fallback;

  // 1. Network / Connection errors (Axios without response)
  if (!error.response) {
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to connect to JANMITRA server. Please check your internet connection or backend status.';
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timed out. The municipal server took too long to respond.';
    }
    return error.message || fallback;
  }

  const { status, data } = error.response;

  // 2. HTTP Status Code specific fallbacks
  if (status === 401) {
    return 'Your session has expired or authentication failed. Please sign in again.';
  }
  if (status === 403) {
    return 'Permission denied. Your user role is not authorized to perform this municipal action.';
  }
  if (status === 404) {
    return 'The requested civic record or endpoint was not found.';
  }
  if (status === 413) {
    return 'The uploaded image file is too large. Please select a smaller photo.';
  }
  if (status >= 500) {
    return 'Municipal server error (500). Our technical team has been notified. Please try again shortly.';
  }

  // 3. Process DRF Data structures
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(String).join(' ');
  }

  if (typeof data === 'object' && data !== null) {
    // Check for standard DRF top-level keys
    if (data.detail && typeof data.detail === 'string') {
      return data.detail;
    }
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }
    if (data.error && typeof data.error === 'string') {
      return data.error;
    }
    if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      return data.non_field_errors.join(' ');
    }

    // Process field-level validation errors (e.g. { category: ['This field is required'], ward: ['Invalid ward'] })
    const messages = [];
    for (const [field, val] of Object.entries(data)) {
      const cleanField = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (Array.isArray(val)) {
        messages.push(`${cleanField}: ${val.join(' ')}`);
      } else if (typeof val === 'string') {
        messages.push(`${cleanField}: ${val}`);
      } else if (typeof val === 'object' && val !== null) {
        messages.push(`${cleanField}: ${JSON.stringify(val)}`);
      }
    }

    if (messages.length > 0) {
      return messages.join(' | ');
    }
  }

  return fallback;
};

/**
 * Extracts a map of field-specific errors for inline form inputs.
 * E.g. { description: 'Description must be at least 20 characters.' }
 */
export const getFieldErrors = (error) => {
  if (!error?.response?.data || typeof error.response.data !== 'object') {
    return {};
  }

  const { data } = error.response;
  const fieldErrors = {};

  for (const [key, val] of Object.entries(data)) {
    if (key === 'detail' || key === 'non_field_errors' || key === 'message') continue;
    if (Array.isArray(val)) {
      fieldErrors[key] = val.join(' ');
    } else if (typeof val === 'string') {
      fieldErrors[key] = val;
    }
  }

  return fieldErrors;
};

export default formatDRFError;
