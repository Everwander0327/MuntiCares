import { useEffect, useRef, useState } from 'react';
import { Check, Layers, Map as MapIcon, Mountain, Satellite } from 'lucide-react';

export const BASEMAP_MODES = [
  { id: 'streets', label: 'Street map', Icon: MapIcon },
  { id: 'satellite', label: 'Satellite', Icon: Satellite },
  { id: 'terrain', label: 'Terrain', Icon: Mountain },
];

/**
 * Shared by the onboarding picker and the live tracker so both maps expose the
 * same three base maps. Renders the trigger plus a menu that opens beside the
 * control stack (it is a sibling, not a flex item).
 */
export default function BasemapControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (id) => {
    onChange(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mc-map-control"
        title="Change base map"
        aria-label="Change base map"
        aria-expanded={open}
      >
        <Layers className="w-4 h-4" />
      </button>

      {open && (
        <div ref={menuRef} className="mc-basemap" role="group" aria-label="Base map">
          {BASEMAP_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="mc-basemap__item"
              aria-pressed={value === id}
              onClick={() => select(id)}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
              {value === id && <Check className="w-4 h-4 ml-auto" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
