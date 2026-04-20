# gallery-universe

A zoomable, clusterable 3D canvas for displaying large collections of items. Navigate thousands of items in a perspective space — scatter them freely or group them into clusters, with smooth pinch-to-zoom, pan, and animated transitions between layouts.

## Features

- Perspective 3D canvas — items exist at real world coordinates with depth-based projection
- Pinch-to-zoom and two-finger pan (trackpad and touch) with content boundary clamping
- Cluster mode — group items by any property with animated transitions
- Navigate between clusters with smooth camera pans
- `CategoryNav` component — scrollable category bar that auto-highlights the nearest cluster as you pan
- Configurable cluster label position (`up`, `down`, `center`)
- Custom item rendering — bring your own draw function
- Built-in image renderer with loading states and selection highlight
- Click and double-click hit detection

## Install

```bash
npm install gallery-universe gsap
```

> `gsap` is a required peer for smooth camera animation.

## Basic usage

```tsx
import { useUniverseCore, UniverseCanvas, createItems, createImageRenderer } from 'gallery-universe'

type Track = {
  title: string
  artist: string
  coverUrl: string
}

// Create items once, outside the component
const items = createItems(800, (i) => ({
  title: `Track ${i}`,
  artist: `Artist ${i % 20}`,
  coverUrl: `https://example.com/covers/${i}.jpg`,
}))

const renderItem = createImageRenderer<Track>('coverUrl')

export default function App() {
  const core = useUniverseCore<Track>({
    items,
    onItemClick: (item) => console.log(item.data.title),
    onItemDoubleClick: (item) => console.log('double:', item.data.title),
  })

  return (
    <UniverseCanvas
      core={core}
      width={window.innerWidth}
      height={window.innerHeight}
      renderItem={renderItem}
    />
  )
}
```

## Grouping and cluster navigation

```tsx
export default function App() {
  const core = useUniverseCore<Track>({ items })

  return (
    <>
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <button onClick={() => core.setGroupBy(null)}>Scatter</button>

        <button onClick={() => core.setGroupBy((item) => item.data.artist)}>
          By Artist
        </button>
      </div>

      <UniverseCanvas
        core={core}
        width={window.innerWidth}
        height={window.innerHeight}
        renderItem={renderItem}
        groupBy={(item) => item.data.artist}
        clusterLabelPosition="up"
      />
    </>
  )
}
```

## CategoryNav

`CategoryNav` renders a scrollable pill bar that auto-highlights the cluster nearest to the camera as you pan. Clicking a pill navigates to that cluster.

```tsx
import { CategoryNav } from 'gallery-universe'

const groupBy = (item) => item.data.artist
const groups = [...new Set(items.map(groupBy))].map((key) => ({
  key,
  count: items.filter((i) => groupBy(i) === key).length,
}))

export default function App() {
  const core = useUniverseCore<Track>({ items })

  return (
    <>
      <CategoryNav
        groups={groups}
        cameraRef={core.cameraRef}
        groupCentersRef={core.groupCentersRef}
        onSelect={(key) => core.navigateToGroup(key)}
      />

      <UniverseCanvas
        core={core}
        width={window.innerWidth}
        height={window.innerHeight}
        renderItem={renderItem}
        groupBy={groupBy}
      />
    </>
  )
}
```

### `CategoryNav` props

| Prop | Type | Description |
|---|---|---|
| `groups` | `{ key: string; count: number }[]` | List of groups to render as pills. |
| `cameraRef` | `RefObject<Camera>` | From `core.cameraRef`. Used to track camera position. |
| `groupCentersRef` | `RefObject<Map<string, { x: number; y: number }>>` | From `core.groupCentersRef`. Maps group keys to world positions. |
| `onSelect` | `(key: string) => void` | Called when a pill is clicked — typically `core.navigateToGroup`. |
| `trackStyle` | `React.CSSProperties` | Optional styles for the scrollable track container. |
| `buttonStyle` | `React.CSSProperties` | Optional styles applied to every pill button. |
| `buttonActiveStyle` | `React.CSSProperties` | Optional extra styles applied to the active pill (merged with `buttonStyle`). |

## Custom item renderer

`createImageRenderer` is a convenience wrapper. You can pass any draw function instead:

```tsx
import type { RenderItem } from 'gallery-universe'

function renderItem(ctx: CanvasRenderingContext2D, item: RenderItem<Track>, isSelected: boolean) {
  const { screenX, screenY, screenSize } = item

  ctx.fillStyle = isSelected ? '#1db954' : '#333'
  ctx.beginPath()
  ctx.arc(screenX, screenY, screenSize / 2, 0, Math.PI * 2)
  ctx.fill()

  if (screenSize > 30) {
    ctx.fillStyle = '#fff'
    ctx.font = `${Math.round(screenSize * 0.2)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(item.data.title, screenX, screenY + screenSize / 2 + 14)
  }
}
```

## API

### `useUniverseCore(options)`

The main hook. Returns a `core` object to pass to `UniverseCanvas`.

| Option | Type | Description |
|---|---|---|
| `items` | `UniverseItem<T>[]` | Items to display. Create with `createItems`. |
| `onItemClick` | `(item) => void` | Fired on click or tap. |
| `onItemDoubleClick` | `(item) => void` | Fired on double-click or double-tap. |

**core object:**

| Property / Method | Description |
|---|---|
| `setGroupBy(fn)` | Group items by a string key. Pass `null` to return to scatter. |
| `navigateToGroup(key)` | Smooth camera pan to the named cluster. |
| `cameraRef` | `RefObject<Camera>` — live camera state. Pass to `CategoryNav`. |
| `groupCentersRef` | `RefObject<Map<string, { x: number; y: number }>>` — world-space center per group. Pass to `CategoryNav`. |

### `createItems(count, getData)`

Generates `count` items distributed in a 3D sphere. `getData(index)` returns your custom data for each item.

### `createImageRenderer(urlKey)`

Returns a canvas draw function that renders images from `item.data[urlKey]`. Shows a placeholder while loading and a green border when selected.

### `UniverseCanvas`

| Prop | Type | Default | Description |
|---|---|---|---|
| `core` | `UniverseCoreExtended<T>` | — | From `useUniverseCore`. |
| `width` | `number` | — | Canvas width in pixels. |
| `height` | `number` | — | Canvas height in pixels. |
| `renderItem` | `(ctx, item, isSelected) => void` | — | Draw function called per visible item per frame. |
| `groupBy` | `(item) => string \| null` | `null` | Used to render cluster labels on canvas. Should match the fn passed to `setGroupBy`. |
| `clusterLabelPosition` | `'up' \| 'down' \| 'center'` | `'up'` | Vertical position of cluster labels relative to the cluster center. |
