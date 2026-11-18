import { MapTrifold, Mountains, Planet } from '@phosphor-icons/react';
import { useLanguage } from '@/contexts/LanguageContext';

export const BASEMAP_MODES = [
  { id: 'streets', label: 'Street', fullLabel: 'Street map', labelKey: 'tracking.basemap.streets', fullKey: 'tracking.basemap.streetsFull', Icon: MapTrifold },
  { id: 'satellite', label: 'Satellite', fullLabel: 'Satellite', labelKey: 'tracking.basemap.satellite', fullKey: 'tracking.basemap.satelliteFull', Icon: Planet },
  { id: 'terrain', label: 'Terrain', fullLabel: 'Terrain', labelKey: 'tracking.basemap.terrain', fullKey: 'tracking.basemap.terrainFull', Icon: Mountains },
];

/**
 * Basemap switcher:
 * - `segmented` (default): 3-tab Street / Satellite / Terrain bar for live tracking
 * - `toggle`: single compact Satellite toggle button for doorstep pinning
 */
export default function BasemapControl({ value, onChange, variant = 'segmented', className = '' }) {
  const { t } = useLanguage();

  if (variant === 'toggle') {
    const isSatellite = value === 'satellite';
    const nextMode = isSatellite ? 'streets' : 'satellite';
    const ariaLabel = isSatellite
      ? t('tracking.basemap.switchToStreet')
      : t('tracking.basemap.switchToSatellite');

    return (
      <button
        type="button"
        onClick={() => onChange(nextMode)}
        aria-pressed={isSatellite}
        aria-label={t('tracking.basemap.satelliteFull')}
        title={ariaLabel}
        className={`mc-basemap-toggle-btn${isSatellite ? ' is-active' : ''} ${className}`}
      >
        <Planet className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{t('tracking.basemap.satellite')}</span>
      </button>
    );
  }

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
