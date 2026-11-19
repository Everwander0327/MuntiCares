# Sidebar icon rail implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this small layout change inline. Steps use checkbox syntax for tracking.

**Goal:** Keep an icon-only desktop sidebar when the user clicks collapse.

**Architecture:** Update the shared DashboardLayout so all roles use the same responsive rail. Keep the logo in place to toggle expansion and render hover/focus tooltips through a portal.

**Tech Stack:** React, Tailwind CSS, existing Framer Motion and theme scaling.

**Spec:** docs/superpowers/specs/2026-11-19-sidebar-icon-rail-design.md

## Global constraints

- Click-only collapse; approximately 80px rail adjusted for UI scaling.
- Retain active states, badges, and mobile navigation.
- No new dependencies or backend changes.

## Review focus

- Mobile after desktop collapse still has full labels and drawer width.
- Keyboard focus exposes a readable label without clipping.
- Notification badges fit the rail.
- Expanded layout keeps existing spacing.
- Repeat toggles have no pending animation timers.

### Task 1: Update shared sidebar

**Files:** Modify src/layouts/DashboardLayout.jsx.

**Interfaces:** SidebarItem accepts a collapsed boolean; DashboardShell owns the existing collapse state.

- [x] Replace timed rollup with direct collapse state and responsive rail width.
- [x] Keep the logo toggle in the sidebar and hide desktop labels while collapsed.
- [x] Preserve badges and add hover/focus tooltips and accessible names.
- [ ] Run ESLint for the changed file and production build; inspect the diff against the review focus.

Verification uses lint/build and layout inspection for this reversible presentation change rather than adding implementation-mirroring tests. Existing unrelated working-tree edits must be preserved.
