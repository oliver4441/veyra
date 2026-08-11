---
name: Veyra Cinematic
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b7b4b7'
  tertiary: '#ffb4aa'
  on-tertiary: '#690003'
  tertiary-container: '#ff5447'
  on-tertiary-container: '#5c0002'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#e5e1e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#930007'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 80px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  section-gap: 80px
  content-gap: 24px
  grid-margin-desktop: 64px
  grid-margin-mobile: 20px
  gutter: 24px
---

## Brand & Style

The design system is a premium, immersive framework tailored for a high-end cinematic streaming experience. It targets a modern audience that values high-fidelity content and seamless navigation. 

The aesthetic is **Cinematic Glassmorphism**, blending deep charcoal surfaces with translucent, blurred layers to create a sense of infinite depth. By prioritizing high-contrast typography and vibrant violet accents against a near-black foundation, the system ensures that film artwork and video content remain the focal point. The emotional response is one of exclusivity, sophistication, and technological edge.

## Colors

The palette is anchored in **#0A0A0B (Near-Black)** to replicate the experience of a darkened theater. 

- **Primary (Veyra Violet):** Used for key calls-to-action, active states, and brand highlights. 
- **Surface (Elevated Dark):** **#141416** is used for cards and navigation bars to provide subtle separation from the background.
- **Accent (Cinematic Red):** Reserved strictly for critical alerts or "Live" indicators to maintain a curated look.
- **Gradients:** Utilize the `cinematic-fade` on all hero images to ensure typography remains legible over diverse visual backgrounds.

## Typography

This design system utilizes **Plus Jakarta Sans** for its modern, geometric clarity and friendly yet professional apertures. 

Headlines use high-contrast weights (Bold/Extra Bold) and tight letter-spacing to evoke a theatrical poster feel. Body text maintains generous line-height for readability during long browsing sessions. `label-caps` should be used for metadata like "4K ULTRA HD" or "GENRE" to create a structured, technical hierarchy.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a heavy emphasis on negative space. 

- **Desktop:** 12-column grid with 64px side margins. Large hero sections should bleed edge-to-edge behind the navigation.
- **Mobile:** 4-column grid with 20px margins. 
- **Rhythm:** Use an 8px base unit. Section headers should be separated from their content by 24px, while distinct content rows (e.g., "Trending Now" vs "Recommended") require an 80px vertical gap to maintain a premium feel.

## Elevation & Depth

Depth is communicated through **Z-axis Layering** and **Glassmorphism**:

1.  **Base (Level 0):** #0A0A0B.
2.  **Surface (Level 1):** #141416 with a 1px subtle border (#ffffff10).
3.  **Glass (Level 2):** Navbars and Floating Modals use a background of `rgba(20, 20, 22, 0.7)` with a 20px Backdrop Blur.
4.  **Shadows:** Use large, ultra-soft shadows for floating elements (`0px 24px 48px rgba(0,0,0,0.5)`). Use a faint violet inner-glow on primary buttons to suggest they are light sources.

## Shapes

The design system adopts a **Rounded** shape language to soften the dark, technical interface and make it feel more approachable. 

- **Standard Elements:** 0.5rem (8px) for buttons and small inputs.
- **Media Cards:** 1rem (16px) for movie posters and thumbnails to create a containerized, object-like feel.
- **Pills:** Full rounding (999px) for search bars and category chips.

## Components

- **Dark Elevated Cards:** Use #141416. On hover, cards should scale by 1.05x and gain a `violet-glow` border-bottom (2px) to indicate focus.
- **Minimal Glass Buttons:** Transparent background with a 1px white (20% opacity) border and 20px backdrop blur. Text remains white.
- **Primary Buttons:** Solid `violet-glow` gradient with white text, bold weight.
- **Input Fields:** Bottom-border only or fully enclosed dark-grey (#1c1c1e) with 8px radius. Active state triggers a violet glow.
- **Media Chips:** Small, pill-shaped tags for "HD," "PG-13," or "Action." Use a semi-transparent white fill (10% opacity) with white text.
- **Navigation:** Top-fixed, becomes 70% transparent with backdrop blur upon scrolling. Links use `label-caps` for a clean, architectural look.