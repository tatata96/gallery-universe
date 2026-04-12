import { useState } from 'react'
import { useUniverseCore, UniverseCanvas, loadImage } from './index'
import type { UniverseItem, RenderItem } from './index'

type ArtPiece = {
  title: string
  movement: string
  imageUrl: string
}

function generateItems(): UniverseItem<ArtPiece>[] {
  const movements = ['Impressionism', 'Cubism', 'Surrealism', 'Abstract', 'Baroque']
  return Array.from({ length: 500 }, (_, i) => {
    // Uniform sphere distribution — looks like a circular cloud from afar,
    // gives depth parallax when zooming in
    const u1 = ((i * 2654435761) % 1000) / 1000
    const u2 = ((i * 1140671485) % 1000) / 1000
    const u3 = ((i * 374761393) % 1000) / 1000
    const r = 1400 * Math.cbrt(u1)
    const phi = Math.acos(1 - 2 * u2)
    const theta = u3 * Math.PI * 2
    return {
      id: `item-${i}`,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: 1000 + r * Math.cos(phi),
      data: {
        title: `Artwork ${i}`,
        movement: movements[i % movements.length],
        imageUrl: `https://picsum.photos/seed/${i}/800/800`,
      },
    }
  })
}

const ITEMS = generateItems()
const ALL_MOVEMENTS = [...new Set(ITEMS.map((item) => item.data.movement))].sort()

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
    core.setGroupBy(field ? (item) => item.data.movement : null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#f0f0f0' }}>
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <button
          onClick={() => handleFilter(null)}
          style={{ fontWeight: activeGroupBy === null ? 'bold' : 'normal' }}
        >
          Scatter
        </button>

        <button
          onClick={() => handleFilter('movement')}
          style={{ fontWeight: activeGroupBy === 'movement' ? 'bold' : 'normal' }}
        >
          By Movement
        </button>
      </div>

      <UniverseCanvas
        core={core}
        width={window.innerWidth}
        height={window.innerHeight}
        renderItem={renderItem}
        groupBy={activeGroupBy ? (item) => item.data.movement : null}
      />

      {activeGroupBy && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '8px 16px',
            background: 'rgba(240,240,240,0.92)',
            zIndex: 10,
          }}
        >
          {ALL_MOVEMENTS.map((movement) => (
            <button
              key={movement}
              onClick={() => core.navigateToGroup(movement)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {movement}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
