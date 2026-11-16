import React from 'react';
import { Link } from 'react-router-dom';

const MobileNavItem = ({ icon, label, to, active, badge, prominent }) => {
  if (prominent) {
    return (
      <div className="center">
        <div className="cwrap">
          <Link
            to={to}
            className="fab"
            aria-pressed={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            aria-label={badge > 0 ? `${label}, ${badge} new` : label}
          >
            {React.cloneElement(icon, {
              size: 24,
              weight: active ? 'fill' : 'bold',
              'aria-hidden': 'true',
            })}
            {badge > 0 && (
              <span className="badge">{badge > 9 ? '9+' : badge}</span>
            )}
          </Link>
          <span className="clabel">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="tab"
      aria-current={active ? 'page' : undefined}
      aria-label={badge > 0 ? `${label}, ${badge} new` : label}
    >
      <span className="ico">
        {React.cloneElement(icon, {
          size: 19,
          weight: active ? 'fill' : 'regular',
          'aria-hidden': 'true',
        })}
        {badge > 0 && (
          <span className="badge">{badge > 9 ? '9+' : badge}</span>
        )}
      </span>
      <span className="truncate max-w-full px-0.5">{label}</span>
    </Link>
  );
};

export default MobileNavItem;
