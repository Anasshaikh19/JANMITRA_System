import L from 'leaflet';

/**
 * Category color definitions according to municipal department specifications:
 * - Blue for PWD (Roads & Infrastructure)
 * - Green for SWM (Solid Waste Management)
 * - Cyan for PHE (Public Health Engineering / Water & Drainage)
 * - Yellow for Electrical (Street Lighting & Electrical)
 */
export const CATEGORY_PALETTE = {
  PWD: {
    code: 'PWD',
    label: 'PWD (Roads & Infrastructure)',
    color: '#2563EB',       // Blue
    darkColor: '#1D4ED8',
    lightColor: '#DBEAFE',
    ringColor: 'rgba(37, 99, 235, 0.4)',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    iconText: '🛣️',
  },
  SWM: {
    code: 'SWM',
    label: 'SWM (Solid Waste Management)',
    color: '#10B981',       // Green
    darkColor: '#059669',
    lightColor: '#D1FAE5',
    ringColor: 'rgba(16, 185, 129, 0.4)',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconText: '🗑️',
  },
  PHE: {
    code: 'PHE',
    label: 'PHE (Water & Drainage)',
    color: '#06B6D4',       // Cyan
    darkColor: '#0891B2',
    lightColor: '#CFFAFE',
    ringColor: 'rgba(6, 182, 212, 0.4)',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconText: '💧',
  },
  Electrical: {
    code: 'Electrical',
    label: 'Street Lighting & Electrical',
    color: '#EAB308',       // Yellow
    darkColor: '#CA8A04',
    lightColor: '#FEF08A',
    ringColor: 'rgba(234, 179, 8, 0.4)',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    iconText: '💡',
  },
};

/**
 * Maps raw complaint category strings or department acronyms to standardized category keys.
 */
export const normalizeCategory = (categoryOrDept = '') => {
  const norm = String(categoryOrDept || '').trim().toLowerCase();

  if (norm.includes('pwd') || norm.includes('road') || norm.includes('infra')) {
    return 'PWD';
  }
  if (norm.includes('swm') || norm.includes('garb') || norm.includes('waste') || norm.includes('sanit')) {
    return 'SWM';
  }
  if (norm.includes('phe') || norm.includes('water') || norm.includes('drain') || norm.includes('wsd') || norm.includes('sewag')) {
    return 'PHE';
  }
  if (norm.includes('electr') || norm.includes('light') || norm.includes('power') || norm.includes('elec')) {
    return 'Electrical';
  }

  return 'PWD';
};

/**
 * Get category metadata for given raw category or department string.
 */
export const getCategoryMeta = (categoryOrDept = '') => {
  const key = normalizeCategory(categoryOrDept);
  return CATEGORY_PALETTE[key] || CATEGORY_PALETTE.PWD;
};

/**
 * SVG Inner Glyphs for categories
 */
const CATEGORY_GLYPHS = {
  PWD: `
    <path d="M13 19L14.2 13H17.8L19 19H13Z" fill="#1D4ED8"/>
    <path d="M15.5 13.5V18.5" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="1.5 1"/>
  `,
  SWM: `
    <path d="M13.5 14H18.5M14 14V18.5C14 18.8 14.2 19 14.5 19H17.5C17.8 19 18 18.8 18 18.5V14" stroke="#059669" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M15 12.5H17" stroke="#059669" stroke-width="1.2" stroke-linecap="round"/>
  `,
  PHE: `
    <path d="M16 12.5C16 12.5 13.5 15.5 13.5 17C13.5 18.38 14.62 19.5 16 19.5C17.38 19.5 18.5 18.38 18.5 17C18.5 15.5 16 12.5 16 12.5Z" fill="#0891B2"/>
  `,
  Electrical: `
    <path d="M16.5 12L13.5 16H16L15.5 20L18.5 15.5H16.2L16.5 12Z" fill="#CA8A04"/>
  `,
};

/**
 * Generates an SVG Pin HTML string for Leaflet divIcon.
 * Supports:
 * - Specific category coloring (Blue, Green, Cyan, Yellow)
 * - Stop sequence number (1, 2, 3...) for route view
 * - Critical / In-Progress pulsing ring
 * - Selection highlight
 */
export const generateCategoryPinSvg = ({
  category = 'PWD',
  number = null,
  isCritical = false,
  isSelected = false,
  isDraggable = false,
} = {}) => {
  const meta = getCategoryMeta(category);
  const color = meta.color;
  const darkColor = meta.darkColor;

  const width = isSelected ? 40 : 34;
  const height = isSelected ? 50 : 44;
  const cx = 16;
  const cy = 16;
  const r = 8.5;

  const pulseRing = isCritical || isSelected
    ? `<div class="absolute -top-1.5 -left-1.5 w-[${width + 3}px] h-[${width + 3}px] rounded-full animate-ping pointer-events-none" style="background-color: ${meta.ringColor};"></div>`
    : '';

  const innerContent = number !== null && number !== undefined
    ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="900" fill="${darkColor}">${number}</text>`
    : (CATEGORY_GLYPHS[meta.code] || CATEGORY_GLYPHS.PWD);

  return `
    <div class="relative group select-none flex items-center justify-center transform transition-transform duration-200 hover:scale-110 active:scale-95" style="width: ${width}px; height: ${height}px;">
      ${pulseRing}
      <svg width="${width}" height="${height}" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.32));">
        <!-- Pin Body -->
        <path d="M16 0C7.16 0 0 7.16 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.16 24.84 0 16 0Z" fill="${color}"/>
        <!-- Top Sheen Highlight -->
        <path d="M16 1.5C8.04 1.5 1.5 8.04 1.5 16C1.5 21 6.5 29.5 12 35.5C8 28.5 3 21 3 16C3 8.82 8.82 3 16 3C20.5 3 24.5 5.3 26.8 8.8C24 4.3 20.3 1.5 16 1.5Z" fill="#FFFFFF" opacity="0.22"/>
        <!-- Bottom Accent Stroke -->
        <path d="M16 42C16 42 0 26.5 0 16C0 14.5 0.2 13 0.6 11.6C1.8 23.5 16 38.5 16 42Z" fill="${darkColor}" opacity="0.3"/>
        <!-- Inner White Core -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${darkColor}" stroke-opacity="0.15" stroke-width="0.8"/>
        <!-- Icon or Stop Number -->
        ${innerContent}
      </svg>
      ${isDraggable ? '<div class="absolute -bottom-1 text-[9px] bg-slate-900 text-white font-black px-1.5 py-0.2 rounded-full shadow-sm tracking-tight opacity-90">DRAG</div>' : ''}
    </div>
  `;
};

/**
 * Creates a Leaflet divIcon using the category-colored SVG pin.
 */
export const createCategorySvgIcon = ({
  category = 'PWD',
  number = null,
  isCritical = false,
  isSelected = false,
  isDraggable = false,
} = {}) => {
  const width = isSelected ? 40 : 34;
  const height = isSelected ? 50 : 44;

  return L.divIcon({
    className: 'leaflet-custom-category-pin',
    html: generateCategoryPinSvg({ category, number, isCritical, isSelected, isDraggable }),
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  });
};

/**
 * User GPS Live Location Pulse Marker
 */
export const createUserLocationSvgIcon = () => {
  const html = `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute w-8 h-8 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
      <div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-user-gps-pin',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

/**
 * Picker Marker Icon (Draggable pin with distinct crosshair aesthetic)
 */
export const createPickerSvgIcon = ({ category = 'PWD' } = {}) => {
  return createCategorySvgIcon({
    category,
    isDraggable: true,
    isSelected: true,
  });
};
