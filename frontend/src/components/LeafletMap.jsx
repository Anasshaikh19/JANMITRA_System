import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  createCategorySvgIcon,
  createPickerSvgIcon,
  createUserLocationSvgIcon,
  getCategoryMeta,
  normalizeCategory,
  CATEGORY_PALETTE,
} from '../utils/mapIcons';

// Fix default Leaflet icon assets
delete L.Icon.Default.prototype._getIconUrl;

/**
 * Auto-fit bounds component that smoothly calculates the bounding box
 * for all markers or smoothly repositions to a single coordinate.
 */
const MapAutoFitBounds = ({ markers, center, singleZoom = 15, autoFit = true, padding = [45, 45] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Crucial: Leaflet requires invalidateSize when rendered in dynamic tabs or conditional containers
    try {
      map.invalidateSize();
    } catch {}

    const timer1 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 150);

    const timer2 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 450);

    if (!autoFit) {
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }

    if (markers && markers.length > 0) {
      const validPoints = markers
        .map((m) => [
          Number(m.lat ?? m.location_lat),
          Number(m.lng ?? m.location_lng),
        ])
        .filter(
          ([lat, lng]) =>
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            lat !== 0 &&
            lng !== 0
        );

      if (validPoints.length === 1) {
        map.setView(validPoints[0], Math.max(map.getZoom() || singleZoom, singleZoom), {
          animate: true,
          duration: 0.6,
        });
      } else if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, {
          padding,
          maxZoom: 16,
          animate: true,
          duration: 0.8,
        });
      }
    } else if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom() || singleZoom, {
        animate: true,
        duration: 0.5,
      });
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [markers, center, autoFit, singleZoom, map, padding]);

  return null;
};

/**
 * Click-to-select location capturer for picker mode
 */
