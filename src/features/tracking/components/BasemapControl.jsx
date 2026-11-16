import { MapTrifold, Mountains, Planet } from '@phosphor-icons/react';
import { useLanguage } from '@/contexts/LanguageContext';

export const BASEMAP_MODES = [
  { id: 'streets', label: 'Street', fullLabel: 'Street map', labelKey: 'tracking.basemap.streets', fullKey: 'tracking.basemap.streetsFull', Icon: MapTrifold },
  { id: 'satellite', label: 'Satellite', fullLabel: 'Satellite', labelKey: 'tracking.basemap.satellite', fullKey: 'tracking.basemap.satelliteFull', Icon: Planet },
  { id: 'terrain', label: 'Terrain', fullLabel: 'Terrain', labelKey: 'tracking.basemap.terrain', fullKey: 'tracking.basemap.terrainFull', Icon: Mountains },
];

/**
 * Option 1 Global Basemap Switcher (Yandex / Grab 1-Tap Segmented Squircle Bar).
 * Renders a crisp top-right (or custom-positioned) 1-tap squircle segmented bar
 * so users can switch between Street, Satellite, and Terrain views immediately
 * without opening a hidden popup menu.
 */
export default function BasemapControl({ value, onChange, className = '' }) {
  const { t } = useLanguage();
  return (
    <div
      className={`mc-basemap-segmented ${className}`}
      role="group"
      aria-label={t('tracking.basemap.aria')}
    >
      {BASEMAP_MODES.map(({ id, labelKey, fullKey }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            title={t(fullKey)}
            className={`mc-basemap-segmented__btn${active ? ' is-active' : ''}`}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
