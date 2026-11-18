# Shared location picker fixes

The shared ModernLocationPicker is used by patient/provider onboarding, profile addresses and booking/visit destinations.

- Nearby location focus uses easeTo instead of flyTo to avoid the zoom-out arc. Long-distance targets retain jump then eased zoom-in.
- Geographic movement invalidates pending reverse-geocoding work. Request versions and map identity reject stale or unmounted results. Same-position moveend events from padding/resize/zoom do not publish a new pin or restart address lookup.
- Provider onboarding now consumes displayName, flyToLocation({lat,lng}), pending and resolved, matching the shared picker API. Coordinate validity does not depend on the external address lookup.
- Destination dialog initializes its draft on opening, preserving selected pins/details when parent props rerender while open.
- Autocomplete invalidates old requests on every keystroke and selection, including pending debounce work.

Verification: 21 focused tests passed across map focus, picker callback races/padding, destination draft persistence, address formatting and provider onboarding. A real MapLibre blank-map browser probe at zoom 18 with a nearby target measured minimum zoom 18 after the fix (previously 17.731). The probe requested no user geolocation and modified no live records. Real-device GPS/network behavior and saved booking/profile flows still require a user test after frontend deployment.
