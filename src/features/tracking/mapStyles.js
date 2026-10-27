import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// Vite emits the worker as a bundled asset only when imported explicitly;
// MapLibre's runtime import.meta.url lookup points at a file the build never copies.
setWorkerUrl(maplibreWorkerUrl);

// Keyless raster tiles shared by the onboarding picker and the live tracker so
// both maps read alike. Tile frames are muted in CSS (see index.css).
export const STYLE_STREETS = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export const STYLE_SATELLITE = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

export const STYLE_TERRAIN = {
  version: 8,
  sources: {
    'esri-topo': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, HERE, Garmin, FAO, NOAA, USGS',
    },
  },
  layers: [{ id: 'esri-topo', type: 'raster', source: 'esri-topo' }],
};

export const BASEMAP_STYLES = {
  streets: STYLE_STREETS,
  satellite: STYLE_SATELLITE,
  terrain: STYLE_TERRAIN,
};

// GeoJSON layers are painted into the same canvas as the raster tiles, so the
// basemap CSS filter also transforms route/trail colours. Inverting the filter
// chain (same parameters as --mc-tiles-*-filter in index.css) lets overlay
// paint keep its intended on-screen colour.
const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const multiply = (a, b) => a.map((row) => (
  [0, 1, 2].map((column) => row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column])
));

const multiplyVec = (matrix, vector) => matrix.map(
  (row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]
);

const invert3 = (matrix) => {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
};

const scale = (k) => ({ matrix: [[k, 0, 0], [0, k, 0], [0, 0, k]], offset: [0, 0, 0] });
const contrast = (k) => ({ matrix: scale(k).matrix, offset: [0.5 - 0.5 * k, 0.5 - 0.5 * k, 0.5 - 0.5 * k] });
const invert = () => ({ matrix: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]], offset: [1, 1, 1] });

const hueRotate = (deg) => {
  const radians = (deg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    matrix: [
      [0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928],
      [0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283],
      [0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072],
    ],
    offset: [0, 0, 0],
  };
};

const saturate = (s) => ({
  matrix: [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ],
  offset: [0, 0, 0],
});

const compose = (steps) => steps.reduce((acc, step) => {
  const shiftedOffset = multiplyVec(step.matrix, acc.offset);
  return {
    matrix: multiply(step.matrix, acc.matrix),
    offset: step.offset.map((value, index) => value + shiftedOffset[index]),
  };
}, { matrix: IDENTITY, offset: [0, 0, 0] });

const FORWARD_TREATMENTS = {
  muted: compose([scale(1.04), contrast(0.94), saturate(0.48)]),
  dark: compose([invert(), hueRotate(180), scale(0.85), contrast(0.9), saturate(0.5)]),
};

const INVERSE_TREATMENTS = Object.fromEntries(Object.entries(FORWARD_TREATMENTS).map(([key, forward]) => {
  const inverseMatrix = invert3(forward.matrix);
  return [key, {
    matrix: inverseMatrix,
    offset: multiplyVec(inverseMatrix, forward.offset).map((value) => -value),
  }];
}));

const clamp = (value) => Math.max(0, Math.min(1, value));

/** Pre-inverts a hex colour so it renders unchanged inside a filtered canvas. */
export const overlayPaintColor = (hex, treatment) => {
  const inverse = INVERSE_TREATMENTS[treatment];
  if (!inverse) return hex;
  const rgb = [0, 1, 2].map((index) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255);
  const solved = multiplyVec(inverse.matrix, rgb).map((value, index) => clamp(value + inverse.offset[index]));
  return `#${solved.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join('')}`;
};

export const LOCATE_ZOOM = 17.5;

// flyTo arcs out to frame the origin and target together, so locating a distant
// point visibly zooms out first; a long eased pan instead flies over unloaded
// tiles. Nearby targets keep the fly-in, distant ones cut over and zoom in.
export const focusOnLocation = (map, lngLat) => {
  if (!map) return;
  const zoom = Math.max(map.getZoom(), LOCATE_ZOOM);
  const from = map.project(map.getCenter());
  const to = map.project(lngLat);
  const { clientWidth, clientHeight } = map.getContainer();
  const travel = Math.hypot(to.x - from.x, to.y - from.y);

  if (travel <= Math.min(clientWidth, clientHeight) * 0.8) {
    map.flyTo({ center: lngLat, zoom, pitch: 0, essential: true });
    return;
  }

  map.jumpTo({ center: lngLat });
  map.easeTo({ zoom, pitch: 0, duration: 1100, essential: true });
};

