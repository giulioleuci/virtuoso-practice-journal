# Virtuoso — UX/UI Design Report

**Scope:** Full audit of every page, modal/sheet, and navigation pattern in the app, with design recommendations tailored to the primary deployment target: Android smartphones running the app via Capacitor (small, portrait-only screen, ~360–414 dp wide, touch-only input, no hover states, no pointer precision).

**Report structure:** Global → Navigation → Per-page/modal → New surfaces → Structural changes. Each recommendation includes: what it is, why it matters on mobile, and its technical complexity.

---

## 0. Methodology & Constraints

### Mobile-first axioms applied throughout

| Constraint | Design implication |
|---|---|
| ~360 px viewport width | No horizontal scrolling; remove side-by-side layouts that compress below ~160 px each |
| Touch targets | Minimum 44 × 44 dp per Google Material (48 dp preferred); current `px-3 py-2` nav items are borderline |
| Thumb reach | Primary actions bottom-center, secondary top-right, tertiary behind swipe/long-press |
| Cognitive load at instrument | User has hands on instrument; UI must be operable with one free hand and minimal reading |
| No hover | All hover-only affordances must become tap-hold or visible icon |
| Android back gesture | Already handled via `useAndroidBackButton`; must remain consistent |
| Keyboard inset | Already handled via `useKeyboardInset`; sheets must scroll their content not the page when keyboard opens |
| Capacitor performance | Code-split lazy loading is already in place; avoid heavy animation libraries |

---

## 1. Global / Cross-Cutting

### 1.1 Typography scale — `text-[11px]` is too small

**Current state:** Nav labels use `text-[11px]`. Many secondary labels inside cards use `text-xs` (12 px). On a ~360 dp device with a standard font size user preference, 11 px renders below Android's minimum legibility recommendation.

**Recommendation:** Raise the minimum body text size to 13 px (`text-sm`). Use 12 px only for truly supplemental metadata (e.g., a session timestamp inside an expanded card). Nav labels should be at least 12 px.

**Complexity:** Low — a one-line Tailwind theme change plus a search-and-replace pass on `text-[11px]` occurrences. No logic changes.

**Impact:** High — legibility improvement on all screens.

---

### 1.2 Touch target audit — interactive rows need min 48 dp height

**Current state:** Many list rows (task cards, library items, lesson cards) rely on their natural content height, which can be ~36–40 px. Buttons inside cards (`px-3 py-1.5`) do not meet the 48 dp minimum.

**Recommendation:** Add a `min-h-[48px]` utility to all tappable list rows and a `min-h-[44px]` to all icon buttons. Create a shared `<TouchRow>` component that wraps content with proper padding and the `active:bg-accent/50` press state.

**Complexity:** Medium — systematic but mechanical; requires reading every card and button in `Diary.tsx`, `Library.tsx`, `Tasks.tsx`, `Lessons.tsx`.

**Impact:** High — reduces mis-taps; critical for one-handed use while holding an instrument.

---

### 1.3 Swipe-to-dismiss on all bottom Sheets

**Current state:** Sheets from shadcn/ui support drag-to-close but the handle indicator ("pill") is small and not always rendered. Users may not discover the gesture.

**Recommendation:** Always render a visible 32 × 4 dp pill handle at the top of every Sheet. Set `snapPoints` at 50 % and 90 % of screen height so dragging halfway snaps to a peek state rather than closing immediately. This is especially important for the `SessionLogSheet` and `NewLibraryItemSheet`, which are tall and benefit from a "half open" preview before the user commits to filling the whole form.

**Complexity:** Medium — requires wrapping shadcn Sheet with a custom `MobileSheet` component that adds the pill and optional snap behavior (using `vaul` Drawer, which shadcn Sheet already uses internally on mobile). No data-layer changes.

**Impact:** High — dramatically improves sheet discoverability and feel on mobile.

---

### 1.4 Empty-state CTAs must be full-width buttons

**Current state:** `EmptyState.tsx` renders a description and an optional icon. Callers add their own CTA button underneath. On mobile, small inline buttons are hard to tap.

**Recommendation:** Add a mandatory `action?: { label: string; onClick: () => void }` prop to `EmptyState`. Render it as a full-width primary button below the description. This drives users immediately to the creation flow.

**Complexity:** Low — prop addition + style change in one component.

**Impact:** Medium — reduces "I don't know what to do" confusion for new users.

---

### 1.5 Toast notifications — duration and position

**Current state:** `sonner` toasts appear at the bottom of the screen. The bottom nav bar occupies the bottom of the screen, and toasts may appear behind or overlap it depending on z-index and `safe-area-inset-bottom`.

