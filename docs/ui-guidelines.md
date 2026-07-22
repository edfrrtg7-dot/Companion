# UI Guidelines

## Overview

All Companion UI follows consistent visual and behavioral standards. Every module must adhere to these guidelines to maintain a unified user experience.

## Spacing

| Element | Value |
|---------|-------|
| Widget padding | 12px |
| Content padding | 8px 12px |
| Button padding | 6px 10px |
| Gap between elements | 4px-8px |
| Section divider height | 1px |
| Menu item padding | 8px 12px |

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Widget title | System stack | 12px | 700 |
| Content text | System stack | 12px | 400 |
| Labels | System stack | 11px | 500 |
| Values | System stack | 12px | 600 |
| Button text | System stack | 12px | 500 |

**System font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#2F6BFF` | Launcher, active states, accents |
| Hover | `#4A82FF` | Interactive element hover |
| Dark BG | `#1F2235` | Widget backgrounds, menus |
| Accent | `#59AFFF` | Highlighted values |
| Text | `#FFFFFF` | Primary text on dark |
| Text Secondary | `#E0E0E0` | Secondary text |
| Success | `#81C784` | Active status indicators |
| Error | `#EF5350` | Close button, error states |

## Icon Usage

- Use Unicode characters for simple icons (e.g., `\u21BB` for refresh, `\u2715` for close)
- Use the official SVG logo for branding
- Do not introduce icon libraries
- Icon size matches surrounding text

## Window Sizes

### Default Window

| Property | Value |
|----------|-------|
| Width | 360px |
| Height | 380px |
| Min width | 280px |
| Min height | 200px |
| Max width | 700px |
| Max height | 600px |

### Collapsed Window

| Property | Value |
|----------|-------|
| Width | 330px |
| Height | 44px |

## Drag Behavior

- Drag handle: widget header area
- Drag excluded: buttons, selects, inputs
- Cursor: `grab` (default), `grabbing` (during drag)
- Position updates in real-time during drag
- Position persisted on drag end
- Drag cancelled on: pointerup, pointercancel, window blur

## Resize Behavior

- Resize handle: bottom-right corner
- Resizing disabled when collapsed
- Cursor: appropriate resize cursor
- Dimensions clamped to min/max bounds
- Dimensions persisted on resize end
- Resize cancelled on: pointerup, pointercancel, window blur

## Collapse Behavior

- Trigger: collapse button click or double-click header
- Double-click excluded: button targets
- Collapsed layout: header-only (330x44px)
- Expanded layout: restores exact previous dimensions
- Body hidden with `display: none` when collapsed
- Collapse button toggles between arrow-right and arrow-down

## Z-Index

| Element | Z-Index |
|---------|---------|
| Launcher button | 2147483647 |
| Module menu | 2147483646 |
| Widget windows | Auto (stacking order) |

## Dialogs

- No modal dialogs in current implementation
- Future dialogs must follow brand colors
- Dialogs must be closable via ESC key
- Dialogs must not block launcher interaction

## Notifications

- No notification system in current implementation
- Future notifications must be non-intrusive
- Notifications auto-dismiss after 5 seconds
- Maximum 3 visible notifications

## Animations

| Property | Duration | Easing |
|----------|----------|--------|
| Button hover | 0.2s | ease |
| Menu open/close | 0.15s | ease |
| Scale (hover) | 0.2s | ease |

- Animations are subtle and fast
- No animation should delay user interaction
- Animations can be disabled via `prefers-reduced-motion`

## Keyboard Shortcuts

| Key | Action | Scope |
|-----|--------|-------|
| Escape | Close active widget | Widget window |

- Keyboard shortcuts only active when widget is visible
- Shortcuts removed when widget is hidden
- No global shortcuts that conflict with CRM

## Responsive Behavior

- Widgets use fixed pixel dimensions
- Widgets are draggable to any screen position
- Widgets do not auto-reposition on window resize
- Widgets respect screen boundaries during drag

## Launcher

| Property | Value |
|----------|-------|
| Position | Fixed, top-right (24px offset) |
| Size | 44x44px |
| Shape | Circle |
| Background | `#2F6BFF` |
| Hover background | `#4A82FF` |
| Active background | `#EF5350` |
| Text | "C" (white, 16px, bold) |

## Module Menu

| Property | Value |
|----------|-------|
| Position | Fixed, below launcher |
| Background | `#1F2235` |
| Border | 1px solid rgba(255,255,255,0.1) |
| Border radius | 10px |
| Min width | 160px |
| Shadow | 0 8px 32px rgba(0,0,0,0.5) |
