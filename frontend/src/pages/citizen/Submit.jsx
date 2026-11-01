/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/Submit.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Day: Day 13 - Citizen Issue Submission Form (Part 3: Leaflet GPS Map Picker)
 * Description: Interactive civic complaint creation form layout.
 *              - Part 1 (Day 11):
 *                1. Page Header: 'Report New Civic Issue' with back button to /citizen.
 *                2. 4 Category Cards (2x2 Grid): PWD (Blue), SWM (Green), PHE (Cyan), ELE (Yellow)
 *                   with blue outline & checkmark.
 *                3. Ward selector: Dropdown [Ward 1 | Ward 2 | Ward 3 | Ward 4] (pre-selected from profile).
 *                4. Description field: Textarea (min 15 chars) with character counter.
 *                5. Landmark input: Optional text field for easy field location.
 *              - Part 2 (Day 12):
 *                1. Live Camera Modal + Photo Picker:
 *                   - Live Webcam / Native Camera with browser permission trigger (navigator.mediaDevices.getUserMedia)
 *                   - Upload from Gallery button (accept='image/*')
 *                   - Max 3 photos allowed with file size validation (< 5MB each).
 *                2. Preview Gallery:
 *                   - Interactive thumbnails with delete (X) badge.
 *                   - Primary photo badge on first photo.
 *                   - Click-to-zoom Lightbox modal.
 *                3. HTML5 Canvas Image Optimization:
 *                   - Real client-side resize to max 1280px maintaining aspect ratio.
 *                   - Clean compression feedback.
 *              - Part 3 (Day 13 Additions):
 *                1. Interactive Leaflet Map Centered at Nagpur (21.1458° N, 79.0882° E)
 *                2. 'Detect My Location' Button (calls navigator.geolocation.getCurrentPosition):
 *                   - Places draggable marker at user's current GPS coordinates.
 *                   - Reverse-geocodes to street address and displays Lat & Lng badges.
 *                3. Manual Pin Drag:
 *                   - User can drag pin or click anywhere on map to adjust exact street location.
 *                4. Accuracy Indicator:
 *                   - Shows GPS accuracy radius in metres with map accuracy circle and precision badges.
 *                5. Standalone exported LocationPicker component inside citizen/Submit.jsx.
 * ==============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Default Central Coordinates: Nagpur Zero Mile Stone
const NAGPUR_CENTER = {
  lat: 21.1458,
  lng: 79.0882,
  defaultAddress: 'Zero Mile Stone, Wardha Road, Civil Lines, Nagpur, Maharashtra 440001'
};

