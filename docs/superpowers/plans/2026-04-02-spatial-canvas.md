# Spatial Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable React package (`playlist-universe`) that renders thousands of items in a true 3D spatial canvas using perspective projection, with pan/zoom navigation, click interactions, and animated clustering by data field.

**Architecture:** Pure-TS headless core (`useUniverseCore`) handles all math (camera, projection, layout, hit-testing, clustering) with no DOM access. A React Canvas renderer (`UniverseCanvas`) owns a `<canvas>` element and runs a `requestAnimationFrame` loop reading from the core. The two layers never mix — the core can be used with any renderer.

**Tech Stack:** React 19, TypeScript 5.9, HTML5 Canvas API, Vite (dev/build), Vitest (tests)

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/core/types.ts` | All shared TypeScript interfaces: `Camera`, `UniverseItem<T>`, `RenderItem<T>`, `UniverseCore<T>` |
| `src/core/camera.ts` | Camera state, perspective projection, pan/zoom math, cursor-centered zoom, z-limit clamping |
| `src/core/layout.ts` | Scatter positions, cluster center calculation, per-item target assignment, lerp animation step |
| `src/core/interaction.ts` | Hit-testing, click-vs-drag detection, double-tap detection for mobile |
| `src/core/index.ts` | `useUniverseCore<T>` hook — wires camera, layout, interaction together |
| `src/renderer/loadImage.ts` | `loadImage(url)` utility — loads and caches `HTMLImageElement` by URL |
| `src/renderer/draw.ts` | `drawFrame` function — clears canvas, iterates `renderItems`, calls consumer `renderItem` |
| `src/renderer/UniverseCanvas.tsx` | React component — owns `<canvas>`, runs rAF loop, spreads `canvasHandlers` |
| `src/renderer/index.ts` | Re-exports `UniverseCanvas` and `loadImage` |
| `src/index.ts` | Package root — re-exports everything from core and renderer |
| `src/App.tsx` | Demo app — renders a `UniverseCanvas` with 500 sample items to smoke-test locally |

---

## Task 1: Project setup — Vitest + type scaffolding

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/core/types.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Configure Vitest in vite.config.ts**

Replace the contents of `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create src/core/types.ts**

```ts
export interface Camera {
  x: number
  y: number
  z: number
}

export interface UniverseItem<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  x: number
  y: number
  z: number
  data: T
}

export interface RenderItem<T extends Record<string, unknown> = Record<string, unknown>>
  extends UniverseItem<T> {
  screenX: number
  screenY: number
  screenSize: number
}

export interface UniverseCore<T extends Record<string, unknown> = Record<string, unknown>> {
  renderItems: RenderItem<T>[]
  camera: Camera
  selectedId: string | null
  setGroupBy: (fn: ((item: UniverseItem<T>) => string) | null) => void
  canvasHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void
    onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts src/core/types.ts package-lock.json
git commit -m "feat: add Vitest and shared type definitions"
```

---

## Task 2: camera.ts — perspective projection and zoom math

**Files:**
- Create: `src/core/camera.ts`
- Create: `src/core/__tests__/camera.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/__tests__/camera.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  FOCAL_LENGTH,
  projectItem,
  clampCameraZ,
  panCamera,
  zoomCamera,
} from '../camera'

const makeItem = (x: number, y: number, z: number) => ({
  id: 'a',
  x,
  y,
  z,
  data: {},
})

describe('projectItem', () => {
  it('projects item at camera position to canvas center', () => {
    const camera = { x: 0, y: 0, z: 0 }
    const item = makeItem(0, 0, FOCAL_LENGTH)
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result.screenX).toBeCloseTo(400)
    expect(result.screenY).toBeCloseTo(300)
  })

  it('returns null when item is behind the camera', () => {
    const camera = { x: 0, y: 0, z: 500 }
    const item = makeItem(0, 0, 100) // depth = 100 - 500 = -400
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result).toBeNull()
  })

  it('screenSize scales with distance', () => {
    const camera = { x: 0, y: 0, z: 0 }
    const near = projectItem(makeItem(0, 0, 100), camera, 800, 600, 50)
    const far = projectItem(makeItem(0, 0, 400), camera, 800, 600, 50)
    expect(near!.screenSize).toBeGreaterThan(far!.screenSize)
  })
})

describe('clampCameraZ', () => {
  it('does not go below minimum', () => {
    expect(clampCameraZ(-9999, 1000)).toBe(-2000)
  })

  it('does not exceed deepest item minus buffer', () => {
    expect(clampCameraZ(990, 1000)).toBe(950) // 1000 - 50 buffer
  })

  it('allows valid z', () => {
    expect(clampCameraZ(0, 1000)).toBe(0)
  })
})

describe('panCamera', () => {
  it('adds delta to camera x and y', () => {
    const cam = panCamera({ x: 10, y: 20, z: 0 }, 5, -3)
    expect(cam.x).toBe(15)
    expect(cam.y).toBe(17)
    expect(cam.z).toBe(0)
  })
})

describe('zoomCamera', () => {
  it('moves camera z toward cursor world position', () => {
    const camera = { x: 0, y: 0, z: 0 }
    // scrolling in (negative delta) should increase z (move forward)
    const result = zoomCamera(camera, -100, 400, 300, 800, 600, 1000)
    expect(result.z).toBeGreaterThan(0)
  })

  it('is clamped to deepest item z', () => {
    const camera = { x: 0, y: 0, z: 900 }
    const result = zoomCamera(camera, -10000, 400, 300, 800, 600, 1000)
    expect(result.z).toBeLessThanOrEqual(950) // 1000 - 50 buffer
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `../camera` not found.

- [ ] **Step 3: Implement src/core/camera.ts**

```ts
import type { Camera, UniverseItem, RenderItem } from './types'

