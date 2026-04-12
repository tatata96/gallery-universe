import { useState } from 'react'
import { useUniverseCore, UniverseCanvas, createItems, createImageRenderer } from './index'

type ArtPiece = {
  title: string
  movement: string
  imageUrl: string
}

const movements = ['Impressionism', 'Cubism', 'Surrealism', 'Abstract', 'Baroque']

const ITEMS = createItems(500, (i) => ({
  title: `Artwork ${i}`,
  movement: movements[i % movements.length],
  imageUrl: `https://picsum.photos/seed/${i}/800/800`,
}))
const ALL_MOVEMENTS = [...new Set(ITEMS.map((item) => item.data.movement))].sort()

const renderItem = createImageRenderer<ArtPiece>('imageUrl')

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
