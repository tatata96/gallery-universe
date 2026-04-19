import { useEffect, useRef } from 'react'
import type { RenderItem, UniverseCore, UniverseItem } from '../core/types'
import { drawFrame } from './draw'
import { hitTest } from '../core/interaction'

interface UniverseCanvasProps<T extends Record<string, unknown>> {
  core: UniverseCore<T> & {
    stepAnimationFrame: (width: number, height: number) => RenderItem<T>[]
    handleItemClick: (item: UniverseItem<T>) => void
    handleItemDoubleClick: (item: UniverseItem<T>) => void
    prevTapWasClick: { current: boolean }
  }
  width: number
  height: number
  renderItem: (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void
  groupBy?: ((item: RenderItem<T>) => string) | null
  clusterLabelPosition?: 'up' | 'down' | 'center'
}

export function UniverseCanvas<T extends Record<string, unknown>>({
  core,
  width,
  height,
  renderItem,
  groupBy = null,
  clusterLabelPosition = 'up',
}: UniverseCanvasProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const renderItemsRef = useRef<RenderItem<T>[]>([])

  // rAF loop — draw every frame
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function loop() {
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
        clusterLabelPosition,
        renderItem: renderItem as (ctx: CanvasRenderingContext2D, item: RenderItem<Record<string, unknown>>, isSelected: boolean) => void,
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [core, width, height, renderItem, groupBy])

  // Attach native DOM event listeners (canvasHandlers use native DOM types)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd } = core.canvasHandlers

    // Pointer up: resolve hit before clearing pointer state
    const handlePointerUp = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      onPointerUp(e)
      const hit = hitTest(renderItemsRef.current, x, y)
      if (hit) core.handleItemClick(hit)
    }

    // Double-click: resolve hit
    const handleDoubleClick = (e: MouseEvent) => {
      core.canvasHandlers.onDoubleClick(e)
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const hit = hitTest(renderItemsRef.current, x, y)
      if (hit) core.handleItemDoubleClick(hit)
    }

    // Touch-end: resolve hit, distinguish tap vs double-tap
    const handleTouchEnd = (e: TouchEvent) => {
      onTouchEnd(e)
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0]
        const rect = canvas.getBoundingClientRect()
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
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('dblclick', handleDoubleClick)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [core, groupBy, renderItem, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', touchAction: 'none' }}
    />
  )
}