export const FOCAL_LENGTH = 800
const ITEM_WORLD_SIZE = 50
const CAMERA_Z_MIN = -2000
const CAMERA_Z_BUFFER = 50

export function projectItem<T extends Record<string, unknown>>(
  item: UniverseItem<T>,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  itemWorldSize: number = ITEM_WORLD_SIZE,
): RenderItem<T> | null {
  const depth = item.z - camera.z
  if (depth <= 0) return null
  const perspective = FOCAL_LENGTH / depth
  return {
    ...item,
    screenX: (item.x - camera.x) * perspective + canvasWidth / 2,
    screenY: (item.y - camera.y) * perspective + canvasHeight / 2,
    screenSize: itemWorldSize * perspective,
  }
}

export function clampCameraZ(z: number, deepestItemZ: number): number {
  const max = deepestItemZ - CAMERA_Z_BUFFER
  return Math.max(CAMERA_Z_MIN, Math.min(z, max))
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

export function zoomCamera(
  camera: Camera,
  wheelDelta: number,
  cursorScreenX: number,
  cursorScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
  deepestItemZ: number,
): Camera {
  const zoomFactor = 0.001
  const dz = -wheelDelta * zoomFactor * Math.abs(wheelDelta < 0 ? -1 : 1) * 0.5
  const newZ = clampCameraZ(camera.z + dz * 100, deepestItemZ)
  const actualDz = newZ - camera.z

  // Cursor-centered: keep world point under cursor fixed as z changes
  // world coords of cursor before zoom
  const depth = 1 // relative scale — we compute offset ratio
  const oldDepth = FOCAL_LENGTH // approximation using focal length as reference depth
  const cursorWorldX = (cursorScreenX - canvasWidth / 2) / (FOCAL_LENGTH / (oldDepth - camera.z + camera.z))
  const cursorWorldY = (cursorScreenY - canvasHeight / 2) / (FOCAL_LENGTH / (oldDepth - camera.z + camera.z))

  // adjust camera x/y so the world point stays under the cursor
  const oldPerspective = FOCAL_LENGTH / (oldDepth - camera.z + camera.z || FOCAL_LENGTH)
  const newPerspective = FOCAL_LENGTH / (oldDepth - newZ + newZ || FOCAL_LENGTH)
  const dx = cursorWorldX * (newPerspective - oldPerspective)
  const dy = cursorWorldY * (newPerspective - oldPerspective)

  void depth
  void dx
  void dy
  void actualDz
  void cursorWorldX
  void cursorWorldY

  return { ...camera, z: newZ }
}
```

Wait — the cursor-centered zoom math above is not correct. Let me implement it properly:

```ts
import type { Camera, UniverseItem, RenderItem } from './types'

export const FOCAL_LENGTH = 800
export const ITEM_WORLD_SIZE = 50
const CAMERA_Z_MIN = -2000
const CAMERA_Z_BUFFER = 50

export function projectItem<T extends Record<string, unknown>>(
  item: UniverseItem<T>,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  itemWorldSize: number = ITEM_WORLD_SIZE,
): RenderItem<T> | null {
  const depth = item.z - camera.z
  if (depth <= 0) return null
  const perspective = FOCAL_LENGTH / depth
  return {
    ...item,
    screenX: (item.x - camera.x) * perspective + canvasWidth / 2,
    screenY: (item.y - camera.y) * perspective + canvasHeight / 2,
    screenSize: itemWorldSize * perspective,
  }
}

export function clampCameraZ(z: number, deepestItemZ: number): number {
  const max = deepestItemZ - CAMERA_Z_BUFFER
  return Math.max(CAMERA_Z_MIN, Math.min(z, max))
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * Zoom by moving camera.z, keeping the world point under the cursor fixed on screen.
 * wheelDelta: negative = zoom in (camera moves forward = z increases)
 */
export function zoomCamera(
  camera: Camera,
  wheelDelta: number,
  cursorScreenX: number,
  cursorScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
  deepestItemZ: number,
): Camera {
  // Use a reference depth plane (e.g. the midpoint between camera and deepest item)
  // to find the world-space point under the cursor before and after zoom.
  // We pick an arbitrary reference depth from the camera: just use FOCAL_LENGTH
  // so the math stays simple and the effect is consistent.
  const refDepth = FOCAL_LENGTH

  // World coords of the cursor on the reference plane (before zoom)
  const worldX = camera.x + (cursorScreenX - canvasWidth / 2) * (refDepth / FOCAL_LENGTH)
  const worldY = camera.y + (cursorScreenY - canvasHeight / 2) * (refDepth / FOCAL_LENGTH)

  // Move camera z
  const dzRaw = -wheelDelta * 0.5
  const newZ = clampCameraZ(camera.z + dzRaw, deepestItemZ)

  // After zoom the same reference plane is now at a different relative depth.
  // To keep worldX/worldY under the cursor, adjust camera.x/y:
  // screenX = (worldX - camera.x) * (FOCAL_LENGTH / refDepth) + canvasWidth/2
  // We want that to equal cursorScreenX, so:
  // camera.x = worldX - (cursorScreenX - canvasWidth/2) * (refDepth / FOCAL_LENGTH)
  // Since refDepth is constant this reduces to: camera x/y don't change.
  // The correct approach: use the NEW depth to the reference plane (refDepth stays same in world).
  // Actually cursor-centered zoom with a moving camera.z:
  // The world point that projects to cursor stays fixed when:
  //   camera.x_new = worldX - (cursorScreenX - W/2) * (refDepth / FOCAL_LENGTH)
  // which is the same formula — so camera.x stays the same if refDepth is fixed.
  // Real cursor-centering requires choosing a depth per-frame. We use camera.z delta ratio:
  const dzActual = newZ - camera.z
  // Scale factor: how much the scene "shifts" per unit of world distance
  // When camera moves dz forward, a point at depth D appears to shift by dz/D * screenOffset
  // To compensate: shift camera x/y by the apparent cursor shift
  const cursorOffsetX = cursorScreenX - canvasWidth / 2
  const cursorOffsetY = cursorScreenY - canvasHeight / 2
  // Approximate reference depth as distance to "average scene" = FOCAL_LENGTH from current camera
  const approxDepth = refDepth
  const newCameraX = camera.x + (cursorOffsetX / FOCAL_LENGTH) * dzActual * (approxDepth / FOCAL_LENGTH) * approxDepth / approxDepth
  const newCameraY = camera.y + (cursorOffsetY / FOCAL_LENGTH) * dzActual * (approxDepth / FOCAL_LENGTH) * approxDepth / approxDepth

  return { x: newCameraX, y: newCameraY, z: newZ }
}
```

The cursor-centered zoom derivation above has circular complexity. Let me simplify to the clean, correct formula:

```ts
import type { Camera, UniverseItem, RenderItem } from './types'

export const FOCAL_LENGTH = 800
export const ITEM_WORLD_SIZE = 50
const CAMERA_Z_MIN = -2000
const CAMERA_Z_BUFFER = 50

export function projectItem<T extends Record<string, unknown>>(
  item: UniverseItem<T>,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  itemWorldSize: number = ITEM_WORLD_SIZE,
): RenderItem<T> | null {
  const depth = item.z - camera.z
  if (depth <= 0) return null
  const perspective = FOCAL_LENGTH / depth
  return {
    ...item,
    screenX: (item.x - camera.x) * perspective + canvasWidth / 2,
    screenY: (item.y - camera.y) * perspective + canvasHeight / 2,
    screenSize: itemWorldSize * perspective,
  }
}

export function clampCameraZ(z: number, deepestItemZ: number): number {
  const max = deepestItemZ - CAMERA_Z_BUFFER
  return Math.max(CAMERA_Z_MIN, Math.min(z, max))
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * Zoom by moving camera.z, keeping the world point under the cursor fixed on screen.
 *
 * Derivation: for a point P at world (px, py, pz), its screen x is:
 *   sx = (px - cx) * F / (pz - cz) + W/2
 * We want sx to remain constant as cz changes by dz. Differentiating wrt cz:
 *   d(sx)/d(cz) = (px - cx) * F / (pz - cz)^2
 * To compensate, shift cx by:
 *   dcx = (sx - W/2) / F * dz   (uses screen offset and focal length)
 * Same for y.
 */
export function zoomCamera(
  camera: Camera,
  wheelDelta: number,
  cursorScreenX: number,
  cursorScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
  deepestItemZ: number,
): Camera {
  const dzRaw = -wheelDelta * 0.5
  const newZ = clampCameraZ(camera.z + dzRaw, deepestItemZ)
  const dz = newZ - camera.z

  const offsetX = cursorScreenX - canvasWidth / 2
  const offsetY = cursorScreenY - canvasHeight / 2

  return {
    x: camera.x + (offsetX / FOCAL_LENGTH) * dz,
    y: camera.y + (offsetY / FOCAL_LENGTH) * dz,
    z: newZ,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/camera.ts src/core/__tests__/camera.test.ts
git commit -m "feat: camera projection, pan, zoom with cursor-centering"
```

---

## Task 3: layout.ts — scatter positions, cluster centers, lerp animation

**Files:**
- Create: `src/core/layout.ts`
- Create: `src/core/__tests__/layout.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/__tests__/layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeClusterTargets,
  stepAnimation,
  type AnimationState,
} from '../layout'
import type { UniverseItem } from '../types'

const items: UniverseItem<{ genre: string }>[] = [
  { id: 'a', x: 0, y: 0, z: 100, data: { genre: 'rock' } },
  { id: 'b', x: 50, y: 50, z: 200, data: { genre: 'jazz' } },
  { id: 'c', x: -50, y: 20, z: 150, data: { genre: 'rock' } },
]

describe('computeClusterTargets', () => {
  it('returns original positions when groupBy is null', () => {
    const targets = computeClusterTargets(items, null)
    expect(targets['a']).toEqual({ x: 0, y: 0 })
    expect(targets['b']).toEqual({ x: 50, y: 50 })
    expect(targets['c']).toEqual({ x: -50, y: 20 })
  })

  it('groups items near their cluster center', () => {
    const targets = computeClusterTargets(items, (item) => item.data.genre)
    // rock group: items a and c. jazz group: item b.
    // Both groups get different cluster centers
    const rockA = targets['a']
    const rockC = targets['c']
    const jazz = targets['b']
    // rock items should be near each other (within cluster spread)
    expect(Math.abs(rockA.x - rockC.x)).toBeLessThan(300)
    expect(Math.abs(rockA.y - rockC.y)).toBeLessThan(300)
    // jazz center should differ from rock center
    const rockCenterX = (rockA.x + rockC.x) / 2
    expect(Math.abs(jazz.x - rockCenterX)).toBeGreaterThan(50)
  })

  it('is deterministic — same result on repeated calls', () => {
    const a = computeClusterTargets(items, (item) => item.data.genre)
    const b = computeClusterTargets(items, (item) => item.data.genre)
    expect(a).toEqual(b)
  })
})

describe('stepAnimation', () => {
  it('moves current position toward target', () => {
    const state: AnimationState = {
      a: { currentX: 0, currentY: 0, targetX: 100, targetY: 100 },
    }
    const next = stepAnimation(state)
    expect(next['a'].currentX).toBeGreaterThan(0)
    expect(next['a'].currentX).toBeLessThan(100)
  })

  it('converges to target within 60 frames', () => {
    let state: AnimationState = {
      a: { currentX: 0, currentY: 0, targetX: 100, targetY: 100 },
    }
    for (let i = 0; i < 60; i++) state = stepAnimation(state)
    expect(state['a'].currentX).toBeCloseTo(100, 0)
    expect(state['a'].currentY).toBeCloseTo(100, 0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `../layout` not found.

- [ ] **Step 3: Implement src/core/layout.ts**

```ts
import type { UniverseItem } from './types'

export interface AnimationState {
  [id: string]: { currentX: number; currentY: number; targetX: number; targetY: number }
}

const CLUSTER_RADIUS = 600  // distance between cluster centers
const ITEM_SPREAD = 80      // max random offset within a cluster
const LERP_FACTOR = 0.1     // per frame: 10% toward target (~40 frames to converge)

/** Simple seeded hash so offsets are deterministic per item id */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0
  }
  return (h >>> 0) / 0xffffffff
}

/**
 * Deterministic radial cluster center layout.
 * Groups are sorted by key, then evenly distributed around a circle.
 */
function clusterCenters(groupKeys: string[]): Map<string, { x: number; y: number }> {
  const sorted = [...groupKeys].sort()
  const count = sorted.length
  const centers = new Map<string, { x: number; y: number }>()
  sorted.forEach((key, i) => {
    const angle = (2 * Math.PI * i) / count
    centers.set(key, {
      x: Math.cos(angle) * CLUSTER_RADIUS,
      y: Math.sin(angle) * CLUSTER_RADIUS,
    })
  })
  return centers
}

/**
 * Compute target x/y for each item.
 * If groupBy is null, targets are the item's original x/y.
 * Otherwise, targets are the cluster center + a small deterministic offset.
 */
export function computeClusterTargets<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): Record<string, { x: number; y: number }> {
  if (!groupBy) {
    return Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }]))
  }

  const groupKeys = [...new Set(items.map(groupBy))]
  const centers = clusterCenters(groupKeys)

  return Object.fromEntries(
    items.map((item) => {
      const key = groupBy(item)
      const center = centers.get(key)!
      const seed = hashId(item.id)
      const angle = seed * 2 * Math.PI
      const radius = hashId(item.id + 'r') * ITEM_SPREAD
      return [
        item.id,
        {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        },
      ]
    }),
  )
}

/** Build initial animation state from items (current = original position) */
export function initAnimationState<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
): AnimationState {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      { currentX: item.x, currentY: item.y, targetX: item.x, targetY: item.y },
    ]),
  )
}

/** Apply one lerp step to every item. Returns a new state object. */
export function stepAnimation(state: AnimationState): AnimationState {
  const next: AnimationState = {}
  for (const id in state) {
    const s = state[id]
    next[id] = {
      currentX: s.currentX + (s.targetX - s.currentX) * LERP_FACTOR,
      currentY: s.currentY + (s.targetY - s.currentY) * LERP_FACTOR,
      targetX: s.targetX,
      targetY: s.targetY,
    }
  }
  return next
}

/** Update all target positions (called when groupBy changes) */
export function updateTargets<T extends Record<string, unknown>>(
  state: AnimationState,
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): AnimationState {
  const targets = computeClusterTargets(items, groupBy)
  const next: AnimationState = {}
  for (const id in state) {
    const t = targets[id] ?? { x: state[id].currentX, y: state[id].currentY }
    next[id] = { ...state[id], targetX: t.x, targetY: t.y }
  }
  return next
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 5 layout tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/layout.ts src/core/__tests__/layout.test.ts
git commit -m "feat: layout — cluster centers, animation lerp step"
```

---

## Task 4: interaction.ts — hit-testing, click vs drag, double-tap

**Files:**
- Create: `src/core/interaction.ts`
- Create: `src/core/__tests__/interaction.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/core/__tests__/interaction.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  hitTest,
  isClick,
  isDoubleTap,
  type PointerState,
} from '../interaction'
import type { RenderItem } from '../types'

const makeRenderItem = (screenX: number, screenY: number, screenSize: number): RenderItem<Record<string, unknown>> => ({
  id: 'x',
  x: 0, y: 0, z: 100,
  data: {},
  screenX,
  screenY,
  screenSize,
})

describe('hitTest', () => {
  it('returns item when pointer is inside its bounding box', () => {
    const items = [makeRenderItem(100, 100, 40)]
    expect(hitTest(items, 105, 105)).toBe(items[0])
  })

  it('returns null when pointer is outside all items', () => {
    const items = [makeRenderItem(100, 100, 40)]
    expect(hitTest(items, 200, 200)).toBeNull()
  })

  it('returns the topmost (last in array = closest) item when overlapping', () => {
    const back = makeRenderItem(100, 100, 40)
    const front = { ...makeRenderItem(100, 100, 40), id: 'front' }
    expect(hitTest([back, front], 100, 100)).toBe(front)
  })
})

describe('isClick', () => {
  it('returns true for small movement under 300ms', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 100,
      isDragging: false,
    }
    expect(isClick(state, 12, 11)).toBe(true)
  })

  it('returns false when pointer moved more than 4px', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 100,
      isDragging: false,
    }
    expect(isClick(state, 20, 10)).toBe(false)
  })

  it('returns false when more than 300ms elapsed', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 400,
      isDragging: false,
    }
    expect(isClick(state, 11, 10)).toBe(false)
  })
})

describe('isDoubleTap', () => {
  it('returns true when two taps within 300ms', () => {
    const lastTap = Date.now() - 200
    expect(isDoubleTap(lastTap)).toBe(true)
  })

  it('returns false when taps are too far apart', () => {
    const lastTap = Date.now() - 400
    expect(isDoubleTap(lastTap)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `../interaction` not found.

- [ ] **Step 3: Implement src/core/interaction.ts**

```ts
import type { RenderItem } from './types'

export interface PointerState {
  downX: number
  downY: number
  downTime: number
  isDragging: boolean
}

const CLICK_DISTANCE_PX = 4
const CLICK_TIME_MS = 300
const DOUBLE_TAP_MS = 300

/**
 * Find the topmost item at screen coordinates (x, y).
 * items is assumed sorted back-to-front, so we reverse-iterate
 * to find the frontmost hit first.
 */
export function hitTest<T extends Record<string, unknown>>(
  items: RenderItem<T>[],
  x: number,
  y: number,
): RenderItem<T> | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    const half = item.screenSize / 2
    if (
      x >= item.screenX - half &&
      x <= item.screenX + half &&
      y >= item.screenY - half &&
      y <= item.screenY + half
    ) {
      return item
    }
  }
  return null
}

/** Returns true if the pointer-up event qualifies as a click (not a drag). */
export function isClick(state: PointerState, upX: number, upY: number): boolean {
  const dx = upX - state.downX
  const dy = upY - state.downY
  const dist = Math.sqrt(dx * dx + dy * dy)
  const elapsed = Date.now() - state.downTime
  return dist < CLICK_DISTANCE_PX && elapsed < CLICK_TIME_MS
}

/** Returns true if the current tap follows a previous tap within the double-tap threshold. */
export function isDoubleTap(lastTapTime: number): boolean {
  return Date.now() - lastTapTime < DOUBLE_TAP_MS
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all 7 interaction tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/interaction.ts src/core/__tests__/interaction.test.ts
git commit -m "feat: interaction — hit-test, click/drag detection, double-tap"
```

---

## Task 5: useUniverseCore hook

**Files:**
- Create: `src/core/index.ts`

No unit tests here — the hook integrates camera, layout, and interaction and its behaviour is tested visually in the demo (Task 8). The individual units are already tested.

- [ ] **Step 1: Implement src/core/index.ts**

```ts
import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'
import { projectItem, panCamera, zoomCamera } from './camera'
import {
  initAnimationState,
  stepAnimation,
  updateTargets,
  type AnimationState,
} from './layout'
import { hitTest, isClick, isDoubleTap, type PointerState } from './interaction'

export { type Camera, type UniverseItem, type RenderItem, type UniverseCore } from './types'

interface UseUniverseCoreOptions<T extends Record<string, unknown>> {
  items: UniverseItem<T>[]
  onItemClick?: (item: UniverseItem<T>) => void
  onItemDoubleClick?: (item: UniverseItem<T>) => void
}

export function useUniverseCore<T extends Record<string, unknown>>(
  options: UseUniverseCoreOptions<T>,
): UniverseCore<T> & {
  animationState: AnimationState
  stepAnimationFrame: (width: number, height: number) => RenderItem<T>[]
} {
  const { items, onItemClick, onItemDoubleClick } = options

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [groupBy, setGroupByState] = useState<((item: UniverseItem<T>) => string) | null>(null)

  const animRef = useRef<AnimationState>(initAnimationState(items))
  const pointerRef = useRef<PointerState | null>(null)
  const lastTapRef = useRef<number>(0)
  const prevTouchDistRef = useRef<number | null>(null)
  const prevTouchMidRef = useRef<{ x: number; y: number } | null>(null)

  const deepestItemZ = items.reduce((max, item) => Math.max(max, item.z), 0)

  const setGroupBy = useCallback(
    (fn: ((item: UniverseItem<T>) => string) | null) => {
      setGroupByState(() => fn)
      animRef.current = updateTargets(animRef.current, items, fn)
    },
    [items],
  )

  /** Called each rAF frame by the renderer. Returns culled, projected, sorted render items. */
  const stepAnimationFrame = useCallback(
    (width: number, height: number): RenderItem<T>[] => {
      animRef.current = stepAnimation(animRef.current)

      const projected: RenderItem<T>[] = []
      for (const item of items) {
        const anim = animRef.current[item.id]
        const withAnim: UniverseItem<T> = anim
          ? { ...item, x: anim.currentX, y: anim.currentY }
          : item
        const rendered = projectItem(withAnim, camera, width, height)
        if (rendered) projected.push(rendered)
      }

      // Sort back-to-front (largest depth = furthest back = draw first)
      projected.sort((a, b) => (b.z - camera.z) - (a.z - camera.z))
      return projected
    },
    [items, camera],
  )

  // --- Canvas event handlers ---

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = {
      downX: e.clientX,
      downY: e.clientY,
      downTime: Date.now(),
      isDragging: false,
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current) return
      const dx = e.clientX - pointerRef.current.downX
      const dy = e.clientY - pointerRef.current.downY
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        pointerRef.current.isDragging = true
      }
      if (pointerRef.current.isDragging) {
        setCamera((c) => panCamera(c, -dx / 1, -dy / 1))
        pointerRef.current = { ...pointerRef.current, downX: e.clientX, downY: e.clientY }
      }
    },
    [],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (isClick(pointerRef.current, e.clientX, e.clientY)) {
        // We need renderItems here — pass via a ref set by renderer
        // For now, fire with null item; renderer will handle hit-testing directly
        setSelectedId(null)
        onItemClick?.(null as unknown as UniverseItem<T>)
        void x
        void y
      }
      pointerRef.current = null
    },
    [onItemClick],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      setCamera((c) =>
        zoomCamera(c, e.deltaY, cursorX, cursorY, rect.width, rect.height, deepestItemZ),
      )
    },
    [deepestItemZ],
  )

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      pointerRef.current = {
        downX: e.touches[0].clientX,
        downY: e.touches[0].clientY,
        downTime: Date.now(),
        isDragging: false,
      }
      prevTouchDistRef.current = null
      prevTouchMidRef.current = null
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      prevTouchDistRef.current = Math.sqrt(dx * dx + dy * dy)
      prevTouchMidRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }, [])

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (e.touches.length === 1 && pointerRef.current) {
        const dx = e.touches[0].clientX - pointerRef.current.downX
        const dy = e.touches[0].clientY - pointerRef.current.downY
        pointerRef.current.isDragging = true
        setCamera((c) => panCamera(c, -dx, -dy))
        pointerRef.current = { ...pointerRef.current, downX: e.touches[0].clientX, downY: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const mid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        }
        if (prevTouchDistRef.current !== null) {
          const delta = prevTouchDistRef.current - dist
          const rect = e.currentTarget.getBoundingClientRect()
          setCamera((c) =>
            zoomCamera(c, delta * 2, mid.x - rect.left, mid.y - rect.top, rect.width, rect.height, deepestItemZ),
          )
        }
        prevTouchDistRef.current = dist
        prevTouchMidRef.current = mid
      }
    },
    [deepestItemZ],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.changedTouches.length === 1 && pointerRef.current) {
        const touch = e.changedTouches[0]
        if (isClick(pointerRef.current, touch.clientX, touch.clientY)) {
          if (isDoubleTap(lastTapRef.current)) {
            onItemDoubleClick?.(null as unknown as UniverseItem<T>)
          } else {
            onItemClick?.(null as unknown as UniverseItem<T>)
          }
          lastTapRef.current = Date.now()
        }
        pointerRef.current = null
      }
    },
    [onItemClick, onItemDoubleClick],
  )

  const onDoubleClick = useCallback(
    (_e: React.MouseEvent<HTMLCanvasElement>) => {
      onItemDoubleClick?.(null as unknown as UniverseItem<T>)
    },
    [onItemDoubleClick],
  )

  return {
    renderItems: [], // populated each frame by stepAnimationFrame
    camera,
    selectedId,
    setGroupBy,
    animationState: animRef.current,
    stepAnimationFrame,
    canvasHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onDoubleClick,
    },
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/index.ts
git commit -m "feat: useUniverseCore hook wires camera, layout, interaction"
```

---

## Task 6: loadImage utility + draw.ts

**Files:**
- Create: `src/renderer/loadImage.ts`
- Create: `src/renderer/draw.ts`
- Create: `src/renderer/__tests__/loadImage.test.ts`

- [ ] **Step 1: Write failing test for loadImage**

Create `src/renderer/__tests__/loadImage.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { loadImage } from '../loadImage'

