---
name: Virtuoso
description: Local-first practice journal for musicians — the Practice Taccuino.
colors:
  terracotta-ink: "hsl(16 48% 36%)"
  paper-on-ink: "hsl(40 50% 96%)"
  warm-paper: "hsl(40 30% 96%)"
  warm-ink: "hsl(25 25% 18%)"
  card-paper: "hsl(38 28% 94%)"
  popover-paper: "hsl(38 28% 97%)"
  secondary-paper: "hsl(36 20% 89%)"
  muted-paper: "hsl(38 18% 90%)"
  muted-ink: "hsl(28 18% 33%)"
  accent-paper: "hsl(36 24% 87%)"
  rule-line: "hsl(32 20% 81%)"
  input-line: "hsl(32 25% 78%)"
  destructive-red: "hsl(0 60% 45%)"
  success-sage: "hsl(146 28% 30%)"
  success-subtle: "hsl(130 20% 90%)"
  warning-umber: "hsl(34 70% 30%)"
  warning-subtle: "hsl(40 65% 88%)"
  info-slate-blue: "hsl(207 35% 34%)"
  info-subtle: "hsl(205 30% 91%)"
  key-terracotta: "hsl(16 62% 38%)"
  key-sage: "hsl(146 28% 30%)"
  key-gold: "hsl(38 62% 32%)"
  key-blue: "hsl(207 35% 34%)"
  key-plum: "hsl(320 25% 42%)"
  key-coral: "hsl(8 70% 58%)"
  key-amber: "hsl(28 75% 50%)"
  key-teal: "hsl(178 45% 38%)"
  key-indigo: "hsl(235 40% 50%)"
  key-slate: "hsl(215 20% 45%)"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  control:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  numeric:
    fontFamily: "Manrope, Inter, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1, \"ss01\" 1"
rounded:
  sm: "6px"
  button: "7px"
  paper: "10px"
  lg: "14px"
  full: "9999px"
spacing:
  gutter-phone: "20px"
  gutter-tablet: "28px"
  gutter-desktop: "36px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta-ink}"
    textColor: "{colors.paper-on-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    height: "42px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.button}"
    height: "42px"
  button-ghost:
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.button}"
  input:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.sm}"
    height: "42px"
    padding: "10px 12px"
  paper-card:
    backgroundColor: "{colors.card-paper}"
    rounded: "{rounded.paper}"
  paper-raised:
    backgroundColor: "{colors.card-paper}"
    rounded: "{rounded.lg}"
  nav-item-active:
    textColor: "{colors.terracotta-ink}"
    rounded: "{rounded.lg}"
    height: "46px"
---

# Design System: Virtuoso

## Overview

**Creative North Star: "The Practice Taccuino"**

A warm paper notebook that lives on the music stand. Warm ink on quiet paper, a single terracotta voice for action, and a handful of colored tabs (the key colors) that mark recurring lessons and subjects. The serif is the handwriting on the cover and the section titles; everything the musician operates is set in a plain, legible sans, and every number that matters during practice (tempo, counts, durations) is set in tabular Manrope so it can be read at arm's length.

The app is an Operate surface: density is moderate, lists and sections stay open on the page instead of being boxed, and boxes appear only where something is selectable or tactile. Ambition shows as precision: aligned numerals, consistent 42px controls, calm transitions that respect reduced motion.

**Key Characteristics:**
- Warm paper and ink, never pure white or pure black on screen.
- One action color (terracotta); state colors (sage, umber, slate blue) never double as actions.
- Serif for headings only; sans for every control; Manrope tabular numerals for every measured value.
- Open lists separated by rules; outlined paper cards only for selectable tiles and nested fields.
- Phone first: bottom navigation with a floating Today button, a floating action bar for save/cancel.

## Colors

Warm, low-chroma paper neutrals with one earthy action color and muted state hues; all tokens are HSL custom properties in `src/index.css`.

### Primary
- **Terracotta Ink** (`--primary`): buttons, active navigation, links, focus outlines, the text caret, the floating Today button. Tuned for AA contrast on paper and on the tinted active-nav background (`primary/10`).

### Neutral
- **Warm Paper** (`--background`): page background, sidebar.
- **Warm Ink** (`--foreground`): body text and headings.
- **Card Paper** (`--card`): cards, inputs, bottom navigation, floating bars.
- **Popover Paper** (`--popover`): menus and popovers, a touch lighter than cards.
- **Secondary / Muted / Accent Paper**: hover fills (`secondary/40`), skeletons, selection highlight.
- **Muted Ink** (`--muted-foreground`): secondary text, inactive nav, hints.
- **Rule Line / Input Line** (`--border`, `--input`): dividers, outlines, field strokes.

### State
- **Success Sage**, **Warning Umber**, **Info Slate Blue**, each with a `-subtle` fill: practice state (done, due, informational). **Destructive Red** for delete and errors.

### Key colors
- **Terracotta, Sage, Gold, Blue, Plum, Coral, Amber, Teal, Indigo, Slate** (`--key-*`): user-assigned color tabs for subjects and lesson recurrences. Data colors, not decoration.

### Named Rules
**The One Voice Rule.** Terracotta is the only action color. Success, warning and info hues mark state and never style a button.

**The Tab, Not Paint Rule.** Key colors mark an entity the user colored (a dot, a strip, a chip edge). They never fill large surfaces.

## Typography

