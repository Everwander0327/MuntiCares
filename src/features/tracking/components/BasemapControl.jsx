import { Map as MapIcon, Mountain, Satellite } from 'lucide-react';

export const BASEMAP_MODES = [
  { id: 'streets', label: 'Street', fullLabel: 'Street map', Icon: MapIcon },
  { id: 'satellite', label: 'Satellite', fullLabel: 'Satellite', Icon: Satellite },
  { id: 'terrain', label: 'Terrain', fullLabel: 'Terrain', Icon: Mountain },
];

/**
 * Option 1 Global Basemap Switcher (Yandex / Grab 1-Tap Segmented Squircle Bar).
 * Renders a crisp top-right (or custom-positioned) 1-tap squircle segmented bar
 * so users can switch between Street, Satellite, and Terrain views immediately
 * without opening a hidden popup menu.
 */
export default function BasemapControl({ value, onChange, className = '' }) {
  return (
    <div
      className={`mc-basemap-segmented ${className}`}
      role="group"
      aria-label="Base map view"
    >
      {BASEMAP_MODES.map(({ id, label, fullLabel }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            title={fullLabel}
            className={`mc-basemap-segmented__btn${active ? ' is-active' : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
