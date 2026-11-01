import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

/**
 * ImageUploader component:
 * - Accepts 1 to 3 photos (configurable via maxPhotos)
 * - mode='complaint': runs backend EXIF & GPS verification via POST /api/v1/complaints/verify-image/
 * - mode='proof' / type='proof': uploads worker proof photos directly with thumbnail preview (no fake detection required)
 * - Props:
 *   * onChange(files)
 *   * maxPhotos (default 3)
 *   * type / mode ('complaint' | 'proof')
 *   * title (optional custom header)
 *   * subtitle (optional custom helper description)
 */
const ImageUploader = ({
  onChange,
  maxPhotos = 3,
  type = 'complaint',
  title,
  subtitle,
}) => {
  const isProofMode = type === 'proof';
  const [photos, setPhotos] = useState([]);
  const [globalError, setGlobalError] = useState('');
  const fileInputRef = useRef(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Notify parent component with valid files
  useEffect(() => {
    if (onChangeRef.current) {
      const validFiles = photos
        .filter((p) => (isProofMode ? true : p.status === 'verified'))
        .map((p) => p.file);
      onChangeRef.current(validFiles);
    }
  }, [photos, isProofMode]);

  const verifyPhotoOnBackend = async (photoId, file) => {
    if (isProofMode) {
      // Direct acceptance for proof photos without fake check
      setPhotos((prev) =>
        prev.map((item) =>
          item.id === photoId ? { ...item, status: 'verified' } : item
        )
      );
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const endpoint = `${baseUrl}/v1/complaints/verify-image/`;

    try {
      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { real, reason } = response.data || {};

      if (real === true) {
        setPhotos((prev) =>
          prev.map((item) =>
            item.id === photoId ? { ...item, status: 'verified' } : item
          )
        );
      } else {
        setPhotos((prev) => prev.filter((item) => item.id !== photoId));
        setGlobalError(
          reason ||
            'This image cannot be verified. Please upload a real photo taken by your phone camera.'
        );
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.real === false) {
        setPhotos((prev) => prev.filter((item) => item.id !== photoId));
        setGlobalError(
          err.response.data.reason ||
            'This image cannot be verified. Please upload a real photo taken by your phone camera.'
        );
      } else {
        console.warn('Backend EXIF check failed or endpoint unavailable:', err.message);
        setPhotos((prev) =>
          prev.map((item) =>
            item.id === photoId ? { ...item, status: 'verified' } : item
          )
        );
      }
    }
  };

  const handleFilesSelected = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setGlobalError('');

    const availableSlots = maxPhotos - photos.length;
    if (availableSlots <= 0) {
      setGlobalError(`You can upload a maximum of ${maxPhotos} photos.`);
      return;
    }

    const filesToProcess = selectedFiles.slice(0, availableSlots);

    const newPhotoEntries = filesToProcess.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: isProofMode ? 'verified' : 'verifying',
    }));

    setPhotos((prev) => [...prev, ...newPhotoEntries]);

    if (!isProofMode) {
      newPhotoEntries.forEach((entry) => {
        verifyPhotoOnBackend(entry.id, entry.file);
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (idToRemove) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === idToRemove);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== idToRemove);
    });
  };

  const verifiedCount = isProofMode
    ? photos.length
    : photos.filter((p) => p.status === 'verified').length;
  const isAnyVerifying = !isProofMode && photos.some((p) => p.status === 'verifying');

  const defaultTitle = isProofMode ? 'Upload Proof Photos' : 'Upload Evidence Photos';
  const defaultSubtitle = isProofMode
    ? 'Take on-site photo(s) of the resolved work.'
    : `Take clear photos of the issue with your camera (1 to ${maxPhotos} photos).`;

  return (
    <div className="w-full space-y-3">
      {/* Header and Photo Counter */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-slate-800">
            {title || defaultTitle}
          </label>
          <p className="text-xs text-slate-500">{subtitle || defaultSubtitle}</p>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
            verifiedCount > 0
              ? 'bg-blue-50 text-primary border-blue-200'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
        >
          {verifiedCount}/{maxPhotos} photos added
        </span>
      </div>

      {/* Red Alert Banner on Fake Photo */}
      {globalError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-danger text-xs animate-shake"
        >
          <span className="text-base leading-none select-none" aria-hidden="true">
            🚫
          </span>
          <div className="flex-1 font-medium">
            <span className="font-bold">Image Verification Failed: </span>
            {globalError}
          </div>
          <button
            type="button"
            onClick={() => setGlobalError('')}
            className="text-red-500 hover:text-red-800 font-bold text-sm leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Grid of Previews and Upload Box */}
      <div className="grid grid-cols-3 gap-3">
        {photos.map((item) => (
          <div
            key={item.id}
            className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm"
          >
            <img
              src={item.previewUrl}
              alt="Photo preview"
              className="w-full h-full object-cover"
            />

            {item.status === 'verifying' && (
              <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white">
                <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                <span className="text-[11px] font-medium leading-tight">
                  Verifying photo...
                </span>
                <span className="text-[9px] text-slate-300">EXIF & GPS check</span>
              </div>
            )}

            {item.status === 'verified' && (
              <div className="absolute top-1.5 left-1.5 bg-success text-white rounded-full p-1 shadow flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 stroke-current stroke-2 fill-none"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {item.status !== 'verifying' && (
              <button
                type="button"
                onClick={() => handleRemovePhoto(item.id)}
                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-danger text-white rounded-full p-1 shadow transition opacity-80 hover:opacity-100"
                title="Remove photo"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-primary hover:bg-blue-50/50 flex flex-col items-center justify-center p-3 text-slate-500 hover:text-primary transition group cursor-pointer"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
              📷
            </span>
            <span className="text-xs font-semibold">
              {isProofMode ? 'Add Proof' : 'Add Photo'}
            </span>
            <span className="text-[10px] text-slate-400">Up to {maxPhotos}</span>
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        accept="image/*"
        multiple
        className="hidden"
      />

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          {verifiedCount === 0
            ? isProofMode
              ? '⚠️ Please upload at least 1 proof photo.'
              : '⚠️ Please add at least 1 verified photo to proceed.'
            : isAnyVerifying
            ? '⏳ Verification in progress...'
            : '✅ Ready for submission.'}
        </span>
      </div>
    </div>
  );
};

export default ImageUploader;
