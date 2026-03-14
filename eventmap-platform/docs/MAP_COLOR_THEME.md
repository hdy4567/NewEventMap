
# 🎨 NewEventMap Map & UI Color Theme Documentation

## 1. Overview
The design theme for NewEventMap is based on a **Premium Dark Chocolate & Biscuit** aesthetic, moving away from generic dark modes toward a curated, warm-toned luxury experience.

---

## 2. Core Color Palette (Tokens)

| Token Name | Hex Code | Description | Visual Mapping |
| :--- | :--- | :--- | :--- |
| **Primary (Cookie)** | `#8B5E3C` | Rich Bronze | Core brand color, active tabs, primary buttons |
| **Primary Glow (Tan)** | `#D2B48C` | Light Biscuit | Highlights, hover states, specialized icons |
| **Background (Midnight)** | `#0A0908` | Deep Obsidian | Main application body background |
| **Surface (Cocoa)** | `#1A1714` | Deep Cocoa | Overlays, panels, card backgrounds |
| **Surface Light (Slate)** | `#2E2925` | Warm Slate | Secondary surfaces, button hover states |
| **Text (Cream)** | `#F5EFEB` | Soft Off-White | High-contrast primary text |
| **Text Dim (Dust)** | `#A8A096` | Cocoa Dust | Secondary text, hints, descriptive labels |

---

## 3. Map Color Engine (The "Cookie Filter")

The map utilizes a CSS filter chain to transform standard OpenStreetMap tiles into a branded dark theme without needing a custom tile server.

### 🛠 Applied CSS Filter:
```css
filter: invert(100%) hue-rotate(180deg) sepia(50%) brightness(80%) contrast(110%);
```

### 🔍 Color Breakdown:
1. **Invert (100%)**: Flips the base map colors (Light tiles become Dark).
2. **Hue-Rotate (180deg)**: Shifts the blue/green spectrum of water and land to a neutral base.
3. **Sepia (50%)**: Adds the **Warm "Antique" tone**, giving the map its distinctive chocolate/cookie feel.
4. **Brightness (80%)**: Dims the map to eye-friendly levels for night usage.
5. **Contrast (110%)**: Ensures road networks and boundaries remain clear against the dark background.

---

## 4. UI Elements & Animations
- **Glassmorphism**: Panels use `rgba(26, 23, 20, 0.92)` with a `24px` backdrop blur to maintain depth.
- **Micro-Animations**: All interactive elements use `cubic-bezier(0.23, 1, 0.32, 1)` for a "Mac-like" elastic feel.

---
*Created by Antigravity AI - NewEventMap Core Design Documentation*
