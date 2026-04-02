# Spatial Canvas — Design Spec

**Date:** 2026-04-02
**Project:** playlist-universe
**Status:** Approved

---

## Overview

A reusable React package for rendering thousands of items in an interactive 2D spatial canvas with depth illusion (via z-based scale/opacity). Items can be scattered freely or animated into clusters grouped by an arbitrary data field. Designed as a headless core + Canvas renderer split so the core can be used independently of the renderer.

Primary use case: a music playlist where songs are positioned in space, filterable by metadata (genre, movement, artist, etc.), playable on click. Designed to be generic enough for any domain (art, photos, products, etc.).

---

## Architecture

Two layers that never mix:

```
src/
├── core/
│   ├── camera.ts         # camera x/y/zoom state and pan/zoom math
│   ├── layout.ts         # scatter positions, cluster center calculation
│   ├── interaction.ts    # hit-testing (screen-space point-in-item math)
│   └── index.ts          # exports useUniverseCore hook
│
└── renderer/
    ├── UniverseCanvas.tsx  # <canvas> element, rAF render loop
    ├── draw.ts             # per-item draw logic
    └── index.ts            # exports <UniverseCanvas>
```

**Core** is pure TypeScript — no JSX, no DOM access. It handles:
- Camera position and transform math
- Layout calculations (scatter, cluster grouping)
- Hit-testing on pointer/touch events
- Selected item state
- Cluster animation target positions

**Renderer** is a React component that owns a `<canvas>` element, runs a `requestAnimationFrame` loop, and reads state from the core to draw each frame.

---

## Data Model

```ts
interface UniverseItem<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  x: number         // initial scatter position (world space)
  y: number
  z: number         // depth: affects scale and opacity, unchanged during clustering
  data: T           // consumer payload — fully generic
}
```

`z` is a static depth value. It is never animated. It controls visual depth illusion (items with higher z appear larger/more opaque). Only `x/y` animate during clustering.

All items in a given canvas instance share the same `T` type.

---

## Camera

```ts
interface Camera {
  x: number     // pan offset (world space)
  y: number
  zoom: number  // scale multiplier, clamped (e.g. 0.1–5.0)
}
```

Camera transforms are applied to the entire scene. Items do not move — the camera moves around them.

**Screen position formula:**
```
screenX = (item.x - camera.x) * camera.zoom + canvasWidth / 2
screenY = (item.y - camera.y) * camera.zoom + canvasHeight / 2
scale   = baseScale * camera.zoom * depthScale(item.z)
opacity = depthOpacity(item.z)
```

---

## Interaction

### Desktop
- **Drag** → pan (updates `camera.x/y`)
- **Scroll / trackpad pinch** → zoom (updates `camera.zoom`)
- **Click** → hit-test, fire `onItemClick`, set `selectedId`
- **Double-click** → hit-test, fire `onItemDoubleClick`
- Click vs drag distinguished by: pointer moved less than 4px AND pointer up within 300ms = click

### Mobile
- **One-finger drag** → pan
- **Two-finger pinch** → zoom (via `touchmove` with two touches)
- **Tap** → `onItemClick`
- **Double-tap** → `onItemDoubleClick` (tracked by tap timing in core, ~300ms threshold)
- No long-press gesture

All input normalization happens in the core (`interaction.ts`). The renderer passes raw events to core handlers.

---

## Filtering & Clustering

```ts
// Activate grouping
core.setGroupBy((item) => item.data.movement)

// Clear grouping — items return to scatter positions
core.setGroupBy(null)
```

**Cluster layout algorithm:**
1. Run `groupBy` accessor over all items, collect unique group keys
2. Assign each group a center point using a deterministic radial layout (same data = same layout every run)
3. Each item gets a target `x/y` = group center + deterministic small offset (seeded by item id) so items don't stack
4. Items keep their original `z` value — depth is not affected by clustering
5. Renderer lerps each item's current position toward its target each frame (simple spring, ~40 frame convergence)
6. Cluster labels (group key string) rendered at each group center while grouping is active

When `setGroupBy(null)` is called, target positions reset to original scatter `x/y` and items animate back.

---

## Package Exports

```ts
// Core hook
export { useUniverseCore } from './core'

// Canvas renderer
export { UniverseCanvas } from './renderer'

// Types
export type { UniverseItem, RenderItem, UniverseCore, Camera } from './core'

// Utility
export { loadImage } from './renderer'
```

### `RenderItem<T>` — computed per-frame item shape:

```ts
interface RenderItem<T> extends UniverseItem<T> {
  screenX: number
  screenY: number
  scale: number
  opacity: number
}
```

### `useUniverseCore<T>(options)` options:

```ts
{
  items: UniverseItem<T>[]
  onItemClick?: (item: UniverseItem<T>) => void
  onItemDoubleClick?: (item: UniverseItem<T>) => void
}
```

### `useUniverseCore<T>` returns `UniverseCore<T>`:

```ts
{
  renderItems: RenderItem<T>[]   // items with computed screenX/Y/scale/opacity
  camera: Camera
  selectedId: string | null
  setGroupBy: (fn: ((item: UniverseItem<T>) => string) | null) => void
  canvasHandlers: {              // pre-bound event handlers to spread on <canvas>
    onPointerDown, onPointerMove, onPointerUp,
    onWheel, onTouchStart, onTouchMove, onTouchEnd,
    onDoubleClick
  }
}
```

### `<UniverseCanvas<T>>` props:

```ts
{
  core: UniverseCore<T>
  width: number
  height: number
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
}
```

The `renderItem` prop gives consumers full control over how each item is drawn (image thumbnail, colored dot, icon, etc.).

---

## Performance

- **Viewport culling:** items outside the camera frustum (plus a small buffer) are skipped in the draw loop — only visible items are drawn each frame
- **Image caching:** the package exports a `loadImage(url): HTMLImageElement` utility that pre-fetches and caches images by URL; consumers call this inside their `renderItem` callback to avoid reloading on every frame
- **rAF loop:** runs only while the canvas is mounted; pauses when no animation is in progress (no clustering, no pointer activity)
- Target: 60fps with up to 5000 items total, ~200 visible at typical zoom levels

---

## What This Package Does NOT Include

- Filter UI (buttons, pills, dropdowns) — consumer responsibility
- Item detail panels or overlays — consumer responsibility
- Audio playback — consumer responsibility via `onItemClick` callback
- Any styling beyond the canvas element itself
