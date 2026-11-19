# Collapsed sidebar icon rail

Approved in chat: collapse the desktop sidebar to an approximately 80px rail only when the user clicks the logo. Clicking again restores the expanded sidebar. Apply to patient, provider, and admin portals.

Keep navigation icons clickable, retain active highlights and notification badges, and show labels on hover and keyboard focus. Hide the wordmark and section labels in the rail. Preserve mobile navigation and existing UI scaling.

## Approaches

The existing implementation hides the sidebar completely and moves the logo to the header. The selected approach keeps a narrow icon rail, giving users direct access to navigation while freeing content space. Automatic collapse on smaller screens was considered; the user explicitly chose click-only collapse.

## Constraints and implementation choices

Use the shared DashboardLayout and existing React, Tailwind, and theme mechanisms; add no dependencies. Use responsive classes to keep mobile expanded even when the desktop preference is collapsed. Use accessible link names and tooltips rendered outside the clipped sidebar. Keep changes confined to layout behavior; no backend work.