describe('loadImage', () => {
  it('returns same HTMLImageElement for the same URL (caching)', () => {
    const a = loadImage('http://example.com/img.png')
    const b = loadImage('http://example.com/img.png')
    expect(a).toBe(b)
  })

  it('returns different elements for different URLs', () => {
    const a = loadImage('http://example.com/1.png')
    const b = loadImage('http://example.com/2.png')
    expect(a).not.toBe(b)
  })

  it('sets the src on the returned element', () => {
    const img = loadImage('http://example.com/test.png')
    expect(img.src).toBe('http://example.com/test.png')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `../loadImage` not found.

- [ ] **Step 3: Implement src/renderer/loadImage.ts**

```ts
const cache = new Map<string, HTMLImageElement>()

/**
 * Load and cache an image by URL.
 * Returns the same HTMLImageElement on repeated calls with the same URL.
 * Safe to call inside a renderItem callback on every frame.
 */
export function loadImage(url: string): HTMLImageElement {
  if (cache.has(url)) return cache.get(url)!
  const img = new Image()
  img.src = url
  cache.set(url, img)
  return img
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: loadImage tests PASS.

- [ ] **Step 5: Implement src/renderer/draw.ts**

No unit tests for draw — it requires a canvas context. Tested visually in the demo.

```ts
import type { RenderItem } from '../core/types'

interface DrawFrameOptions<T extends Record<string, unknown>> {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  renderItems: RenderItem<T>[]
  selectedId: string | null
  groupBy: ((item: RenderItem<T>) => string) | null
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
}

export function drawFrame<T extends Record<string, unknown>>(
  options: DrawFrameOptions<T>,
): void {
  const { ctx, width, height, renderItems, selectedId, groupBy, renderItem } = options

  ctx.clearRect(0, 0, width, height)

  // Draw items back-to-front (renderItems is already sorted)
  for (const item of renderItems) {
    renderItem(ctx, item, item.id === selectedId)
  }

  // Draw cluster labels if groupBy is active
  if (groupBy) {
    const seen = new Set<string>()
    const centers = new Map<string, { x: number; y: number; count: number }>()

    for (const item of renderItems) {
      const key = groupBy(item)
      if (!centers.has(key)) {
        centers.set(key, { x: 0, y: 0, count: 0 })
      }
      const c = centers.get(key)!
      c.x += item.screenX
      c.y += item.screenY
      c.count++
    }

    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.textAlign = 'center'

    for (const [key, center] of centers) {
      if (seen.has(key)) continue
      seen.add(key)
      ctx.fillText(key, center.x / center.count, center.y / center.count - 40)
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/loadImage.ts src/renderer/draw.ts src/renderer/__tests__/loadImage.test.ts
git commit -m "feat: loadImage cache utility and drawFrame function"
```

---

## Task 7: UniverseCanvas React component + renderer/index.ts

**Files:**
- Create: `src/renderer/UniverseCanvas.tsx`
- Create: `src/renderer/index.ts`

- [ ] **Step 1: Implement src/renderer/UniverseCanvas.tsx**

```tsx
import { useEffect, useRef, useCallback } from 'react'
import type { RenderItem } from '../core/types'
import type { UniverseCore } from '../core/types'
import { drawFrame } from './draw'
import { hitTest } from '../core/interaction'

interface UniverseCanvasProps<T extends Record<string, unknown>> {
  core: UniverseCore<T> & {
    stepAnimationFrame: (width: number, height: number) => RenderItem<T>[]
    animationState: unknown
  }
  width: number
  height: number
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
  groupBy?: ((item: RenderItem<T>) => string) | null
}

export function UniverseCanvas<T extends Record<string, unknown>>({
  core,
  width,
  height,
  renderItem,
  groupBy = null,
}: UniverseCanvasProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const renderItemsRef = useRef<RenderItem<T>[]>([])

  const loop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const items = core.stepAnimationFrame(width, height)
    renderItemsRef.current = items

    drawFrame({
      ctx,
      width,
      height,
      renderItems: items,
      selectedId: core.selectedId,
      groupBy: groupBy as ((item: RenderItem<Record<string, unknown>>) => string) | null,
      renderItem: renderItem as (ctx: CanvasRenderingContext2D, item: RenderItem<Record<string, unknown>>, isSelected: boolean) => void,
    })

    rafRef.current = requestAnimationFrame(loop)
  }, [core, width, height, renderItem, groupBy])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [loop])

  // Augment pointer handlers to include hit-testing
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Pass hit result to core via the existing handler
      // The core's onPointerUp fires onItemClick; we re-fire with the actual item here
      const hit = hitTest(renderItemsRef.current, x, y)
      if (hit) {
        core.canvasHandlers.onPointerUp(e)
        // Note: core will call onItemClick(null) — we override that by calling directly
        // For the actual item, the consumer's onItemClick was wired in useUniverseCore
        // This is a known limitation: the hook fires null, the canvas fires the real item
        // Full solution: pass renderItems into the hook. For now the canvas fires it correctly:
        void hit
      } else {
        core.canvasHandlers.onPointerUp(e)
      }
    },
    [core],
  )

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', touchAction: 'none' }}
      onPointerDown={core.canvasHandlers.onPointerDown}
      onPointerMove={core.canvasHandlers.onPointerMove}
      onPointerUp={handlePointerUp}
      onWheel={core.canvasHandlers.onWheel}
      onTouchStart={core.canvasHandlers.onTouchStart}
      onTouchMove={core.canvasHandlers.onTouchMove}
      onTouchEnd={core.canvasHandlers.onTouchEnd}
      onDoubleClick={core.canvasHandlers.onDoubleClick}
    />
  )
}
```

- [ ] **Step 2: Implement src/renderer/index.ts**

```ts
export { UniverseCanvas } from './UniverseCanvas'
export { loadImage } from './loadImage'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/UniverseCanvas.tsx src/renderer/index.ts
git commit -m "feat: UniverseCanvas component with rAF loop"
```

---

## Task 8: Package root exports + refactor hook to fix hit-testing

The hook currently fires `onItemClick(null)` because it doesn't have access to the projected `renderItems` at pointer-up time. The canvas has them via `renderItemsRef`. Fix: pass a `renderItems` getter into the hook, or pass the click handler to the canvas which resolves the hit first.

**Files:**
- Modify: `src/core/index.ts`
- Modify: `src/renderer/UniverseCanvas.tsx`
- Create: `src/index.ts`

- [ ] **Step 1: Fix hit-testing — update src/core/index.ts**

The hook needs a way to know the current projected items at pointer-up time. Add an `onPointerUpWithItems` approach: the canvas calls `handleItemClick` / `handleItemDoubleClick` directly with the hit item, bypassing the hook's own up-handler for click resolution.

Replace the `onPointerUp` in `src/core/index.ts` with:

```ts
const onPointerUp = useCallback(
  (_e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current = null
  },
  [],
)
```

And add two new exported methods to the return value:

```ts
handleItemClick: (item: UniverseItem<T>) => {
  setSelectedId(item.id)
  onItemClick?.(item)
},
handleItemDoubleClick: (item: UniverseItem<T>) => {
  onItemDoubleClick?.(item)
},
```

Also add these to the `UniverseCore<T>` interface in `src/core/types.ts`:

```ts
handleItemClick: (item: UniverseItem<T>) => void
handleItemDoubleClick: (item: UniverseItem<T>) => void
```

- [ ] **Step 2: Update UniverseCanvas to use handleItemClick/handleItemDoubleClick**

Replace `handlePointerUp` in `src/renderer/UniverseCanvas.tsx` with:

```tsx
const handlePointerUp = useCallback(
  (e: React.PointerEvent<HTMLCanvasElement>) => {
    core.canvasHandlers.onPointerUp(e)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = hitTest(renderItemsRef.current, x, y)
    if (hit) core.handleItemClick(hit)
  },
  [core],
)

const handleDoubleClick = useCallback(
  (e: React.MouseEvent<HTMLCanvasElement>) => {
    core.canvasHandlers.onDoubleClick(e)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = hitTest(renderItemsRef.current, x, y)
    if (hit) core.handleItemDoubleClick(hit)
  },
  [core],
)
```

And update `onDoubleClick` in the JSX to `handleDoubleClick` and `onPointerUp` to `handlePointerUp`.

Also fix mobile double-tap in `onTouchEnd` in `src/core/index.ts` — change from:
```ts
onItemDoubleClick?.(null as unknown as UniverseItem<T>)
```
to:
```ts
// double-tap: resolved by canvas via handleItemDoubleClick
```
and just call `setSelectedId` with the item from a separate tap handler (the canvas will handle item resolution for touch too).

Actually for simplicity — in `onTouchEnd` in the hook, resolve the item the same way as desktop: the canvas calls `handleItemClick` / `handleItemDoubleClick` after its own touch-end processing. Update `onTouchEnd` in the hook to just track tap timing but not fire callbacks directly:

```ts
const onTouchEnd = useCallback(
  (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.changedTouches.length === 1 && pointerRef.current) {
      const touch = e.changedTouches[0]
      if (isClick(pointerRef.current, touch.clientX, touch.clientY)) {
        // Canvas will call handleItemClick / handleItemDoubleClick with the hit item
        prevTapWasClickRef.current = isDoubleTap(lastTapRef.current)
        lastTapRef.current = Date.now()
      }
      pointerRef.current = null
    }
  },
  [],
)
```

Add `prevTapWasClickRef` to the hook refs:
```ts
const prevTapWasClickRef = useRef(false)
```

And export it:
```ts
prevTapWasClick: prevTapWasClickRef,
```

Update canvas touch-end handler to use it:

```tsx
const handleTouchEnd = useCallback(
  (e: React.TouchEvent<HTMLCanvasElement>) => {
    core.canvasHandlers.onTouchEnd(e)
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      const rect = e.currentTarget.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const hit = hitTest(renderItemsRef.current, x, y)
      if (hit) {
        if (core.prevTapWasClick.current) {
          core.handleItemDoubleClick(hit)
        } else {
          core.handleItemClick(hit)
        }
      }
    }
  },
  [core],
)
```

- [ ] **Step 3: Create src/index.ts**

```ts
export { useUniverseCore } from './core'
export { UniverseCanvas, loadImage } from './renderer'
export type { UniverseItem, RenderItem, UniverseCore, Camera } from './core'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/index.ts src/core/types.ts src/renderer/UniverseCanvas.tsx src/index.ts
git commit -m "feat: wire hit-testing through canvas, add package root exports"
```

---

## Task 9: Demo app in App.tsx

Wire everything together with 500 sample items to smoke-test locally.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update src/App.tsx**

```tsx
import { useState } from 'react'
import { useUniverseCore, UniverseCanvas, loadImage } from './index'
import type { UniverseItem, RenderItem } from './index'

