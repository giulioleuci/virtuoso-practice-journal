# Palette's Journal - Virtuoso Practice Journal

This journal tracks critical UX and accessibility learnings for the Virtuoso Practice Journal project.

## 2024-05-13 - Focus Indicators on Interactive Cards
**Learning:** Large interactive cards (like EmptyState with CTAs) often miss clear focus indicators if they aren't using standard button components. This breaks keyboard navigation discoverability.
**Action:** Always ensure interactive elements, especially those rendered as polymorphic `button` or `a` tags, have `focus-visible` styles that provide high contrast (e.g., using Tailwind's `ring-ring`).

## 2024-05-13 - Preventing Content Flickering in Motivational UI
**Learning:** When using randomized content (like motivational quotes or tips) in functional components, generating a new random value on every re-render causes a "flickering" effect that makes the UI feel unstable and distracting. This is especially noticeable in React when parent state changes or during hydration.
**Action:** Always memoize the selection of randomized content using `useMemo` with an empty dependency array (or a specific trigger like a date change) to ensure the content remains stable throughout the user's session or until a logical refresh point.
