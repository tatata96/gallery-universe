import type { RenderItem } from '../core/types'

interface DrawFrameOptions<T extends Record<string, unknown>> {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  renderItems: RenderItem<T>[]
  selectedId: string | null
  groupBy: ((item: RenderItem<T>) => string) | null
  clusterLabelPosition?: 'up' | 'down' | 'center'
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
}

export function drawFrame<T extends Record<string, unknown>>(
  options: DrawFrameOptions<T>,
): void {
  const { ctx, width, height, renderItems, selectedId, groupBy, clusterLabelPosition = 'up', renderItem } = options

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

    ctx.font = 'bold 16px '
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.textAlign = 'center'

    const labelYOffset = clusterLabelPosition === 'up' ? -240 : clusterLabelPosition === 'down' ? 240 : 0

    for (const [key, center] of centers) {
      if (seen.has(key)) continue
      seen.add(key)
      ctx.fillText(key, center.x / center.count, center.y / center.count + labelYOffset)
    }
  }
}
