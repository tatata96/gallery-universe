import { useState } from 'react'
import { useUniverseCore, UniverseCanvas, createItems, createImageRenderer } from './index'
import { CategoryNav } from './components/CategoryNav/CategoryNav'

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

const GROUP_COUNTS = ALL_MOVEMENTS.map((movement) => ({
  key: movement,
  count: ITEMS.filter((item) => item.data.movement === movement).length,
}))

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
        <CategoryNav
          groups={GROUP_COUNTS}
          cameraRef={core.cameraRef}
          groupCentersRef={core.groupCentersRef}
          onSelect={core.navigateToGroup}
        />
      )}
    </div>
  )
}