**Display Font:** Cormorant Garamond (with Georgia, serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Numeric Font:** Manrope with tabular figures (`.font-numeric`, `.tabular-nums`)

**Character:** A literary serif for titles against a neutral, workmanlike sans; the pairing reads as a notebook with printed headings and practical entries. Fonts are self-hosted for offline use.

### Hierarchy
- **Display** (600, 2.25rem, 2rem on phone, 1.15): page titles via `PageHeader`.
- **Headline** (400, 1.5rem): section titles via `SectionHeader`.
- **Title** (600, 1.25rem, snug): empty-state titles, card titles.
- **Body** (400, 0.875rem): running text, hints; long hints capped at 60ch.
- **Control** (500, 0.8125rem): buttons, nav items, desktop inputs. Inputs use 1rem on phone so mobile browsers do not zoom.
- **Label** (600, 0.75rem, uppercase, wider tracking): small group labels.
- **Numeric** (Manrope 600, tabular): BPM, counts, durations, badges.

### Named Rules
**The Serif Is For Titles Rule.** `h1`–`h3` get the serif automatically; controls, labels and numbers never do.

**The Measured Numbers Rule.** Any value a musician compares over time (tempo, minutes, counts) uses tabular numerals so columns and readouts do not jitter.

## Layout

Mobile-first single column. Page gutters are 20px on phone, 28px from 700px, 36px from 1151px. From 700px a fixed left sidebar (195px, 208px from 1151px, 250px from 1600px) replaces the bottom navigation. Ported pages use a 1200px max content width; others stay in a 3xl column. Page headers sit 24px above content; section headers 12px above their list.

The phone bottom navigation is 72px tall plus the safe-area inset and hides on scroll down or when the soft keyboard opens; `--floating-bottom` and the keyboard inset keep floating bars above it. Main content reserves 7rem of bottom padding on phone so the last row clears the navigation.

## Elevation & Depth

Mostly flat, depth by tonal layering (paper, card paper, popover paper) and 1px rules. Shadows are warm (ink-tinted) and quiet, used only for tactile or floating surfaces.

### Shadow Vocabulary
- **Soft** (`--shadow-soft`: `0 2px 6px hsl(25 25% 18% / 0.05)`): `paper-raised` surfaces (forms, next lesson, metronome).
- **Card** (`--shadow-card`: `0 2px 8px hsl(25 25% 18% / 0.06)`): rare card lift.
- **Raised** (`--shadow-raised`: `0 6px 20px -4px hsl(25 25% 18% / 0.12)`): floating action bar, floating Today button.

### Named Rules
**The Open Page Rule.** Ordinary lists and sections stay open on the page, separated by rules. Outlines (`paper-card`) are for selectable tiles and nested fields; shadows (`paper-raised`) for tactile surfaces only.

## Shapes

Gently rounded, never pill-shaped except badges, avatars and the floating Today button. Fields 6px (`rounded-sm`), buttons 7px, paper cards 10px (`rounded-paper`), raised surfaces and floating bars 14px (`rounded-lg`, the `--radius` token).

## Components

### Buttons
- **Shape:** gently rounded (7px).
- **Primary:** terracotta fill, paper text, 42px tall, 13px medium label; hover darkens by brightness.
- **Outline:** card-paper fill with rule-line border; **Ghost:** muted ink, fills on hover; **Small:** 34px.
- **Focus:** 2px ring in terracotta with offset; global `:focus-visible` outline is 3px terracotta.

### Inputs / Fields
- **Style:** card-paper fill, input-line stroke, 6px radius, 42px tall, terracotta caret.
- **Focus:** 3px terracotta ring with offset. **Disabled:** 50% opacity.

### Cards / Containers
- **paper-card:** card paper, 1px rule border, 10px radius. Selectable tiles and nested fields.
- **paper-raised:** card paper, soft shadow, 14px radius. Forms, next lesson panel, metronome.

### Navigation
- **Sidebar (≥700px):** serif wordmark, 46px nav rows, inactive muted ink, active terracotta text on `primary/10`; pending homework count as a terracotta badge.
- **Bottom nav (<700px):** Plan, Lessons, floating Today (56px terracotta circle), Library, More. More opens a popover with Progress, Study setup, Weekly summary, Settings (44px rows). Pending homework shows as a terracotta dot on the Lessons icon, with the count in its accessible name. Today stays active while logging (`/log`). The nav is `inert` while hidden on scroll or keyboard.

### Chips
- **Removable chip:** secondary button, at least 44px tall, label then a small X; the whole chip removes it. Used by the filter toolbar and the multi-select picker.

### Floating action bar
Save/cancel bar fixed above the bottom navigation, the system bar or the keyboard, 14px radius, raised shadow. App-wide pattern for forms.

### Metronome (practice mode)
Beats are scheduled on the audio clock; the pendulum swings to the other side on each scheduled beat and hides under reduced motion, while the beat dots flash by opacity on every beat. Two columns from 900px wide and on short landscape screens (readout left, tempo controls right); the finish bar joins the page flow on short landscape. Readout in Manrope tabular at 5rem.

### Empty states
Open band between two rules, optional serif quote, muted icon, serif title, 60ch hint, primary CTA plus ghost secondary.

## Do's and Don'ts

### Do:
- **Do** use the HSL tokens (`bg-card`, `text-muted-foreground`, `border-border`) and radius tokens (`rounded-sm`, `rounded-paper`, `rounded-lg`), never literals that duplicate them.
- **Do** set tempo, counts and durations in `font-numeric` / `tabular-nums`.
- **Do** keep phone touch targets at least 44px and respect `prefers-reduced-motion`.
- **Do** place form save/cancel in `FloatingActions`.

### Don't:
- **Don't** use success, warning or info hues for buttons or links.
- **Don't** box ordinary lists in cards; use rules.
- **Don't** set controls or numbers in the serif.
- **Don't** use pure white or pure black on screen (print styles excepted).