const MapClickCapture = ({ onLocationSelect, enabled }) => {
  useMapEvents({
    click(e) {
      if (enabled && onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

/**
 * Custom Floating Touch Map Controls
 * Optimized for mobile touch targets (40px+ tap area)
 */
const TouchMapControls = ({
  onZoomIn,
  onZoomOut,
  onRecenter,
  onFitBounds,
  hasMultipleMarkers,
  showLocate = true,
  locating = false,
}) => {
  return (
    <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-2 pointer-events-auto">
      {/* Zoom In & Out */}
      <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 overflow-hidden">
        <button
          type="button"
          onClick={onZoomIn}
          className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 font-bold text-lg select-none"
          title="Zoom in (or pinch to zoom)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors font-bold text-lg select-none"
          title="Zoom out (or pinch to zoom)"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Auto-fit All Markers Button (in worker route view) */}
      {hasMultipleMarkers && (
        <button
          type="button"
          onClick={onFitBounds}
          className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-blue-50/50 active:scale-95 transition-all"
          title="Fit all route markers in view"
          aria-label="Fit all markers"
        >
          <span className="text-base">🎯</span>
        </button>
      )}

      {/* GPS Locate Button */}
      {showLocate && (
        <button
          type="button"
          onClick={onRecenter}
          disabled={locating}
          className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-700 hover:text-primary hover:bg-blue-50/50 active:scale-95 transition-all disabled:opacity-50"
          title="Recenter to my GPS position"
          aria-label="Recenter GPS"
        >
          <span className={locating ? 'animate-spin text-sm' : 'text-base'}>
            {locating ? '⌛' : '📍'}
          </span>
        </button>
      )}
    </div>
  );
};

/**
 * LeafletMap Component
 *
 * Enhanced Features:
 * 1. Custom SVG marker pins colored by municipal category:
 *    - Blue for PWD
 *    - Green for SWM
 *    - Cyan for PHE
 *    - Yellow for Electrical
 * 2. Smooth pinch-to-zoom and pan gestures on touch devices (zoomSnap 0.25, zoomDelta 0.5).
 * 3. Auto-fit bounds to display all complaint markers in worker route view.
 * 4. Interactive popups, route polyline connection, and reverse geocoding.
 */
const LeafletMap = ({
  lat,
  lng,
  category = 'PWD',
  readonly = false,
  markers = null,
  activeMarkerId = null,
  showRouteLine = false,
  showLegend = true,
  autoFit = true,
  onLocationChange,
  onMarkerClick,
  className = 'h-80 w-full rounded-2xl shadow-sm',
}) => {
  // Default coordinates: New Delhi civic center
  const defaultCenter = [28.6139, 77.209];

  const mapInstanceRef = useRef(null);
  const singleMarkerRef = useRef(null);

  const [position, setPosition] = useState(() => {
    if (lat && lng) return [Number(lat), Number(lng)];
    return defaultCenter;
  });

  const [userLocation, setUserLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Sync position prop
  useEffect(() => {
    if (lat && lng) {
      setPosition([Number(lat), Number(lng)]);
    }
  }, [lat, lng]);

  // Reverse geocoding via OpenStreetMap Nominatim
  const fetchAddress = useCallback(async (latitude, longitude) => {
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );
      if (response.ok) {
        const data = await response.json();
        setAddress(data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } else {
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // GPS auto-detection
  const handleDetectGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setPosition(coords);
        setGpsLoading(false);

        if (!readonly && onLocationChange) {
          onLocationChange(pos.coords.latitude, pos.coords.longitude);
        }
        fetchAddress(pos.coords.latitude, pos.coords.longitude);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(coords, 16, { animate: true });
        }
      },
      () => {
        setGpsLoading(false);
        setGpsError('Unable to detect GPS. You can drag the pin or tap the map.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [readonly, onLocationChange, fetchAddress]);

  // Initial detection when mounted in picker mode with no coords
  useEffect(() => {
    if (!readonly && (!lat || !lng)) {
      handleDetectGPS();
    } else if (position[0] && position[1]) {
      fetchAddress(position[0], position[1]);
    }
  }, [readonly]);

  // Drag handler for picker mode
  const markerEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = singleMarkerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          setPosition([newPos.lat, newPos.lng]);
          if (onLocationChange) {
            onLocationChange(newPos.lat, newPos.lng);
          }
          fetchAddress(newPos.lat, newPos.lng);
        }
      },
    }),
    [onLocationChange, fetchAddress]
  );

  const handleMapClick = (clickLat, clickLng) => {
    setPosition([clickLat, clickLng]);
    if (onLocationChange) {
      onLocationChange(clickLat, clickLng);
    }
    fetchAddress(clickLat, clickLng);
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // Manual trigger to fit all markers
  const handleFitAllMarkers = () => {
    if (!mapInstanceRef.current || !markers || markers.length === 0) return;
    const validPoints = markers
      .map((m) => [Number(m.lat ?? m.location_lat), Number(m.lng ?? m.location_lng)])
      .filter(([l1, l2]) => !isNaN(l1) && !isNaN(l2) && l1 !== 0 && l2 !== 0);

    if (validPoints.length === 1) {
      mapInstanceRef.current.setView(validPoints[0], 15, { animate: true });
    } else if (validPoints.length > 1) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(validPoints), {
        padding: [50, 50],
        maxZoom: 16,
        animate: true,
      });
    }
  };

  // Check if multiple markers view is active
  const hasMultipleMarkers = Array.isArray(markers) && markers.length > 0;

  // Filter valid route points for Polyline
  const routePoints = useMemo(() => {
    if (!hasMultipleMarkers || !showRouteLine) return [];
    return markers
      .map((m) => [Number(m.lat ?? m.location_lat), Number(m.lng ?? m.location_lng)])
      .filter(([l1, l2]) => !isNaN(l1) && !isNaN(l2) && l1 !== 0 && l2 !== 0);
  }, [hasMultipleMarkers, showRouteLine, markers]);

  // Single marker custom SVG icon
  const singleMarkerIcon = useMemo(() => {
    if (!readonly) {
      return createPickerSvgIcon({ category });
    }
    return createCategorySvgIcon({
      category,
      isSelected: true,
    });
  }, [readonly, category]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${position[0]},${position[1]}`;

  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className={`relative overflow-hidden border border-slate-200/90 bg-slate-100 ${className}`} style={{ minHeight: "380px" }}>
        {/* Category Legend Pill Overlay */}
        {showLegend && (
          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200/80 text-[11px] font-bold text-slate-700 flex items-center gap-2.5 flex-wrap pointer-events-auto">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold mr-0.5">
              Categories:
            </span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>PWD</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>SWM</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
              <span>PHE</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>Electrical</span>
            </div>
          </div>
        )}

        <MapContainer
          center={position}
          zoom={15}
          // Smooth pinch-to-zoom & pan configuration on mobile/touch
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={120}
          touchZoom={true}
          dragging={true}
          doubleClickZoom={true}
          bounceAtZoomLimits={false}
          preferCanvas={true}
          scrollWheelZoom={!readonly}
          zoomControl={false} // Replaced by high-touch target custom controls
          ref={mapInstanceRef}
          className="h-full w-full z-0 touch-pan-x touch-pan-y"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Dynamic Auto-Fit Bounds */}
          <MapAutoFitBounds
            markers={markers}
            center={position}
            autoFit={autoFit}
            singleZoom={15}
          />

          {/* Touch Click Capturer in Picker Mode */}
          {!readonly && (
            <MapClickCapture enabled={!readonly} onLocationSelect={handleMapClick} />
          )}

          {/* Dotted Route Connection Line in Worker Route View */}
          {showRouteLine && routePoints.length > 1 && (
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: '#2563EB',
                weight: 3.5,
                opacity: 0.75,
                dashArray: '8, 8',
                lineJoin: 'round',
              }}
            />
          )}

          {/* User Live GPS Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={createUserLocationSvgIcon()}>
              <Popup>
                <div className="p-2 text-xs font-bold text-slate-800">
                  📍 Your Current Location
                </div>
              </Popup>
            </Marker>
          )}

          {/* Multiple Markers Mode (Worker Route View) */}
          {hasMultipleMarkers ? (
            markers.map((item, idx) => {
              const itemLat = Number(item.lat ?? item.location_lat);
              const itemLng = Number(item.lng ?? item.location_lng);
              if (isNaN(itemLat) || isNaN(itemLng) || itemLat === 0 || itemLng === 0) {
                return null;
              }

              const itemCategory = item.category || item.dept || 'PWD';
              const isSelected = activeMarkerId === item.id;
              const isCritical = item.priority === 'Critical';
              const stopNumber = item.stopNumber ?? idx + 1;
              const icon = createCategorySvgIcon({
                category: itemCategory,
                number: stopNumber,
                isCritical,
                isSelected,
              });

              const meta = getCategoryMeta(itemCategory);

              return (
                <Marker
                  key={item.id || idx}
                  position={[itemLat, itemLng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => onMarkerClick && onMarkerClick(item),
                  }}
                >
                  <Popup>
                    <div className="p-3 max-w-[260px] text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-mono font-black text-slate-900">
                          {item.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${meta.badgeBg}`}
                        >
                          {meta.code}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-slate-800 line-clamp-2">
                          {item.description || item.title || 'Civic Complaint'}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-1 flex items-start gap-1">
                          <span>📍</span>
                          <span className="break-words line-clamp-2">
                            {item.address || `${itemLat.toFixed(5)}, ${itemLng.toFixed(5)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            item.priority === 'Critical'
                              ? 'bg-red-100 text-red-800'
                              : item.priority === 'High'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.priority || 'Medium'}
                        </span>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${itemLat},${itemLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                        >
                          🧭 Navigate
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })
          ) : (
            /* Single Marker Mode (Picker or Single Display) */
            <Marker
              draggable={!readonly}
              eventHandlers={!readonly ? markerEventHandlers : undefined}
              position={position}
              ref={singleMarkerRef}
              icon={singleMarkerIcon}
            >
              <Popup>
                <div className="p-2.5 text-xs space-y-1">
                  <div className="font-bold text-slate-900">
                    {readonly ? 'Grievance Location' : 'Selected Location'}
                  </div>
                  <div className="text-slate-600 text-[11px] break-words">
                    {address || `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Lat: {position[0].toFixed(5)} • Lng: {position[1].toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating Touch Controls */}
        <TouchMapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRecenter={handleDetectGPS}
          onFitBounds={handleFitAllMarkers}
          hasMultipleMarkers={hasMultipleMarkers}
          showLocate={!hasMultipleMarkers}
          locating={gpsLoading}
        />
      </div>

      {/* Mode A Details: Address description & hints */}
      {!readonly && !hasMultipleMarkers && (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1.5 shadow-2xs">
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-900 shrink-0">📍 Selected Address:</span>
            <span className="text-slate-800 break-words font-medium">
              {isGeocoding ? 'Detecting address...' : address || 'Tap map or drag marker to set exact location'}
            </span>
          </div>
          <div className="text-slate-500 text-[11px] flex justify-between items-center flex-wrap gap-1">
            <span className="font-mono">
              Coordinates: {Number(position[0]).toFixed(6)}, {Number(position[1]).toFixed(6)}
            </span>
            <span className="text-primary font-semibold">
              💡 Pinch to zoom • Drag pin to refine
            </span>
          </div>
          {gpsError && <p className="text-amber-700 text-[11px] font-semibold">{gpsError}</p>}
        </div>
      )}

      {/* Mode B Details: External navigation link for single marker */}
      {readonly && !hasMultipleMarkers && (
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-2xs gap-3">
          <div className="text-xs text-slate-700">
            <p className="font-bold text-slate-900">Complaint Location</p>
            <p className="text-slate-500 text-[11px] break-words line-clamp-1">
              {address ? address : `${Number(position[0]).toFixed(5)}, ${Number(position[1]).toFixed(5)}`}
            </p>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-primary hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition shrink-0"
          >
            <span>🧭</span>
            <span>Google Maps</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default LeafletMap;