type ArtPiece = {
  title: string
  movement: string
  imageUrl: string
}

// Generate 500 deterministic sample items spread across 3D space
function generateItems(): UniverseItem<ArtPiece>[] {
  const movements = ['Impressionism', 'Cubism', 'Surrealism', 'Abstract', 'Baroque']
  return Array.from({ length: 500 }, (_, i) => ({
    id: `item-${i}`,
    x: (Math.sin(i * 0.37) * 2000),
    y: (Math.cos(i * 0.53) * 2000),
    z: 200 + (i % 10) * 150,
    data: {
      title: `Artwork ${i}`,
      movement: movements[i % movements.length],
      imageUrl: `https://picsum.photos/seed/${i}/60/60`,
    },
  }))
}

const ITEMS = generateItems()

function renderItem(
  ctx: CanvasRenderingContext2D,
  item: RenderItem<ArtPiece>,
  isSelected: boolean,
) {
  const { screenX, screenY, screenSize } = item
  const half = screenSize / 2
  const img = loadImage(item.data.imageUrl)

  if (img.complete) {
    ctx.drawImage(img, screenX - half, screenY - half, screenSize, screenSize)
  } else {
    ctx.fillStyle = '#ccc'
    ctx.fillRect(screenX - half, screenY - half, screenSize, screenSize)
  }

  if (isSelected) {
    ctx.strokeStyle = '#ff0'
    ctx.lineWidth = 3
    ctx.strokeRect(screenX - half - 2, screenY - half - 2, screenSize + 4, screenSize + 4)
  }
}

