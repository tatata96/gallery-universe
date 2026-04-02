# Spatial Canvas — Design Spec

**Date:** 2026-04-02
**Project:** playlist-universe
**Status:** Approved

---

## Overview

A reusable React package for rendering thousands of items in an interactive **true 3D** spatial canvas. Items exist at real x/y/z world-space coordinates and are projected onto the canvas via perspective projection. The user navigates by panning (x/y) and zooming (moving camera along the z-axis into the scene). Items can be scattered freely or animated into clusters grouped by an arbitrary data field. Designed as a headless core + Canvas renderer split so the core can be used independently of the renderer.

Primary use case: a music playlist where songs are positioned in 3D space, filterable by metadata (genre, movement, artist, etc.), playable on click. Designed to be generic enough for any domain (art, photos, products, etc.).

---

## Architecture

Two layers that never mix:

```
src/
├── core/
│   ├── camera.ts         # camera x/y/z state, pan math, zoom math
│   ├── layout.ts         # scatter positions, cluster center calculation
│   ├── interaction.ts    # hit-testing (screen-space point-in-item math)
│   └── index.ts          # exports useUniverseCore hook
│
└── renderer/
    ├── UniverseCanvas.tsx  # <canvas> element, rAF render loop
    ├── draw.ts             # per-item draw logic
    └── index.ts            # exports <UniverseCanvas> and loadImage utility
```

**Core** is pure TypeScript — no JSX, no DOM access. It handles:
- Camera position (x/y/z) and perspective projection math
- Pan (x/y) and zoom (z-axis movement)
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
  x: number   // world-space position
  y: number
  z: number   // depth in world space — determines perspective size, never animated
  data: T     // consumer payload — fully generic
}
```

`z` is a static world-space depth coordinate. It is **never animated**. It determines how large the item appears via perspective projection — items further from the camera (larger relative depth) appear smaller. Only `x/y` animate during clustering.

All items in a given canvas instance share the same `T` type.

---

## Camera & Projection

```ts
interface Camera {
  x: number   // world-space position (pan)
  y: number
  z: number   // depth position — moving this forward/backward is "zoom"
}
```

The camera moves through the 3D scene. Items are stationary in world space; the camera moves around them.

**Perspective projection:**
```
depth       = item.z - camera.z          // relative depth from camera (must be > 0)
perspective = focalLength / depth
screenX     = (item.x - camera.x) * perspective + canvasWidth / 2
screenY     = (item.y - camera.y) * perspective + canvasHeight / 2
screenSize  = itemWorldSize * perspective  // rendered size in pixels
```

`focalLength` is a fixed constant (e.g. 800) that controls the strength of the perspective effect.

**Camera z limits:**
- **Min (zoomed out):** a fixed floor, e.g. `camera.z >= -2000`
- **Max (zoomed in):** `camera.z < deepestItem.z - buffer` where buffer ≈ 50 units — you can never pass through the last item
- Items where `depth <= 0` (behind the camera) are culled — not drawn

**Cursor-centered zoom:** when scrolling/pinching, the point in world space under the cursor stays fixed on screen. As `camera.z` changes, `camera.x/y` are adjusted to compensate so the cursor's world-space position doesn't shift. This gives the familiar "zoom into where your cursor is" behaviour (same as Google Maps).

---

## Interaction

### Desktop
- **Drag** → pan (updates `camera.x/y`)
- **Scroll / trackpad pinch** → zoom (updates `camera.z`), cursor-centered
- **Click** → hit-test, fire `onItemClick`, set `selectedId`
- **Double-click** → hit-test, fire `onItemDoubleClick`
- Click vs drag distinguished by: pointer moved less than 4px AND pointer up within 300ms = click

### Mobile
- **One-finger drag** → pan
- **Two-finger pinch** → zoom (via `touchmove` with two touches), pinch midpoint-centered
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
  screenX: number      // projected screen position
  screenY: number
  screenSize: number   // world size projected through perspective — use this to draw the item
}
```

No `scale` or `opacity` fields — perspective projection fully determines rendered size. There is no depth-based opacity effect.

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
  renderItems: RenderItem<T>[]   // items visible this frame (culled), sorted back-to-front
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

Note: `renderItems` is already sorted back-to-front (largest depth first) so the renderer can draw them in order without additional sorting.

### `<UniverseCanvas<T>>` props:

```ts
{
  core: UniverseCore<T>
  width: number
  height: number
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
}
```

The `renderItem` prop gives consumers full control over how each item is drawn (image thumbnail, colored dot, icon, etc.). Use `item.screenX`, `item.screenY`, and `item.screenSize` to position and size the drawing.

---

## Performance

- **Viewport culling:** items behind the camera (`depth <= 0`) or outside the screen bounds are skipped each frame — only visible items are passed to `renderItems`
- **Back-to-front sort:** `renderItems` is pre-sorted by depth so closer items draw on top of farther items correctly
- **Image caching:** the package exports a `loadImage(url): HTMLImageElement` utility that pre-fetches and caches images by URL; consumers call this inside their `renderItem` callback to avoid reloading on every frame
- **rAF loop:** runs only while the canvas is mounted; pauses when no animation is in progress (no clustering, no pointer activity)
- Target: 60fps with up to 5000 items total, ~200 visible at typical zoom levels

---

## What This Package Does NOT Include

- Filter UI (buttons, pills, dropdowns) — consumer responsibility
- Item detail panels or overlays — consumer responsibility
- Audio playback — consumer responsibility via `onItemClick` callback
- Any styling beyond the canvas element itself
