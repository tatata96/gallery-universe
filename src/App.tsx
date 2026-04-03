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
  return Array.from({ length: 500 }, (_, i) => ({
    id: `item-${i}`,
    x: Math.sin(i * 0.37) * 2000,
    y: Math.cos(i * 0.53) * 2000,
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
    core.setGroupBy(field ? (item) => item.data.movement : null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#f0f0f0' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
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
    </div>
  )
}