export default function App() {
  const [activeGroupBy, setActiveGroupBy] = useState<string | null>(null)

  const core = useUniverseCore<ArtPiece>({
    items: ITEMS,
    onItemClick: (item) => {
      console.log('clicked:', item.data.title)
    },
    onItemDoubleClick: (item) => {
      console.log('double-clicked:', item.data.title)
    },
  })

  const handleFilter = (field: string | null) => {
    setActiveGroupBy(field)
    core.setGroupBy(field ? (item) => (item.data as ArtPiece)[field as keyof ArtPiece] as string : null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#f0f0f0' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <button onClick={() => handleFilter(null)} style={{ fontWeight: activeGroupBy === null ? 'bold' : 'normal' }}>
          Scatter
        </button>
        <button onClick={() => handleFilter('movement')} style={{ fontWeight: activeGroupBy === 'movement' ? 'bold' : 'normal' }}>
          By Movement
        </button>
      </div>
      <UniverseCanvas
        core={core}
        width={window.innerWidth}
        height={window.innerHeight}
        renderItem={renderItem}
        groupBy={activeGroupBy ? (item) => (item.data as ArtPiece).movement : null}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run the dev server and manually test**

```bash
npm run dev
```

Open the URL shown in terminal. Verify:
- 500 items visible (grey boxes while images load, images once loaded)
- Drag to pan
- Scroll to zoom in/out (cursor-centered)
- Click an item → logs to console
- "By Movement" button → items animate into 5 clusters with labels
- "Scatter" button → items animate back to scatter

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: demo app with 500 items, clustering, pan/zoom"
```

---

## Self-Review Notes

- **Spec coverage:**
  - ✅ True 3D perspective projection (`camera.ts`)
  - ✅ Camera z-axis zoom with clamping (`clampCameraZ`)
  - ✅ Cursor-centered zoom (`zoomCamera`)
  - ✅ Pan via drag
  - ✅ Mobile: one-finger pan, two-finger pinch zoom, tap, double-tap
  - ✅ Hit-testing (`interaction.ts` + canvas)
  - ✅ Click vs drag detection (`isClick`)
  - ✅ Single/double click callbacks (`handleItemClick`, `handleItemDoubleClick`)
  - ✅ Selected item highlight via `selectedId`
  - ✅ Generic `UniverseItem<T>`
  - ✅ `groupBy` clustering with deterministic radial layout
  - ✅ Clustering animation (lerp)
  - ✅ `z` preserved during clustering
  - ✅ Cluster labels in draw.ts
  - ✅ Back-to-front sort
  - ✅ Viewport culling (items behind camera skipped)
  - ✅ `loadImage` cache utility
  - ✅ rAF loop in renderer
  - ✅ Package root exports (`src/index.ts`)
  - ✅ Consumer `renderItem` callback

- **Type consistency:** All tasks use `RenderItem<T>` with `screenX`, `screenY`, `screenSize`. `UniverseCore<T>` in `types.ts` is the single source of truth.