// 4 Category Cards with department-specific colors & details
const CATEGORIES = [
  {
    id: 'PWD',
    code: 'PWD',
    deptId: 1,
    title: 'Roads & Infrastructure',
    department: 'Public Works Department (PWD)',
    colorName: 'Blue',
    colorClasses: {
      badge: 'bg-blue-600 text-white',
      badgeLight: 'bg-blue-100 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
      tagColor: 'text-blue-600',
    },
    examples: 'Potholes, broken asphalt, damaged pavements & open manholes',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 17h16M4 21h16" />
      </svg>
    )
  },
  {
    id: 'SWM',
    code: 'SWM',
    deptId: 2,
    title: 'Garbage & Waste',
    department: 'Solid Waste Management (SWM)',
    colorName: 'Green',
    colorClasses: {
      badge: 'bg-emerald-600 text-white',
      badgeLight: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      tagColor: 'text-emerald-600',
    },
    examples: 'Overflowing bins, uncollected trash & illegal open dumping',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    )
  },
  {
    id: 'PHE',
    code: 'PHE',
    deptId: 3,
    title: 'Water & Drainage',
    department: 'Public Health Engineering (PHE)',
    colorName: 'Cyan',
    colorClasses: {
      badge: 'bg-cyan-600 text-white',
      badgeLight: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      iconBg: 'bg-cyan-50 text-cyan-600',
      tagColor: 'text-cyan-600',
    },
    examples: 'Pipeline bursts, contaminated water, overflowing drains & sewage leaks',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
  {
    id: 'ELE',
    code: 'ELE',
    deptId: 4,
    title: 'Street Lighting',
    department: 'Electrical Department',
    colorName: 'Yellow',
    colorClasses: {
      badge: 'bg-amber-500 text-white',
      badgeLight: 'bg-amber-100 text-amber-900 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      tagColor: 'text-amber-600',
    },
    examples: 'Non-functional street lamps, flickering lights & dangerous exposed wires',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
];

// Municipal Corporation Wards [Ward 1 | Ward 2 | Ward 3 | Ward 4]
const WARDS = [
  { id: 'Ward 1', name: 'Ward 1', area: 'Laxmi Nagar / West Nagpur' },
  { id: 'Ward 2', name: 'Ward 2', area: 'Dharampeth / Central Nagpur' },
  { id: 'Ward 3', name: 'Ward 3', area: 'Hanuman Nagar / South Nagpur' },
  { id: 'Ward 4', name: 'Ward 4', area: 'Mangalwari / North Nagpur' },
];

/**
 * Format bytes to readable format (KB, MB)
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Custom Leaflet Map Pin DivIcon
 * Immune to Vite asset bundling paths; supports GPS vs Manual styling.
 */
const createCustomPinIcon = (isGps = false) => {
  const pinColor = isGps ? '#10B981' : '#1A56DB';
  const pulseHtml = isGps
    ? `<span style="position: absolute; top: -6px; right: -6px; width: 12px; height: 12px; background: #10B981; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px #10B981; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
    : '';

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%); cursor: grab;">
        <div style="
          width: 36px;
          height: 36px;
          background: ${pinColor};
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 6px 14px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 14px; color: white;">📍</span>
        </div>
        ${pulseHtml}
        <div style="
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 4px;
          background: rgba(0,0,0,0.35);
          border-radius: 50%;
          filter: blur(1px);
        "></div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42]
  });
};

/**
 * Reverse Geocode Coordinates via OpenStreetMap Nominatim
 * Extracts exact street, road, landmark/neighbourhood, and city with postcode
 */
const fetchReverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!response.ok) throw new Error('Geocoding request failed');
    const data = await response.json();
    const addr = data.address || {};

    // 1. Street / Building part
    const streetLine = [
      addr.house_number || addr.building || addr.amenity,
      addr.road || addr.street || addr.pedestrian || addr.residential || addr.footway
    ].filter(Boolean).join(', ');

    // 2. Locality / Suburb / Ward area
    const localityLine = [
      addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.residential
    ].filter(Boolean).join(', ');

    // 3. City & State
    const cityLine = addr.city || addr.town || addr.municipality || 'Nagpur';
    const stateLine = addr.state || 'Maharashtra';
    const pincode = addr.postcode ? ` - ${addr.postcode}` : '';

    const parts = [streetLine, localityLine, `${cityLine}, ${stateLine}`].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(', ') + pincode;
    }

    return data.display_name || `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E, Nagpur`;
  } catch (err) {
    return `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E, Nagpur, Maharashtra`;
  }
};

/**
 * Canvas Image Compression Utility
 * Resizes images client-side to max 1280px maintaining aspect ratio
 */
const compressImageWithCanvas = (file, maxDimension = 1280, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type: Please select an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Downscale proportionally if larger than maxDimension (1280px)
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed to generate image blob'));
              return;
            }

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const originalSize = file.size;
            const compressedSize = blob.size;
            const savedPct = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              originalFile: file,
              compressedBlob: blob,
              dataUrl,
              originalSize,
              compressedSize,
              savedPct,
              width,
              height
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image in canvas'));
      img.src = event.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file from storage'));
    reader.readAsDataURL(file);
  });
};

/**
 * ==============================================================================
 * LocationPicker Component
 * Interactive Leaflet GPS map with Nagpur centering, geolocation detection,
 * draggable pin, accuracy radius circles, and reverse geocoding badges.
 * ==============================================================================
 */
export const LocationPicker = ({ location, onLocationChange }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const circleInstanceRef = useRef(null);

  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  /**
   * Internal coordinate & address updater
   */
  const handleLocationUpdate = async (newLat, newLng, newAccuracy = null, isGps = false) => {
    setIsGeocoding(true);
    const resolvedAddress = await fetchReverseGeocode(newLat, newLng);
    setIsGeocoding(false);

    onLocationChange({
      lat: Number(newLat.toFixed(6)),
      lng: Number(newLng.toFixed(6)),
      address: resolvedAddress,
      accuracy: newAccuracy,
      isGpsDetected: isGps,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * 1. Initialize Leaflet Map centered at Nagpur
   */
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = location?.lat || NAGPUR_CENTER.lat;
    const initialLng = location?.lng || NAGPUR_CENTER.lng;

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false
    });

    // Custom Zoom Control at Bottom Right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Initial Draggable Marker
    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: createCustomPinIcon(location?.isGpsDetected || false)
    }).addTo(map);

    marker.bindPopup(
      `<div style="font-size: 12px; font-family: sans-serif;">
        <strong>Civic Issue Location</strong><br/>
        Drag marker to pinpoint exact street spot.
      </div>`
    );

    // Marker Drag Event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      handleLocationUpdate(pos.lat, pos.lng, null, false);
    });

    // Map Click Event (Reposition Marker)
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      handleLocationUpdate(lat, lng, null, false);
    });

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    // Trigger invalidateSize to ensure correct tile rendering in responsive layouts
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
      circleInstanceRef.current = null;
    };
  }, []);

  /**
   * 2. Synchronize Marker Position & Accuracy Circle when props change
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !markerInstanceRef.current) return;

    const lat = location?.lat || NAGPUR_CENTER.lat;
    const lng = location?.lng || NAGPUR_CENTER.lng;

    markerInstanceRef.current.setLatLng([lat, lng]);
    markerInstanceRef.current.setIcon(createCustomPinIcon(location?.isGpsDetected || false));

    // Handle Accuracy Circle
    if (location?.accuracy && location.accuracy > 0) {
      if (circleInstanceRef.current) {
        circleInstanceRef.current.setLatLng([lat, lng]);
        circleInstanceRef.current.setRadius(location.accuracy);
      } else {
        circleInstanceRef.current = L.circle([lat, lng], {
          radius: location.accuracy,
          color: '#1A56DB',
          fillColor: '#3B82F6',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(mapInstanceRef.current);
      }
    } else if (circleInstanceRef.current) {
      circleInstanceRef.current.remove();
      circleInstanceRef.current = null;
    }
  }, [location?.lat, location?.lng, location?.accuracy, location?.isGpsDetected]);

  /**
   * 3. 'Detect My Location' Button Action
   * Employs high-accuracy continuous multi-sample GPS with fallback
   * to lock onto the closest building-level coordinate fix.
   */
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    let bestCoords = null;
    let watchId = null;
    let timeoutTimer = null;

    const finalizeLocation = (coords) => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
        watchId = null;
      }
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      setIsDetectingGps(false);

      const lat = coords.latitude;
      const lng = coords.longitude;
      const accuracy = Math.round(coords.accuracy || 15);

      // Higher street-level zoom for exact positioning
      const optimalZoom = accuracy <= 35 ? 18 : accuracy <= 80 ? 17 : 16;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], optimalZoom, { duration: 1.2 });
      }

      handleLocationUpdate(lat, lng, accuracy, true);
    };

    const handleGeoError = (error) => {
      setIsDetectingGps(false);
      console.warn('[LocationPicker] Geolocation error:', error);
      if (error.code === error.PERMISSION_DENIED) {
        setGpsError('GPS location permission was denied. Please allow location access in your browser or drag the map pin manually.');
      } else if (error.code === error.TIMEOUT) {
        setGpsError('GPS signal timed out. You can drag the red pin directly onto your street on the map.');
      } else {
        setGpsError('Unable to detect high-accuracy GPS. Drag the map pin to select your exact location.');
      }
    };

    // Rapid continuous refinement for up to 3.5 seconds
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const current = position.coords;
          if (!bestCoords || current.accuracy < bestCoords.accuracy) {
            bestCoords = current;
          }
          // If we achieved high building-level GPS precision (<= 25m), finalize immediately!
          if (current.accuracy && current.accuracy <= 25) {
            finalizeLocation(current);
          }
        },
        (error) => {
          // If watchPosition fails, fall back to single-shot getCurrentPosition
          if (!bestCoords) {
            navigator.geolocation.getCurrentPosition(
              (pos) => finalizeLocation(pos.coords),
              handleGeoError,
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
          } else {
            finalizeLocation(bestCoords);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        }
      );

      // Settle on the highest precision sample within 3.5 seconds
      timeoutTimer = setTimeout(() => {
        if (bestCoords) {
          finalizeLocation(bestCoords);
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => finalizeLocation(pos.coords),
            handleGeoError,
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
          );
        }
      }, 3500);

    } catch (e) {
      // Standard one-shot fallback
      navigator.geolocation.getCurrentPosition(
        (pos) => finalizeLocation(pos.coords),
        handleGeoError,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }
  };

  /**
   * Reset Pin to Nagpur Zero Mile Center
   */
  const handleResetToNagpurCenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([NAGPUR_CENTER.lat, NAGPUR_CENTER.lng], 14, { duration: 1 });
    }
    handleLocationUpdate(NAGPUR_CENTER.lat, NAGPUR_CENTER.lng, null, false);
    setGpsError(null);
  };

  /**
   * Zoom closely into the current marker for street-level pin fine-tuning
   */
  const handleZoomToPin = () => {
    if (mapInstanceRef.current) {
      const lat = location?.lat || NAGPUR_CENTER.lat;
      const lng = location?.lng || NAGPUR_CENTER.lng;
      mapInstanceRef.current.flyTo([lat, lng], 18, { duration: 0.8 });
    }
  };

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      
      {/* LocationPicker Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/70 pb-3">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🗺️</span>
            <span>6. Pinpoint Defect Location (Nagpur GPS Map)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Centered at Nagpur &bull; Drag pin or click map to pinpoint exact street/doorstep
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Detect Location Button */}
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isDetectingGps}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
              isDetectingGps
                ? 'bg-blue-100 text-blue-700 cursor-wait'
                : 'bg-[#1A56DB] hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            {isDetectingGps ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Detecting High-Precision GPS...</span>
              </>
            ) : (
              <>
                <span>🎯</span>
                <span>Detect My Location</span>
              </>
            )}
          </button>

          {/* Zoom to Pin */}
          <button
            type="button"
            onClick={handleZoomToPin}
            title="Zoom into Pin at Street Level (Zoom 18)"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
          >
            <span>🔍</span>
            <span>Street Zoom</span>
          </button>

          {/* Reset to Nagpur Zero Mile */}
          <button
            type="button"
            onClick={handleResetToNagpurCenter}
            title="Reset to Nagpur Zero Mile Stone"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
          >
            Nagpur Center
          </button>
        </div>
      </div>

      {/* GPS Error Alert */}
      {gpsError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2 animate-fadeIn">
          <span className="text-sm shrink-0">⚠️</span>
          <div className="flex-1">
            <span>{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsError(null)}
            className="text-amber-600 font-bold hover:text-amber-900 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Leaflet Map Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
        <div
          ref={mapContainerRef}
          style={{ height: '330px', width: '100%' }}
          className="z-10"
        />

        {/* Live Map Watermark / Overlay Badges */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1.5">
          {/* Coordinates Badge */}
          <div className="bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{location?.lat?.toFixed(5)}° N, {location?.lng?.toFixed(5)}° E</span>
          </div>

          {/* Accuracy Indicator Badge */}
          {location?.accuracy && location.accuracy > 0 ? (
            location.accuracy <= 30 ? (
              <div className="bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>🎯 High Precision GPS: &plusmn;{location.accuracy}m</span>
              </div>
            ) : location.accuracy <= 80 ? (
              <div className="bg-blue-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>📍 Good Accuracy: &plusmn;{location.accuracy}m</span>
              </div>
            ) : (
              <div className="bg-amber-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1">
                <span>📡 Approx GPS: &plusmn;{location.accuracy}m &bull; Drag pin for doorstep accuracy</span>
              </div>
            )
          ) : (
            <div className="bg-slate-700/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-[10px] font-medium shadow-xs">
              📌 Drag pin or tap map to adjust location
            </div>
          )}
        </div>
      </div>

      {/* Accuracy & Desktop Notice */}
      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100/80 text-[11px] text-blue-900 flex items-start gap-2">
        <span className="text-sm shrink-0">💡</span>
        <div className="leading-relaxed">
          <strong className="text-blue-950 font-bold">Exact Location Tip: </strong>
          Laptops & PCs without GPS chips estimate location via WiFi IP, which can be 50–100m off. You can <strong>drag the red pin</strong> or <strong>click anywhere directly on the street/building</strong> to lock your 100% exact doorstep location!
        </div>
      </div>

      {/* Reverse Geocoded Address Card */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 font-bold text-[11px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span>📍</span> Selected Street Address
          </span>
          {isGeocoding ? (
            <span className="text-blue-600 animate-pulse font-normal lowercase">resolving street address...</span>
          ) : (
            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
              location?.isGpsDetected 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                : 'text-indigo-700 bg-indigo-50 border-indigo-200'
            }`}>
              {location?.isGpsDetected ? '✓ GPS Verified' : '📌 Manual Street Pin'}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-800 font-medium leading-relaxed">
          {location?.address || NAGPUR_CENTER.defaultAddress}
        </p>

        {/* Coordinates Details Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">
            Lat: <strong>{location?.lat?.toFixed(6)}</strong>
          </span>
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">
            Lng: <strong>{location?.lng?.toFixed(6)}</strong>
          </span>
          {location?.accuracy && (
            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
              Radius: &plusmn;{location.accuracy}m
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

/**
 * ==============================================================================
 * CitizenSubmit Master Form Component
 * ==============================================================================
 */
export const CitizenSubmit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hidden File Input References
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);

  // Helper to extract default ward from user profile
  const parseProfileWard = () => {
    if (!user?.ward) return 'Ward 4';
    const w = String(user.ward).toLowerCase();
    if (w.includes('1')) return 'Ward 1';
    if (w.includes('2')) return 'Ward 2';
    if (w.includes('3')) return 'Ward 3';
    return 'Ward 4';
  };

  // Form State
  const [selectedCategory, setSelectedCategory] = useState('PWD');
  const [selectedWard, setSelectedWard] = useState(parseProfileWard());
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');

  // Day 12 Photo Upload State
  const [photos, setPhotos] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lastCompressionSummary, setLastCompressionSummary] = useState(null);
  const [previewLightbox, setPreviewLightbox] = useState(null);

  // Day 13 LocationPicker State (Nagpur Center Default)
  const [location, setLocation] = useState({
    lat: NAGPUR_CENTER.lat,
    lng: NAGPUR_CENTER.lng,
    address: NAGPUR_CENTER.defaultAddress,
    accuracy: null,
    isGpsDetected: false,
    timestamp: new Date().toISOString()
  });

  // Live Camera / Webcam Viewfinder State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState(null);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);

  // UI / Validation State
  const [touched, setTouched] = useState({ description: false });
  const [draftSaved, setDraftSaved] = useState(false);

  // Day 14 API Submission, Loading & Success Modal States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('Uploading photos & running AI verification...');
  const [submitError, setSubmitError] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Sync ward if user profile changes
  useEffect(() => {
    if (user?.ward) {
      setSelectedWard(parseProfileWard());
    }
  }, [user]);

  // Clean up camera stream if component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Attach camera stream to video tag
  useEffect(() => {
    if (isCameraModalOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('[Camera] Autoplay interrupted:', err);
      });
    }
  }, [isCameraModalOpen, cameraStream]);

  // Validation constants
  const minChars = 15;
  const maxChars = 500;
  const maxPhotosAllowed = 3;
  const maxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

  const currentLength = description.trim().length;
  const isDescriptionValid = currentLength >= minChars;
  const charsRemaining = minChars - currentLength;
  const isFormValid = Boolean(selectedCategory) && isDescriptionValid;

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  /**
   * Start Live Camera / Webcam Stream (Triggers Browser Permission Prompt)
   */
  const startCameraStream = async (facing = cameraFacingMode) => {
    if (photos.length >= maxPhotosAllowed) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed.`);
      return;
    }

    setUploadError(null);
    setCameraError(null);
    setIsCameraModalOpen(true);

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam / Camera API is not supported on this browser.');
      }

      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
    } catch (err) {
      console.warn('[Camera] getUserMedia failed with facingMode constraint:', err);

      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(fallbackStream);
      } catch (fallbackErr) {
        console.error('[Camera] Complete camera failure:', fallbackErr);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was blocked. Please click the camera/lock icon in your browser address bar and select "Allow".');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setCameraError('No camera device detected. You can select photos from your device storage instead.');
        } else {
          setCameraError(fallbackErr.message || 'Unable to open camera on this device.');
        }
      }
    }
  };

  /**
   * Stop Live Camera Stream
   */
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
    setCameraError(null);
  };

  /**
   * Toggle Front/Back Camera
   */
  const handleToggleFacingMode = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCameraStream(nextFacing);
  };

  /**
   * Capture Frame from Live Camera Stream
   */
  const capturePhotoFromStream = async () => {
    if (!videoRef.current || isCapturingFrame) return;

    if (photos.length >= maxPhotosAllowed) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed.`);
      stopCameraStream();
      return;
    }

    setIsCapturingFrame(true);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 960;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Could not create snapshot blob');

      const photoFile = new File([blob], `civic-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Run through canvas optimization pipeline
      await handleFilesSelected([photoFile]);

      stopCameraStream();
    } catch (err) {
      console.error('[Camera] Frame snapshot error:', err);
      setCameraError('Failed to capture snapshot from camera.');
    } finally {
      setIsCapturingFrame(false);
    }
  };

  /**
   * Handle File Selection from Camera Input or Gallery
   */
  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    setUploadError(null);
    const filesArray = Array.from(fileList);

    const availableSlots = maxPhotosAllowed - photos.length;
    if (availableSlots <= 0) {
      setUploadError(`Maximum ${maxPhotosAllowed} photos allowed. Please remove a photo to upload a new one.`);
      return;
    }

    const filesToProcess = filesArray.slice(0, availableSlots);
    if (filesArray.length > availableSlots) {
      setUploadError(`Only ${availableSlots} more photo(s) could be added. Max limit is 3.`);
    }

    for (const file of filesToProcess) {
      if (file.size > maxFileSizeBytes) {
        setUploadError(`"${file.name}" exceeds 5MB limit (${formatFileSize(file.size)}). Please choose a photo under 5MB.`);
        return;
      }
    }

    setIsCompressing(true);

    try {
      const compressedResults = [];
      let totalOriginal = 0;
      let totalCompressed = 0;

      for (const file of filesToProcess) {
        const result = await compressImageWithCanvas(file, 1280, 0.82);
        compressedResults.push(result);
        totalOriginal += result.originalSize;
        totalCompressed += result.compressedSize;
      }

      setPhotos((prev) => [...prev, ...compressedResults]);

      const overallSaved = Math.max(0, Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100));
      setLastCompressionSummary({
        count: compressedResults.length,
        original: formatFileSize(totalOriginal),
        compressed: formatFileSize(totalCompressed),
        savedPct: overallSaved
      });
    } catch (err) {
      console.error('[Submit] Photo compression error:', err);
      setUploadError('Failed to process image. Please try another photo.');
    } finally {
      setIsCompressing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setUploadError(null);
  };

  const handleSetPrimary = (photoId) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === photoId);
      if (idx <= 0) return prev;
      const target = prev[idx];
      const remaining = prev.filter((p) => p.id !== photoId);
      return [target, ...remaining];
    });
  };

  /**
   * Day 14: Form Submission Action
   * Submits multipart FormData to backend API: POST /api/v1/complaints/
   * (category, ward, description, photos, lat, lng)
   */
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setTouched({ description: true });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitStage('Uploading photos & running AI verification...');

    // 1. Construct Multipart FormData payload
    const formData = new FormData();
    formData.append('category', activeCategoryObj?.title || selectedCategory);
    formData.append('category_code', selectedCategory);
    formData.append('category_id', activeCategoryObj?.deptId || 1);
    formData.append('department', activeCategoryObj?.department || 'PWD');
    formData.append('ward', selectedWard);
    formData.append('ward_number', selectedWard.replace(/\D/g, '') || '4');
    formData.append('description', description.trim());
    if (landmark.trim()) {
      formData.append('landmark', landmark.trim());
    }
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);
    formData.append('address', location.address || NAGPUR_CENTER.defaultAddress);
    if (location.accuracy) {
      formData.append('accuracy', location.accuracy);
    }
    formData.append('is_gps_detected', location.isGpsDetected ? 'true' : 'false');

    // Attach compressed photo files
    photos.forEach((photo, idx) => {
      if (photo.compressedBlob) {
        formData.append('photos', photo.compressedBlob, photo.name || `civic_issue_${idx + 1}.jpg`);
      }
    });

    if (photos[0]?.dataUrl) {
      formData.append('primary_photo_preview', photos[0].dataUrl);
    }

    try {
      // 2. Execute POST with smooth animated pulse loader duration (min 1.4s)
      const [response] = await Promise.all([
        api.post('/api/v1/complaints/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }),
        new Promise((resolve) => setTimeout(resolve, 1400))
      ]);

      const data = response.data;

      // 3. Clear draft cache upon successful submission
      try {
        sessionStorage.removeItem('janmitra_draft_complaint');
      } catch (cacheErr) {
        console.warn('[Submit] Failed to clear sessionStorage draft:', cacheErr);
      }

      const ticketId = data.tracking_id || data.id || 'NMC-2026-018';
      const complaintId = data.id || ticketId;

      setSubmittedComplaint({
        id: complaintId,
        tracking_id: ticketId,
        title: data.title || `${activeCategoryObj?.title} Issue`,
        category: data.category || activeCategoryObj?.title,
        department: data.department || activeCategoryObj?.department,
        ward: data.ward || selectedWard,
        address: location.address || data.address || NAGPUR_CENTER.defaultAddress,
        status: data.status || 'Submitted',
        sla_hours: data.sla_hours || 48,
        expected_sla: data.expected_sla || 'Target resolution within 48 hours',
        photo_count: photos.length,
        submitted_at: data.submitted_at || new Date().toISOString()
      });

      setIsSubmitting(false);
      setIsSuccessModalOpen(true);

    } catch (err) {
      console.error('[Submit] API submission failed:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.message || err.message;
      setSubmitError(errMsg || 'Failed to submit complaint. Please check your network and try again.');
      setIsSubmitting(false);
    }
  };

  /**
   * Copy Generated Complaint Tracking ID to Clipboard
   */
  const handleCopyTicket = (ticketId) => {
    if (!ticketId) return;
    try {
      navigator.clipboard.writeText(ticketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    } catch (err) {
      console.warn('[Submit] Clipboard copy failed:', err);
    }
  };

  /**
   * Reset form to submit another complaint
   */
  const handleResetForm = () => {
    setIsSuccessModalOpen(false);
    setSubmittedComplaint(null);
    setDescription('');
    setLandmark('');
    setPhotos([]);
    setTouched({ description: false });
    setLocation({
      lat: NAGPUR_CENTER.lat,
      lng: NAGPUR_CENTER.lng,
      address: NAGPUR_CENTER.defaultAddress,
      accuracy: null,
      isGpsDetected: false,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-7 font-sans">
      
      {/* Hidden File Inputs for Native System Fallbacks */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* ================= 1. PAGE HEADER WITH BACK BUTTON TO /citizen ================= */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate('/citizen')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-[#1A56DB] bg-white border border-slate-200 hover:border-blue-300 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition duration-150 shadow-xs active:scale-95 group cursor-pointer"
          aria-label="Back to Citizen Home"
        >
          <span className="text-base sm:text-lg leading-none group-hover:-translate-x-1 transition-transform">←</span>
          <span>Back to /citizen</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-bold text-blue-700">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>Municipal Corporation Grievance Portal</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-[#0d2a53] via-[#12396d] to-[#1A56DB] text-white p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
                Municipal Corporation &bull; Civic Redressal
              </span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
                Report New Civic Issue
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
                Provide civic defect details, attach photos, and pinpoint the exact GPS location on the Nagpur municipal map.
              </p>
            </div>

            {/* Stepper Pill */}
            <div className="bg-white/10 border border-white/20 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 shrink-0 self-start sm:self-auto">
              <div className="w-8 h-8 rounded-xl bg-white text-[#0d2a53] font-black flex items-center justify-center text-sm shadow-sm">
                3/3
              </div>
              <div className="text-left text-xs">
                <span className="text-white font-bold block">Part 3 Active</span>
                <span className="text-blue-200 text-[11px]">GPS Map & Location</span>
              </div>
            </div>
          </div>

          {/* Progress Bar (Complete) */}
          <div className="w-full bg-white/20 h-2 rounded-full mt-5 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full w-full transition-all duration-300"></div>
          </div>
        </div>

        {/* Form Body - Responsive 2-Column Grid on Laptop/Desktop, 1-Column on Phone */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-7 lg:p-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            
            {/* ================= LEFT COLUMN: DETAILS & PHOTO UPLOADER (6 cols on Desktop) ================= */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* SECTION 1: 4 CATEGORY CARDS (GRID 2x2) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Select Issue Category</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Tap to select
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedCategory(cat.id);
                          }
                        }}
                        className={`relative p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between text-left select-none outline-none ${
                          isSelected
                            ? 'border-2 border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 shadow-sm'
                            : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Top: Code & Checkmark */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            isSelected
                              ? cat.colorClasses.badge
                              : cat.colorClasses.badgeLight
                          }`}>
                            [{cat.code}]
                          </span>

                          {isSelected ? (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs ring-2 ring-blue-200 animate-scaleIn">
                              ✓
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white"></span>
                          )}
                        </div>

                        {/* Middle: Icon & Title */}
                        <div className="space-y-1.5 my-1">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg shrink-0 ${cat.colorClasses.iconBg}`}>
                              {cat.icon}
                            </div>
                            <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                              {cat.title}
                            </h2>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed hidden sm:block">
                            {cat.examples}
                          </p>
                        </div>

                        {/* Bottom: Dept Tag */}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-slate-500">
                            {cat.colorName} Dept
                          </span>
                          {isSelected && (
                            <span className="font-bold text-blue-600">Selected</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: WARD SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="ward-select" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Municipal Ward</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {user?.ward && (
                    <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      Profile Default: {selectedWard}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <select
                    id="ward-select"
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl px-4 py-3.5 pr-10 appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition shadow-inner"
                  >
                    {WARDS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} &bull; {w.area}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DESCRIPTION FIELD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="description-textarea" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>3. Issue Description</span>
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${
                      isDescriptionValid ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {currentLength} / {maxChars} chars
                    </span>

                    {isDescriptionValid ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>✓</span> Min 15 met
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Min 15 chars ({charsRemaining > 0 ? charsRemaining : 0} more)
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  id="description-textarea"
                  rows="3"
                  value={description}
                  maxLength={maxChars}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (!touched.description) setTouched({ description: true });
                  }}
                  onBlur={() => setTouched({ description: true })}
                  placeholder="Describe the defect in detail (min 15 characters). E.g., Broken water supply pipe leaking onto pedestrian footpath and road..."
                  className={`w-full text-sm font-medium rounded-xl p-4 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    touched.description && !isDescriptionValid
                      ? 'border-amber-400 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-500/30'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-blue-600/30'
                  } border`}
                ></textarea>

                {touched.description && !isDescriptionValid && (
                  <p className="text-xs text-amber-700 font-semibold mt-1.5 flex items-center gap-1">
                    <span>⚠️</span> Description too short. Please write at least 15 characters ({charsRemaining} characters left).
                  </p>
                )}
              </div>

              {/* SECTION 4: LANDMARK INPUT */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="landmark-field" className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>4. Nearest Landmark</span>
                    <span className="text-[11px] font-normal text-slate-400 normal-case">(Optional)</span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-400">
                    Assists field workers
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    📍
                  </div>
                  <input
                    id="landmark-field"
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g., Near Medical Square Metro Pillar #42, opp. Bank of India"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* SECTION 5: PHOTO UPLOADER & THUMBNAILS */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>📸</span>
                      <span>5. Attach Issue Photos</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Up to 3 photos (&lt; 5MB each)
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    photos.length === maxPhotosAllowed
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {photos.length} / {maxPhotosAllowed} Photos
                  </span>
                </div>

                {/* Upload Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => startCameraStream()}
                    disabled={photos.length >= maxPhotosAllowed || isCompressing}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-center shadow-xs cursor-pointer ${
                      photos.length >= maxPhotosAllowed || isCompressing
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                        : 'bg-white hover:bg-blue-50/60 border-blue-300 text-[#1A56DB] hover:border-blue-500 active:scale-95'
                    }`}
                  >
                    <span>📷</span>
                    <span className="text-xs font-bold">Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={photos.length >= maxPhotosAllowed || isCompressing}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition text-center shadow-xs cursor-pointer ${
                      photos.length >= maxPhotosAllowed || isCompressing
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                        : 'bg-white hover:bg-emerald-50/60 border-emerald-300 text-emerald-700 hover:border-emerald-500 active:scale-95'
                    }`}
                  >
                    <span>🖼️</span>
                    <span className="text-xs font-bold">From Gallery</span>
                  </button>
                </div>

                {/* Photo Optimization Summary Banner */}
                {lastCompressionSummary && !isCompressing && (
                  <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-emerald-950 text-[11px] flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>
                        Photo optimized to <strong>{lastCompressionSummary.compressed}</strong> ({lastCompressionSummary.savedPct}% size reduced)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-1.5 py-0.5 rounded">
                      Optimized
                    </span>
                  </div>
                )}

                {/* Thumbnails Row */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {photos.map((photo, index) => {
                      const isPrimary = index === 0;
                      return (
                        <div
                          key={photo.id}
                          className={`relative rounded-xl overflow-hidden border bg-white shadow-2xs group aspect-square flex items-center justify-center ${
                            isPrimary ? 'border-amber-400 ring-2 ring-amber-300/30' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={photo.dataUrl}
                            alt={`Defect ${index + 1}`}
                            onClick={() => setPreviewLightbox(photo)}
                            className="w-full h-full object-cover cursor-pointer"
                          />
                          {isPrimary && (
                            <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              ★ Main
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-[10px] font-bold flex items-center justify-center transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* ================= RIGHT COLUMN: INTERACTIVE LEAFLET LOCATION PICKER (6 cols on Desktop) ================= */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Standalone LocationPicker Subcomponent */}
              <LocationPicker
                location={location}
                onLocationChange={(newLoc) => setLocation(newLoc)}
              />

              {/* Civic Submission Summary Note */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <span>ℹ️</span> Accurate Civic Verification
                </div>
                <p className="text-[11px] text-blue-800/80 leading-relaxed">
                  Your GPS coordinates are automatically mapped to Nagpur Municipal Corporation's spatial database. This ensures the correct local ward field workers are dispatched directly to the repair site.
                </p>
              </div>

            </div>

          </div>

          {/* ================= SUBMISSION ERROR BANNER ================= */}
          {submitError && (
            <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                  <span>⚠️</span> Submission Failed
                </span>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="text-xs text-red-600 hover:text-red-900 font-bold"
                >
                  &times; Dismiss
                </button>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">
                {submitError}
              </p>
              <div className="pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Retry Submission
                </button>
              </div>
            </div>
          )}

          {/* ================= ACTION BUTTONS ================= */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {!isDescriptionValid && currentLength > 0 && (
                <span className="text-amber-600 font-medium">
                  ⚠️ Description requires {charsRemaining} more character{charsRemaining > 1 ? 's' : ''} to submit.
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate('/citizen')}
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer order-2 sm:order-1"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full sm:w-auto py-4 px-8 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md order-1 sm:order-2 ${
                  isFormValid && !isSubmitting
                    ? 'bg-[#1A56DB] hover:bg-[#1546b5] text-white shadow-blue-600/25 active:scale-[0.99] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting Complaint...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Civic Complaint</span>
                    <span className="text-base font-bold">&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 mt-5">
            Municipal Corporation &bull; Citizen Grievance Redressal System &bull; Lead: Faizan Rayeen
          </div>
        </form>

      </div>

      {/* ================= LIVE WEBCAM / CAMERA VIEWFINDER MODAL ================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl overflow-hidden max-w-lg w-full border border-slate-700 shadow-2xl flex flex-col animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
                  Live Camera Viewfinder
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Switch camera"
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>🔄</span>
                  <span className="hidden sm:inline">Flip</span>
                </button>

                <button
                  type="button"
                  onClick={stopCameraStream}
                  aria-label="Close camera"
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-600 text-white font-bold flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Video Viewport / Error Display */}
            <div className="relative bg-black w-full aspect-4/3 sm:aspect-16/10 flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-sm">
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-900/60 text-red-300 flex items-center justify-center text-2xl">
                    🚫
                  </div>
                  <h3 className="text-sm font-bold text-white">Camera Access Error</h3>
                  <p className="text-xs text-red-200/90 leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => startCameraStream()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraStream();
                        cameraInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                    >
                      Select Photo from Device Instead
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-white/30 rounded-2xl flex flex-col justify-between p-2">
                    <div className="flex justify-between text-[10px] text-white/70 font-mono">
                      <span>[REC LIVE]</span>
                      <span>1280p</span>
                    </div>
                    <div className="text-center text-[11px] text-white/80 bg-black/40 backdrop-blur-xs py-1 px-3 rounded-full mx-auto font-medium">
                      Position civic issue inside frame
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Shutter Controls Footer */}
            <div className="p-4 sm:p-5 bg-slate-950 flex items-center justify-between gap-4 border-t border-slate-800">
              <button
                type="button"
                onClick={stopCameraStream}
                className="text-xs font-bold text-slate-400 hover:text-white transition px-3 py-2 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(cameraError) || isCapturingFrame}
                onClick={capturePhotoFromStream}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-black text-xs sm:text-sm text-white shadow-lg transition active:scale-95 cursor-pointer ${
                  cameraError || isCapturingFrame
                    ? 'opacity-40 bg-slate-700 cursor-not-allowed'
                    : 'bg-[#1A56DB] hover:bg-blue-600 ring-4 ring-blue-500/30'
                }`}
              >
                <span className="text-lg">📸</span>
                <span>{isCapturingFrame ? 'Capturing...' : 'Click Photo'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  galleryInputRef.current?.click();
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition px-3 py-2 cursor-pointer"
              >
                Gallery &rarr;
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= LIGHTBOX ZOOM MODAL ================= */}
      {previewLightbox && (
        <div
          onClick={() => setPreviewLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl border border-white/20 animate-scaleIn"
          >
            <div className="relative bg-slate-900 max-h-[60vh] flex items-center justify-center overflow-hidden">
              <img
                src={previewLightbox.dataUrl}
                alt="Enlarged defect proof"
                className="max-h-[60vh] w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setPreviewLightbox(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white font-bold flex items-center justify-center hover:bg-red-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {previewLightbox.name}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                  {formatFileSize(previewLightbox.compressedSize)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Optimized to {previewLightbox.width} &times; {previewLightbox.height} px using HTML5 Canvas.
              </p>
              <button
                type="button"
                onClick={() => setPreviewLightbox(null)}
                className="w-full py-2.5 mt-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DAY 14: ANIMATED PULSE LOADER MODAL ================= */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-5 animate-scaleIn">
            
            {/* Animated Multi-Ring Pulse Radar */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
              <div className="absolute inset-2 rounded-full bg-[#1A56DB]/30 animate-pulse"></div>
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1A56DB] to-cyan-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-500/30">
                <svg className="animate-spin w-7 h-7 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              </div>
            </div>

            {/* Heading & Subtitle */}
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                {submitStage}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Please wait while the Municipal AI Engine processes defect photos and maps coordinates.
              </p>
            </div>

            {/* Step Progress Indicators */}
            <div className="w-full space-y-2 pt-2 text-left">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-200 font-medium">1. Photos Compressed & Uploaded</span>
                <span className="ml-auto text-[10px] text-emerald-400 font-bold">✓ Ready</span>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                <span className="text-slate-200 font-medium">2. AI YOLOv8 Civic Verification</span>
                <span className="ml-auto text-[10px] text-blue-400 font-bold">Analyzing...</span>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-slate-400 font-medium">3. Ward Jurisdiction & SLA Routing</span>
                <span className="ml-auto text-[10px] text-slate-500 font-bold">Queued</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= DAY 14: SUCCESS CONFIRMATION MODAL ================= */}
      {isSuccessModalOpen && submittedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Green Celebratory Header */}
            <div className="bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-white pt-8 pb-4 px-6 text-center space-y-3">
              
              {/* Green Checkmark Animation */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-60"></div>
                <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <svg className="w-9 h-9 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Complaint Registered Successfully!
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Your civic issue has been officially logged with the Municipal Corporation portal.
                </p>
              </div>

              {/* Ticket Badge with Copy Button */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Complaint ID:</span>
                  <span className="text-sm sm:text-base font-black font-mono tracking-wider text-emerald-400">
                    {submittedComplaint.tracking_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyTicket(submittedComplaint.tracking_id)}
                    title="Copy Complaint ID"
                    className="ml-1 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs"
                  >
                    {copiedTicket ? '✓ Copied' : '📋'}
                  </button>
                </div>
              </div>

              {/* Expected SLA Badge */}
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  <span>⏱️</span>
                  <span>Target resolution within 48 hours</span>
                </span>
              </div>
            </div>

            {/* Summary Body */}
            <div className="p-5 sm:p-6 space-y-3.5 bg-slate-50 border-y border-slate-100 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="text-xs font-black text-slate-800 truncate block mt-0.5">
                    {submittedComplaint.category}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {submittedComplaint.department}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Ward</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">
                    {submittedComplaint.ward}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold block">
                    Status: {submittedComplaint.status}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GPS Location</span>
                <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed">
                  {submittedComplaint.address}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
                  <span>Nagpur Municipal Spatial DB</span>
                  <span>&bull;</span>
                  <span>{submittedComplaint.photo_count} Photo(s) Attached</span>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="p-4 sm:p-6 bg-white space-y-2.5">
              <button
                type="button"
                onClick={() => navigate(`/citizen/complaint/${submittedComplaint.id || submittedComplaint.tracking_id}`)}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#1A56DB] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Track Issue Status</span>
                <span className="text-base">&rarr;</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/citizen')}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Back to Citizen Home
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
                >
                  + File Another Issue
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CitizenSubmit;