**Recommendation:** Set toast `offset` to account for the nav bar height (~80 px + safe-area). Set `duration: 4000` (current Sonner default is 4 s — verify it isn't overridden). Destructive (undo) toasts should persist at 8 s because the user may have their hands on the instrument and look at the screen seconds later.

**Complexity:** Low — Sonner `Toaster` config change in `App.tsx`, plus a CSS variable or constant for nav bar height.

**Impact:** Medium — prevents UI clutter overlap.

---

### 1.6 Pull-to-refresh for live data confirmation

**Current state:** All data is from Dexie live queries which update automatically. However, if a user leaves and returns to the app after a background kill, the Capacitor WebView may have stale state.

**Recommendation:** Implement a pull-to-refresh gesture (using `@vueuse/gesture` or a lightweight custom hook) on the Diary and History pages. On pull, call `db.open()` to re-verify the connection and trigger a toast "Up to date". No actual refetch is needed since Dexie is live.

**Complexity:** Low–Medium — custom hook with `touchstart`/`touchmove`/`touchend`, a CSS spinner, and the DB check.

**Impact:** Low — gives users confidence after app resume; reduces support requests.

---

### 1.7 Haptic feedback for key actions

**Current state:** No haptic feedback is implemented.

**Recommendation:** Use `Capacitor.Plugins.Haptics` (already available if Capacitor is configured) for:
- Task mark complete: `HapticsImpactStyle.Medium`
- Session saved: `HapticsImpactStyle.Light`
- Delete confirmed: `HapticsNotificationType.Warning`
- Streak milestone: `HapticsNotificationType.Success`

**Complexity:** Low — install `@capacitor/haptics`, wrap in a `haptic()` utility, call at 4–5 action sites.

**Impact:** High — makes the app feel native and confirms actions when the user is looking at their instrument, not the screen.

---

### 1.8 Dark mode completeness

**Current state:** The app uses Tailwind CSS variables for theming. `dark:` variants may be partially applied.

**Recommendation:** Audit all `bg-*` and `text-*` classes for hard-coded light-only colors (e.g., `bg-white`, `text-gray-900`). Ensure the Capacitor status bar color (`StatusBar.setBackgroundColor`) matches the theme. Use `window.matchMedia('(prefers-color-scheme: dark)')` to set a `dark` class on `<html>`.

**Complexity:** Medium — systematic audit; no structural changes.

**Impact:** High — musicians often practice in dim rooms at night; dark mode is not optional.

---

## 2. Navigation (AppShell)

### 2.1 Bottom nav touch target width

**Current state:** Each nav item is `min-w-[56px]` with `px-3 py-2`. On a 360 dp screen with 5 items, each item is ~62 dp wide. This is acceptable but tight.

**Recommendation:** Remove the labels from the nav bar by default and show them only when the tab is active (active item shows label, others show icon only). This allows each item to use its full width for the icon touch area (~72 dp each) while keeping the bar height the same. The active label gives enough context. Alternatively, show labels always but increase bar height to `py-3`.

**Complexity:** Low — CSS/JSX change in `AppShell.tsx`.

**Impact:** Medium — cleaner bar, slightly larger tap targets.

---

### 2.2 Tasks is not in the bottom nav

**Current state:** Tasks (`/tasks`) is a full page but is not a bottom nav item. It is only accessible via links from the Diary page or direct URL. This hides a major feature.

**Recommendation:** Replace the `Profile` tab in the bottom nav with a `Tasks` tab. Move Profile to a gear icon in the top-right header of the Diary page (since it is low-frequency). The 5 tabs become: Diary, Library, Tasks, Lessons, History.

**Complexity:** Low — change the `items` array in `AppShell.tsx` and add a header icon link to Profile in `Diary.tsx`.

**Impact:** High — tasks are created daily; burying them behind Diary is a discoverability failure.

---

### 2.3 History is low-frequency — swap with Tasks

**Current state:** History is a level-1 nav item. Tasks is buried. History is consulted perhaps weekly; Tasks is used daily.

**Recommendation:** (Related to 2.2) Move History to be accessible from a button inside both Diary and the Tasks page ("View history" CTA or a chart icon in the header). Free the nav slot for Tasks.

**Complexity:** Low — nav array change + adding a History link/button in two pages.

**Impact:** High — aligns the nav with actual usage frequency.

---

### 2.4 Active tab indicator animation jitter

**Current state:** The active tab scales to `scale-[1.06]` with a 300 ms ease-out. On low-end Android, this animation can jitter during navigation because React is also re-rendering the outlet.

**Recommendation:** Move the scale and translate animation to `will-change: transform` on the nav items. Debounce the active state change by 16 ms to avoid animation fighting with the router transition.

**Complexity:** Low — CSS + small timing fix.

**Impact:** Low — polish item.

---

### 2.5 Page transitions

**Current state:** No page transition animations exist between routes. The page content snaps in immediately.

**Recommendation:** Add a fade-up slide transition for page navigation: new pages fade in from `translateY(8px)` to `translateY(0)` over 180 ms. Use React Router's `useLocation` key to trigger a CSS animation class. Use `prefers-reduced-motion` to disable for accessibility.

**Complexity:** Medium — requires a `<PageTransition>` wrapper in the Outlet with key-based animation. Must not break the keyboard inset or scroll restoration.

**Impact:** Medium — makes navigation feel polished and intentional.

---

## 3. Diary Page (`/`)

The Diary page is the **most-used page in the app**. It deserves the highest investment. Currently it is 30 KB of dense JSX.

### 3.1 Hero quote should be hidden by default

**Current state:** An inspirational quote occupies screen real estate at the top of the page. It is configurable (`hideHeroQuote` profile flag) but defaults to visible.

**Recommendation:** Default `hideHeroQuote` to `true`. A musician opening the app to practice does not need a quote—they need their task list immediately. Move the quote to a small banner at the top only on days when the task list is empty, as a motivational nudge.

**Complexity:** Low — flip a default in `Profile.tsx` and `db.ts` migration.

**Impact:** High — the first task card visible without scrolling is a meaningful improvement.

---

### 3.2 Streak display — move to a persistent pill, not a section

**Current state:** The streak counter appears as a section in the Diary page (likely near the top). It occupies a full horizontal row.

**Recommendation:** Replace the streak row with a small pill badge (🔥 N days) in the top-right corner of the Diary page header, next to the date. Tapping the pill navigates to History. This frees vertical space for tasks.

**Complexity:** Low — JSX restructure in `Diary.tsx`; no data changes.

**Impact:** High — motivation is preserved but the task list appears higher.

---

### 3.3 Task cards — swipe-right to complete, swipe-left to skip

**Current state:** Task completion requires tapping a button on the card. Skipping likely requires tapping a "..." menu. Both are multi-tap flows.

**Recommendation:** Implement swipe gestures on task cards:
- Swipe right → Mark complete (green checkmark revealed behind card)
- Swipe left → Skip (yellow indicator behind card)
- After completion, collapse the card with a 200 ms height animation before logging a session
- Immediate haptic feedback on gesture commit threshold (~40 % of card width)

**Complexity:** High — requires a `<SwipeableRow>` component using touch events, threshold detection, spring animation, and integration with the task completion service calls. Must not conflict with page scrolling (vertical scroll should take priority if the initial touch is predominantly vertical).

**Impact:** Very high — the single most impactful UX change. Completing tasks is the core daily action.

---

### 3.4 Task cards — inline session log shortcut

**Current state:** To log a session, the user must tap the task card, find the session log button, and open `SessionLogSheet`. This is at least 2 taps.

**Recommendation:** Add a prominent "Log" button directly on each incomplete task card — a circular play/log icon (44 dp) that opens `SessionLogSheet` directly, pre-populated with the task. This is distinct from the card's main tap target (which should navigate to task detail or expand the card for more options).

**Complexity:** Low — add a button to the task card JSX and thread the `SessionLogSheet` open state.

**Impact:** High — reduces the most frequent interaction from 2-3 taps to 1 tap.

---

### 3.5 Carryover tasks — separate visual band, not mixed in

**Current state:** Carryover tasks from previous days appear in the same list as today's tasks, differentiated only by a label/icon. Users may not notice they are from a different day or may accidentally mark a days-old task complete for today.

**Recommendation:** Separate carryover tasks into a clearly labeled collapsible section *below* today's tasks, with a subtle orange/amber background tint on the cards and a label showing which date they are carried from. Provide a "Carry none" button to dismiss all carryovers at once.

**Complexity:** Medium — visual change only; the data separation already exists in the logic.

**Impact:** Medium — reduces confusion, especially for users with many recurring tasks.

---

### 3.6 Accordion sections — default open, not collapsed

**Current state:** Study routines and upcoming lessons are inside Accordion items that may be collapsed by default.

**Recommendation:** Default all Diary accordions to open. The user scrolls down to see them; collapsing requires an extra tap to see content the user almost always wants. Only save the collapsed state in `localStorage` if the user explicitly collapses a section (and restore it on next visit).

**Complexity:** Low — change `defaultValue` on the Accordion component.

**Impact:** Medium — reduces the "I forgot I had lessons today" scenario.

---

### 3.7 Practice Mode — make it a full-screen overlay

**Current state:** `PracticeMode.tsx` likely renders as an in-page section or sheet. It should be the most focused view in the app.

**Recommendation:** Make Practice Mode a full-screen modal (using a `Dialog` with `position: fixed; inset: 0`) with:
- Large task title (Cormorant Garamond, centered)
- A simple stopwatch/timer
- One big "Done — Log Session" button at the bottom
- One "Exit" button top-left
- Screen-wake-lock via `navigator.wakeLock.request('screen')` (Capacitor wrapper available)
- Phone auto-rotate lock

**Complexity:** Medium — restructure `PracticeMode.tsx` into a full-screen dialog; add `WakeLock` API call.

**Impact:** High — a musician practicing should not see the nav bar or other tasks; this is the most focused moment in the app.

---

### 3.8 Pending assignments badge — make it a non-blocking indicator

**Current state:** Pending assignments appear as a section on the Diary page, potentially pushing tasks further down.

**Recommendation:** Replace the assignments section on the Diary page with a banner/chip at the top of the page: "N assignments to review →" tapping which navigates to `/lessons/assignments`. This frees vertical space while preserving the notification.

**Complexity:** Low — remove the section, add a small chip. `pendingCount` is already computed.

**Impact:** Medium — keeps Diary focused on today's tasks.

---

### 3.9 Session FAB — collision with bottom nav

**Current state:** `SessionFAB.tsx` is a FAB at the bottom of the screen. The bottom nav is also at the bottom. On small screens these may overlap or the FAB may be hidden behind the nav.

**Recommendation:** Position the FAB at `bottom: calc(nav-height + safe-area-inset-bottom + 16px)`. Give it a unique `z-index` layer above the nav. When the nav is hidden (scroll down), the FAB should remain visible. Optionally, replace the FAB with the `+` button integrated into the nav bar's center slot (Material 3 style).

**Complexity:** Low — CSS positioning change + z-index coordination.

**Impact:** High — a hidden FAB means users cannot log sessions.

---

## 4. Library Page (`/library`)

### 4.1 Kind tabs — use a horizontal scroll tab row, not a 4-button grid

**Current state:** Library has 4 kind tabs (repertoire, manual, technique, theory). On a 360 dp screen, 4 tabs of equal width are ~86 dp each — workable but tight. Labels may truncate.

**Recommendation:** Use a `ScrollArea` horizontal tab bar with `overflow-x: auto; scroll-snap-type: x mandatory`. Each tab takes its natural text width plus padding. The active tab is underlined (not background-filled) to reduce visual noise. Add a subtle shadow on the right edge when there are off-screen tabs.

**Complexity:** Low — replace the tab bar JSX.

**Impact:** Low–Medium — prevents label truncation; cleaner look.

---

### 4.2 Search, filter, and sort controls — collapse into a single "Filter" row

**Current state:** The Library page likely shows a search input, a subject filter dropdown, a sort dropdown, and a "group by collection" toggle all stacked or placed horizontally. That is 4 controls taking up 2–3 rows of screen space.

**Recommendation:** Replace with:
- A full-width search input (always visible)
- A single "Filter" button with a badge showing the active filter count, which opens a bottom Sheet containing the subject filter, sort order, and group-by toggle

This pattern (search bar + filter button) is standard on Android (Google Play Store, Airbnb, etc.).

**Complexity:** Low–Medium — add a filter Sheet component; move 3 controls into it.

**Impact:** High — frees ~80–100 dp of vertical space for the item list.

---

### 4.3 Library item cards — use a compact list, not rich cards

**Current state:** Library items likely render as tall cards with composer, BPM sparkline, mastery sparkline, status badge, and an overflow menu. On a 360 dp screen this means only 2–3 items are visible at once.

**Recommendation:** Use a compact list row for the default view:
- Left: colored subject border (2 dp) + kind icon
- Center: item title (1 line, truncated) + composer/status in smaller text
- Right: BPM sparkline (40 × 20 dp) + overflow menu (···)
- Row height: 56 dp

Add an "expand" chevron that shows the full mastery sparkline and segment list inline. Only expand one row at a time (accordion behavior).

**Complexity:** Medium — refactoring `Library.tsx` card rendering; sparklines must shrink to the specified dimensions.

**Impact:** High — triples the visible items on screen; critical for libraries with 20+ pieces.

---

### 4.4 Item Analysis — merge into Library item detail sheet instead of separate page

**Current state:** Item analysis is a full page (`/library/item/:id/analysis`) requiring a page transition. This is used to inspect charts for a single item.

**Recommendation:** Convert `ItemAnalysisPage` to a full-height bottom Sheet (`ItemAnalysisSheet` already exists as a component) opened from the library item's overflow menu. Charts should lazy-load when the sheet opens. Deep links to `/library/item/:id/analysis` should still work by opening the Library page with the sheet pre-opened.

**Complexity:** Medium — the sheet component already exists; the change is removing the route and routing the navigation to a sheet open action. Deep link support requires passing the sheet open state via the route.

**Impact:** Medium — fewer page transitions; context is preserved (user can see the list behind the sheet).

---

### 4.5 "Add item" — floating action button instead of header button

**Current state:** The add button for a new library item is likely in the page header.

**Recommendation:** Use a FAB (bottom-center, above the nav) consistent with the Diary page pattern. The FAB is always visible regardless of scroll position, so the user never has to scroll back to the top to add an item.

**Complexity:** Low — JSX change.

**Impact:** Low–Medium — consistency; reduces scroll-up.

---

## 5. Collections Page (`/library/collections`)

### 5.1 Merge Collections into Library as a second view mode

**Current state:** Collections is a separate route (`/library/collections`) accessible from the Library page. It replicates the 4-kind tab structure. Navigating between Library and Collections requires 2 taps.

**Recommendation:** Merge Collections into the Library page as a **view toggle**: Library has two view modes, "Items" and "Collections", switched by a segmented control at the top. The 4-kind tabs persist across both views. This eliminates the separate Collections route.

**Complexity:** Medium — merge `Collections.tsx` JSX into `Library.tsx`, replace the route with state. The `NewCollectionSheet` and `AssignPiecesSheet` are already separate components and remain unchanged.

**Impact:** High — removes a navigation level; Collections and Library items are always one tap apart.

---

### 5.2 AssignPiecesSheet — multi-select checkboxes, not drag-reorder on mobile

**Current state:** `AssignPiecesSheet` supports drag-reorder of items. Drag-and-drop is notoriously difficult on mobile WebViews.

**Recommendation:** Replace drag-reorder with explicit up/down arrow buttons on each row (appearing when the item is selected) and a numeric position input. Keep drag-reorder only on desktop breakpoints (though the app is mobile-only, keep the code path for potential tablet use). For the mobile path, use long-press to enter reorder mode with arrow buttons.

**Complexity:** Medium — conditional rendering; arrow button logic to swap positions.

**Impact:** Medium — prevents drag-on-scroll conflicts.

---

## 6. Lessons Page (`/lessons`)

### 6.1 Lesson schedule and lesson history — use a single scrollable page with a date index

**Current state:** Lessons page shows recurring schedules and lesson history. The history likely has pagination (`Pager` component).

**Recommendation:** Replace pagination with **infinite scroll** (load 10 more items when user reaches the bottom of the list, using an `IntersectionObserver`). The date-based lesson history works naturally as a timeline. Add a sticky date divider ("May 2026", "April 2026") that appears as the user scrolls, similar to a messaging app.

**Complexity:** Medium — replace `Pager` with an intersection observer hook; add sticky date dividers. No data-layer changes.

**Impact:** Medium — natural mobile scrolling vs. tap-to-page.

---

### 6.2 RecurrenceSheet — split frequency and time fields into two steps

**Current state:** `RecurrenceSheet` contains all recurrence fields (teacher, subject, frequency, day of week, time, date range, color) in a single scrollable form.

**Recommendation:** Split into a 2-step bottom Sheet:
1. **Step 1:** Subject + teacher name + color
2. **Step 2:** Schedule (frequency, day(s), time)

Show a progress indicator (2 dots at top). "Next" advances; "Back" returns. This reduces initial overwhelm and groups semantically related fields.

**Complexity:** Low–Medium — add a step state variable; wrap existing fields in conditional renders.

**Impact:** Medium — reduces form abandonment.

---

### 6.3 LessonLogSheet — "Pieces played" multi-select is the wrong pattern

**Current state:** `LessonLogSheet` has a multi-select for pieces played (from the library). On mobile, a multi-select dropdown is cramped and requires many taps.

**Recommendation:** Replace the multi-select with a bottom Sheet search-and-chip UI:
- A search input filters library items
- Tapping an item adds it as a chip above the input
- Chips can be removed with ×
- The chip list wraps and is scrollable

**Complexity:** Medium — custom SearchableChipPicker component; can be reused in other places (e.g., `AssignPiecesSheet`).

**Impact:** High — logging a lesson with 5 pieces played should take ~10 seconds; the current flow may take 30+.

---

## 7. Assignments Page (`/lessons/assignments`)

### 7.1 Convert Assignments from a page to a Sheet

**Current state:** Assignments is a full page (`/lessons/assignments`). It shows a list of pending assignments with a "Create task from assignment" button per row.

**Recommendation:** Convert to a bottom Sheet opened from a Lessons page "Pending assignments" button (or the Diary page chip from §3.8). The Sheet shows the list of assignments; tapping one opens the `NewTaskPage` with prefill. This removes a navigation level.

**Complexity:** Low–Medium — convert `Assignments.tsx` to a Sheet component; update the router to redirect `/lessons/assignments` to the Lessons page with the Sheet open.

**Impact:** Medium — reduces page depth.

---

### 7.2 Each assignment row — swipe right to create task, swipe left to ignore

**Current state:** Each assignment has buttons for "create task" and "ignore". These are secondary actions that take up card space.

**Recommendation:** Apply the same swipe gesture pattern as task cards (§3.3):
- Swipe right → Create task (navigates to NewTaskPage with prefill)
- Swipe left → Ignore (with undo toast)

**Complexity:** High — reuse the `SwipeableRow` component built for §3.3.

**Impact:** Medium — faster assignment triage.

---

## 8. History Page (`/history`)

### 8.1 Filter controls — use a sticky filter pill row

**Current state:** History page has grouping, sorting, subject filter, and date range controls. These likely occupy the top of the page and push the list down.

**Recommendation:** Render a horizontally scrollable row of filter pills below the page title. Active filters are highlighted. Tapping a pill opens a small popover or a full filter Sheet. Tapping "×" on an active filter pill removes it. This pattern is used by Google Maps, Airbnb, and Google Calendar.

**Complexity:** Low–Medium — refactor the filter bar JSX.

**Impact:** High — frees content area; makes active filters visible at a glance.

---

### 8.2 Charts — make them horizontally scrollable

**Current state:** BPM trend charts and quality distribution charts are rendered at full width. On a 360 dp screen, a 30-session line chart compresses data points to ~10 dp spacing, making the chart unreadable.

**Recommendation:** Render charts with a minimum width of 600 dp inside a horizontal `ScrollArea`. The visible area is 360 dp (the screen), so the user can scroll horizontally to see older data. A "pinch to zoom" gesture should additionally expand the x-axis (via a zoom state variable that scales the chart's `domain`).

**Complexity:** High — requires a charting library that supports controlled viewport (Recharts or Victory Native). Pinch-to-zoom needs a custom gesture handler.

**Impact:** High — unreadable charts are useless; this is a core feature of History.

---

### 8.3 Session detail — convert `SessionDetailSheet` to a swipe-up sheet with a drag handle

**Current state:** `SessionDetailSheet` opens as a modal Sheet when a session is tapped.

**Recommendation:** Use the `MobileSheet` component (from §1.3) with snap points at 60 % (shows summary: date, quality, BPM, notes) and 95 % (shows full detail including layers, techniques, segment metrics). The user drags up to see more detail without a separate "expand" button.

**Complexity:** Low — configuration change on the Sheet component.

**Impact:** Medium — progressive disclosure; advanced data is accessible but not forced on the user.

---

### 8.4 Grouped session rows — infinite scroll instead of pagination

**Current state:** Session history uses `Pager` (prev/next buttons).

**Recommendation:** Same as §6.1 — replace with infinite scroll + sticky date dividers.

**Complexity:** Medium.

**Impact:** Medium.

---

## 9. Tasks Page (`/tasks`)

### 9.1 "Occurrences" vs "Series" tabs — rename and reorder

**Current state:** The Tasks page has two tabs: "occurrences" and "series". These are technical terms that a musician may not immediately understand.

**Recommendation:** Rename:
- "Occurrences" → "Today & Upcoming" (or simply "Tasks")
- "Series" → "Recurring"

Additionally, make "Today & Upcoming" the default view and show the date of each task prominently.

**Complexity:** Low — i18n key change + default tab state.

**Impact:** Low–Medium — reduces cognitive friction.

---

### 9.2 Task list — same compact card + swipe pattern as Diary

**Current state:** The Tasks page renders task cards. These should be consistent with the Diary task cards.

**Recommendation:** Share the same `<TaskCard>` component between `Diary.tsx` and `Tasks.tsx`. Both pages should use the same swipe-to-complete / swipe-to-skip pattern (§3.3). Currently they likely have different card implementations.

**Complexity:** Medium — extract shared `TaskCard` component; consolidate card rendering logic.

**Impact:** Medium — consistency; reduces code duplication.

---

### 9.3 Task calendar view — simplify to a month strip, not a full calendar

**Current state:** `TaskCalendarView.tsx` renders a full monthly calendar grid. On a 360 dp screen, each day cell is ~47 dp wide × ~35 dp tall — workable but very tight. The task dots inside cells are tiny.

**Recommendation:** Replace the full monthly grid with a **horizontal date strip** (7-day window centered on today) at the top of the Tasks page. Each day is a 44 × 60 dp pill showing the day number and a dot if there are tasks. Swiping the strip advances by 7 days. Tapping a day filters the task list below to that date. This is the pattern used by Google Calendar's "Schedule" view.

**Complexity:** Medium — new `DateStrip` component; connect date selection to task filter.

**Impact:** High — the current full-grid calendar is unusable at this screen size.

---

### 9.4 Bulk delete — replace with swipe-to-delete + undo toast

**Current state:** Tasks page has a bulk delete feature, which requires entering a selection mode and then confirming deletion.

**Recommendation:** Remove bulk delete. Replace with:
- Individual swipe-to-delete (left swipe past the skip threshold) with a 5-second undo toast
- A "Delete all completed" action in a ··· header menu for the power user

**Complexity:** Low–Medium — remove bulk delete UI; ensure swipe-to-delete service call uses `deleteWithUndo`.

**Impact:** Low — bulk delete is rarely needed and adds UI clutter.

---

## 10. NewTaskPage (`/tasks/new`) and EditTaskPage (`/tasks/edit/:id`)

### 10.1 Convert NewTaskPage from a full page to a multi-step bottom Sheet

**Current state:** Creating a task is a full page navigation. This means the user loses context (which day they were looking at, which library item they came from) during creation.

**Recommendation:** Convert to a multi-step Sheet:
1. **Step 1:** Task name / link type (free / item / collection) — most users need only this
2. **Step 2:** Date, subject, recurrence — shown only if the user taps "More options"
3. **Step 3:** BPM, layers, techniques, notes — shown only if the user taps "Advanced"

The wizard (TaskWizard) and study routine wizard (StudyRoutineWizard) remain as separate full-page flows accessed via a "Use wizard" button on Step 1.

Keep the routes `/tasks/new` and `/tasks/edit/:id` as they are (they can open the Sheet overlay on top of whichever page the user was on).

**Complexity:** High — significant refactor of `NewTaskPage.tsx` and `EditTaskPage.tsx`. The form validation and submission logic can remain; only the container and step logic changes. The `LinkTargetFields` and `RecurrenceFields` subcomponents fit naturally into steps.

**Impact:** Very high — task creation is a daily action; reducing it from a full-page context switch to a 1-step sheet dramatically improves flow.

---

### 10.2 Link type selector — use large tappable cards, not a dropdown

**Current state:** The link type (free / item / collection) is likely a `Select` dropdown.

**Recommendation:** Replace with three large tappable cards (full width, ~72 dp tall each):
- **Free-form** — icon + "No specific piece"
- **Piece / Segment** — icon + "From my library"
- **Collection** — icon + "From a collection"

Selected card gets a primary-colored border. This is the pattern used by iOS Shortcuts for action type selection.

**Complexity:** Low — replace Select with custom card radio group.

**Impact:** Medium — faster selection; clearer affordance.

---

### 10.3 Recurrence builder — day-of-week picker must use pill buttons

**Current state:** `RecurrenceFields.tsx` likely uses checkboxes or a dropdown for day-of-week selection.

**Recommendation:** Use a row of 7 circular day pills (M T W T F S S), each 40 × 40 dp, styled like Calendar app day selectors. Multiple pills can be active simultaneously for multi-day recurrence. This is faster to tap than checkboxes and visually communicates the weekly pattern.

**Complexity:** Low — replace existing control with a custom `DayPicker` component.

**Impact:** Medium — day-of-week selection is a frequent action.

---

## 11. SessionLogSheet

### 11.1 Quality selector — 4 large buttons, not a dropdown or segmented control

**Current state:** `SessionFields.tsx` renders a quality selector (hard / improve / well / great). On mobile a segmented control at full width with 4 options is ~86 dp per option — tight.

**Recommendation:** Render the 4 quality options as a 2 × 2 grid of large buttons (full width minus gap, ~160 dp each × ~56 dp tall), each with an emoji/icon and label:
- 😤 Hard
- 📈 Improve
- ✅ Well
- 🌟 Great

The selected state gets a solid background. This is one of the most frequent interactions; it must be large and fast.

**Complexity:** Low — replace Select/segmented control with a 2×2 button grid.

**Impact:** Very high — quality rating is the most important field in the session log.

---

### 11.2 BPM input — numeric keyboard with +/- steppers

**Current state:** BPM is an `<Input type="number">`. On Android, number inputs render the full numpad keyboard, which covers ~50 % of the screen. The user must type the BPM, then dismiss the keyboard.

**Recommendation:** Use a custom BPM input with:
- Large display label showing current BPM (Cormorant Garamond, 48 px)
- `-5` and `-1` buttons on the left, `+1` and `+5` buttons on the right
- A small text input below for direct keyboard entry (less prominent)
- Pre-populated from `BpmSuggestion` value

The stepper buttons allow rapid BPM adjustment without the keyboard opening. The keyboard input is still available for precise entry.

**Complexity:** Medium — custom `BpmStepper` component; replaces the existing `BpmCoupler` pattern.

**Impact:** High — BPM entry is frequent; this eliminates the keyboard-cover problem.

---

### 11.3 Session log form height — reduce required fields

**Current state:** The session log sheet likely shows: BPM, note value, reps, confidence (stars), quality, notes, layers used, techniques used, and optionally per-segment metrics (granular mode). This is 7+ fields.

**Recommendation:** Show only the 3 most important fields by default:
1. Quality (2×2 grid, §11.1)
2. BPM (stepper, §11.2)
3. Notes (1-line textarea)

All other fields (reps, note value, confidence, layers, techniques) are in an "Advanced" expandable section, collapsed by default. The granular segment mode is behind a separate toggle (already exists, keep it).

**Complexity:** Low — wrap existing fields in a `<details>` or `<Collapsible>` with a "More fields" trigger.

**Impact:** Very high — a quick session log should take 5 seconds; the current form can take 30+.

---

### 11.4 Granular segment mode — slide-up carousel, not a stacked form

**Current state:** When granular mode is enabled and the task has multiple segments, `SessionLogSheet` likely stacks multiple sets of quality/BPM/reps fields vertically. On a 360 dp screen with 4 segments, this creates a very long scrolling form.

**Recommendation:** Replace with a **horizontal segment carousel**:
- One segment is visible at a time
- The segment name is shown as a title
- Quality + BPM fields fill the card
- "Next segment →" button advances to the next segment
- A progress indicator (dots: ●●○○) shows position
- "Done" on the last segment submits the whole session

**Complexity:** High — requires a carousel/step state managing per-segment data, replacing the current flat `segMetrics` state.

**Impact:** High — granular multi-segment logging is currently unusable on mobile for pieces with 3+ movements.

---

## 12. NewLibraryItemSheet

### 12.1 Split the form into kind-specific steps

**Current state:** `NewLibraryItemSheet` renders different fields based on the selected kind, all in one scrolling sheet. For a repertoire item this includes: title, composer, subject, BPM range, note value, techniques, status, and the segments editor. This is 8+ fields.

**Recommendation:** Use a 3-step sheet:
1. **Step 1:** Kind selector (4 large cards: Repertoire, Manual, Technique, Theory) + title + subject
2. **Step 2:** Kind-specific fields (BPM/composer for repertoire; mastery sliders for theory; etc.)
3. **Step 3 (optional):** Segments editor — only shown for repertoire/manual, only if the user taps "Add movements/sections"

**Complexity:** Medium — add step state; reorganize the existing field components into steps. The kind-specific field components (`LibraryItemKindFields`, `MasterySliders`, `BpmCoupler`) already exist.

**Impact:** High — adding a new piece should feel quick; the current flow can be overwhelming.

---

### 12.2 SegmentsEditor — accordion, not a table

**Current state:** `SegmentsEditor.tsx` renders segments as a list with per-row fields for label, targetBpm, noteVal, and techniques. This is a table-like layout that does not fit in ~360 dp.

**Recommendation:** Each segment is a collapsed accordion row showing only its label. Expanding the row reveals the BPM, note value, and technique chips for that segment. A "+" button at the bottom adds a new segment. A left swipe on a row reveals a delete button.

**Complexity:** Low–Medium — replace flat list with Accordion from shadcn/ui.

**Impact:** Medium — the current layout likely overflows horizontally on narrow screens.

---

## 13. Profile Page (`/profile`)

### 13.1 Move Profile out of the bottom nav (covered in §2.2)

Already described. Profile is a low-frequency page and should not occupy a prime nav slot.

---

### 13.2 SubjectsEditor — convert from inline section to full-screen sheet

**Current state:** `SubjectsEditor.tsx` is a component used inside the Profile page to manage subjects. It is likely an inline card with a list of subjects and an add button.

**Recommendation:** Open the subjects editor in a full-height bottom sheet (or a modal page) accessed via an "Edit" button next to the "Subjects" section header. This gives the subject list and the add/edit forms more vertical space.

**Complexity:** Low — wrap existing component in a Sheet.

**Impact:** Low–Medium — profiles with 4+ subjects currently have a cramped inline editor.

---

### 13.3 Backup / restore — add a "Quick export" shortcut to the Android share sheet

**Current state:** Backup and restore are inside the Profile page. Export produces a JSON file that must be saved or shared.

**Recommendation:** After export, immediately trigger the Android native share sheet (`Capacitor Share plugin`) so the user can share the JSON to Google Drive, email, WhatsApp, etc. with one tap. The current "save to file" flow requires navigating the Android file picker.

**Complexity:** Low — install `@capacitor/share`, call `Share.share({ files: [fileUri], ... })` after export.

**Impact:** Medium — backup is useless if it is hard to complete; sharing to Drive makes it a one-tap action.

---

### 13.4 Reminder settings — replace time input with a time picker wheel

**Current state:** The reminder time is likely an `<Input type="time">`. Android's native time picker (the wheel/clock dialog) is more touch-friendly.

**Recommendation:** On Capacitor/Android, use `LocalNotifications` plugin for the actual reminders (replacing any web Notification API usage). Use a time picker Sheet with an iOS-style wheel (can be built with `react-mobile-picker` or a custom CSS 3D transform scroll). Keep `type="time"` as a fallback.

**Complexity:** Medium — conditional rendering of native vs web time picker; Capacitor LocalNotifications integration.

**Impact:** Medium — reminder setup is done once; mobile-native time picker is significantly more comfortable.

---

## 14. Study Routine Wizard (`StudyRoutineWizard.tsx` / `EditStudyRoutinePage.tsx`)

### 14.1 Matrix editor is not usable on mobile

**Current state:** The study routine wizard includes a matrix editor (groups × days of week × item count). A matrix with 4 groups and 7 days is a 4×7 grid, which at ~360 dp would give each cell ~36 dp. This is below the 44 dp touch target minimum.

**Recommendation:** Replace the grid matrix with a **per-day configuration flow**:
- A horizontal day strip (M T W T F S S)
- Selecting a day shows a list of groups, each with a stepper for item count
- The user configures each day independently
- A "Copy from Mon" shortcut bulk-applies one day's config to all or selected days

This is functionally equivalent to the matrix but works in a linear vertical layout.

**Complexity:** High — complete redesign of the matrix editor section of `StudyRoutineWizard`. The data model (`matrix: Record<dayOfWeek, Record<groupId, itemCount>>`) remains unchanged; only the editing UI changes.

**Impact:** High — the study routine feature is inaccessible on mobile in its current form.

---

### 14.2 EditStudyRoutinePage — convert to a sheet

**Current state:** Editing a study routine is a full page. This is a configuration action, not a content-browsing action.

**Recommendation:** Convert to a full-height Sheet opened from the Diary page's study routine section or the Tasks page. The page route (`/tasks/routines/edit/:id`) remains for deep links but renders the Sheet overlay on the Tasks page.

**Complexity:** Low–Medium — same pattern as other page-to-sheet conversions.

**Impact:** Low–Medium — fewer navigation levels.

---

## 15. Onboarding (`Onboarding.tsx` / `IntroSlides.tsx`)

### 15.1 IntroSlides — skip is always visible and large

**Current state:** Tutorial slides exist but the skip button location and size are unknown.

**Recommendation:** Always show a large "Skip" button (bottom-right, 44 dp min) from slide 1. The first time a user sees the app they may want to skip directly to setup. Also add a "tap anywhere to advance" affordance.

**Complexity:** Low.

**Impact:** Medium — reduces onboarding friction.

---

### 15.2 Onboarding — subject creation should use preset icons, not text-only

**Current state:** Subjects are created during onboarding by typing a name and selecting a type. The type selector likely uses a dropdown or radio buttons.

**Recommendation:** Show preset subject templates as large tappable cards with instrument icons (Piano 🎹, Guitar 🎸, Violin 🎻, Voice 🎤, Theory 📖, Composition ✍️, Custom). The user selects one or more; custom allows typing a name. This is faster and more visual than a blank text field.

**Complexity:** Low–Medium — add preset data; replace text form with card grid.

**Impact:** High — first-run experience directly determines whether the user continues using the app.

---

## 16. Structural Changes Summary

### 16.1 Pages to convert to Sheets / Modals

| Current Page | Proposed Surface | Rationale |
|---|---|---|
| `ItemAnalysisPage` | Full-height Sheet (from Library) | Chart detail is contextual, not a destination |
| `Assignments` (`/lessons/assignments`) | Sheet (from Lessons or Diary) | A list of pending items, not a navigation destination |
| `EditStudyRoutinePage` | Full-height Sheet (from Tasks or Diary) | Configuration action, not content browsing |

### 16.2 New surfaces (pages/modals) to add

| Surface | Type | Purpose |
|---|---|---|
| **Quick Log Sheet** | Persistent bottom Sheet | Log a free-form session (without a task) directly from the Diary FAB; a single quality + optional BPM + note; for when the user practiced something not on their task list |
| **Streak/Stats Overlay** | Full-screen Sheet | Tapping the streak pill opens a rich stats overview: longest streak, total hours estimated, quality distribution all-time, best BPM records — a "trophy room" for motivation |
| **Practice Timer Screen** | Full-screen overlay | Already proposed in §3.7 — a proper screen-wake-lock practice mode |
| **Search page** (`/search`) | Full page | Global search across library, tasks, lessons, and sessions. Accessible via a magnifying glass icon in the Diary page header. Critical for users with large libraries. |
| **Day Review Sheet** | Bottom Sheet | Shown at end-of-day (triggered by a notification or a Diary FAB state change): "You practiced 3 tasks today. Log a session for Brahms Intermezzo?" — a checklist of today's incomplete tasks with quick log buttons. Replaces or extends Practice Mode. |

### 16.3 Pages to merge

| Pages | Merged Into | Rationale |
|---|---|---|
| `Library` + `Collections` | `Library` (with view toggle) | Both are item catalog views; separating them doubles navigation depth (§5.1) |
| `History` (accessible from nav) | Accessible from Diary header + Tasks header | History is analytical; it follows naturally from task/session context (§2.3) |

---

## 17. Priority Matrix

| # | Recommendation | Priority | Complexity | Impact |
|---|---|---|---|---|
| 3.3 | Swipe-to-complete tasks on Diary | P1 | High | Very High |
| 11.1 | Quality selector as 2×2 button grid | P1 | Low | Very High |
| 11.3 | Session log: show only 3 fields by default | P1 | Low | Very High |
| 10.1 | NewTaskPage as multi-step Sheet | P1 | High | Very High |
| 3.4 | Inline "Log" button on task cards | P1 | Low | High |
| 3.7 | Practice Mode as full-screen overlay | P1 | Medium | High |
| 1.8 | Dark mode completeness | P1 | Medium | High |
| 14.1 | Study routine matrix → per-day flow | P1 | High | High |
| 2.2 | Add Tasks to bottom nav; remove Profile | P2 | Low | High |
| 3.1 | Hero quote hidden by default | P2 | Low | High |
| 3.2 | Streak as header pill | P2 | Low | High |
| 4.2 | Library filter collapsed into single row | P2 | Medium | High |
| 4.3 | Library compact list rows | P2 | Medium | High |
| 8.2 | Charts horizontally scrollable | P2 | High | High |
| 9.3 | Calendar → 7-day date strip | P2 | Medium | High |
| 11.2 | BPM stepper input | P2 | Medium | High |
| 11.4 | Granular segment carousel | P2 | High | High |
| 12.1 | NewLibraryItemSheet multi-step | P2 | Medium | High |
| 1.2 | Touch target audit (min 48 dp) | P2 | Medium | High |
| 1.3 | Swipe-to-dismiss sheets with pill handle | P2 | Medium | High |
| 5.1 | Merge Collections into Library | P3 | Medium | High |
| 3.9 | FAB position above nav bar | P3 | Low | High |
| 6.3 | Lesson pieces: chip picker | P3 | Medium | High |
| 15.2 | Onboarding preset instrument cards | P3 | Medium | High |
| 4.4 | ItemAnalysis as Sheet | P3 | Medium | Medium |
| 3.5 | Carryover tasks separate visual band | P3 | Low | Medium |
| 6.1 | Lessons infinite scroll | P3 | Medium | Medium |
| 6.2 | RecurrenceSheet 2-step form | P3 | Low | Medium |
| 7.1 | Assignments as Sheet | P3 | Medium | Medium |
| 8.1 | History filter pill row | P3 | Medium | Medium |
| 1.7 | Haptic feedback | P3 | Low | High |
| 13.3 | Backup → native share sheet | P3 | Low | Medium |
| 10.2 | Link type as tappable cards | P3 | Low | Medium |
| 10.3 | Day-of-week pill buttons | P3 | Low | Medium |
| 12.2 | SegmentsEditor as accordion | P3 | Low | Medium |
| 16.2 | New: Global Search page | P3 | High | High |
| 16.2 | New: Quick Log Sheet | P3 | Medium | Medium |
| 2.5 | Page transitions | P4 | Medium | Medium |
| 1.1 | Minimum font size 13 px | P4 | Low | High |
| 3.6 | Accordions default open | P4 | Low | Medium |
| 3.8 | Pending assignments → chip | P4 | Low | Medium |
| 4.1 | Kind tabs as scroll row | P4 | Low | Low |
| 4.5 | Library add → FAB | P4 | Low | Medium |
| 8.3 | SessionDetailSheet snap points | P4 | Low | Medium |
| 9.1 | Rename tabs (Occurrences → Tasks) | P4 | Low | Low |
| 9.2 | Share TaskCard between Diary & Tasks | P4 | Medium | Medium |
| 9.4 | Remove bulk delete | P4 | Low | Low |
| 13.2 | SubjectsEditor in Sheet | P4 | Low | Low |
| 13.4 | Time picker wheel | P4 | Medium | Low |
| 14.2 | EditStudyRoutinePage → Sheet | P4 | Low | Low |
| 15.1 | IntroSlides skip always visible | P4 | Low | Low |
| 1.4 | EmptyState full-width CTA | P4 | Low | Medium |
| 1.5 | Toast position above nav | P4 | Low | Medium |
| 1.6 | Pull-to-refresh | P4 | Medium | Low |
| 2.1 | Nav: active-only labels | P4 | Low | Medium |
| 2.4 | Nav animation jitter | P4 | Low | Low |
| 7.2 | Assignments swipe gestures | P4 | High | Medium |
| 8.4 | History infinite scroll | P4 | Medium | Medium |

---

## 18. Implementation Order Recommendation

Given the mobile-first focus and the goal of maximizing daily-use quality first:

**Phase 1 — Core daily flow (1–2 weeks):**
- §11.1 Quality selector as 2×2 grid
- §11.3 Session log show 3 fields by default
- §3.4 Inline "Log" button on task cards
- §3.1 Hide hero quote by default
- §3.2 Streak as header pill
- §1.8 Dark mode audit
- §1.5 Toast above nav
- §3.9 FAB position fix

**Phase 2 — Navigation and structure (1–2 weeks):**
- §2.2 Tasks in bottom nav, Profile out
- §3.3 Swipe-to-complete tasks (build `SwipeableRow`)
- §1.3 Sheet pill handle + snap points
- §1.2 Touch target pass
- §10.2 Link type cards
- §10.3 Day-of-week pills
- §3.5 Carryover tasks separate band

**Phase 3 — Forms and editors (2–3 weeks):**
- §10.1 NewTaskPage as multi-step Sheet
- §11.2 BPM stepper
- §11.4 Granular segment carousel
- §12.1 NewLibraryItemSheet multi-step
- §12.2 SegmentsEditor accordion
- §6.3 Lesson pieces chip picker
- §6.2 RecurrenceSheet 2-step

**Phase 4 — Browse and analysis (1–2 weeks):**
- §4.2 Library filter row collapse
- §4.3 Library compact list
- §5.1 Merge Collections into Library
- §9.3 Date strip instead of calendar grid
- §8.2 Horizontally scrollable charts
- §8.1 History filter pill row
- §4.4 ItemAnalysis as Sheet

**Phase 5 — Polish and new features (ongoing):**
- §1.7 Haptic feedback
- §3.7 Practice Mode full-screen
- §14.1 Study routine matrix redesign
- §13.3 Native share for backup
- §16.2 Global Search page
- §2.5 Page transitions
- §15.2 Onboarding presets
