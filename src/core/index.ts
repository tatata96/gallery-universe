import { useCallback, useRef, useState } from 'react'
import type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'
import { projectItem, panCamera, zoomCamera } from './camera'
import {
  initAnimationState,
  stepAnimation,
  updateTargets,
  type AnimationState,
} from './layout'
import { isClick, isDoubleTap, type PointerState } from './interaction'

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
  prevTapWasClick: { current: boolean }
} {
  const { items, onItemClick, onItemDoubleClick } = options

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const animRef = useRef<AnimationState>(initAnimationState(items))
  const pointerRef = useRef<PointerState | null>(null)
  const lastTapRef = useRef<number>(0)
  const prevTapWasClickRef = useRef(false)
  const prevTouchDistRef = useRef<number | null>(null)
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 })

  const deepestItemZ = items.reduce((max, item) => Math.max(max, item.z), 0)

  const setGroupBy = useCallback(
    (fn: ((item: UniverseItem<T>) => string) | null) => {
      animRef.current = updateTargets(animRef.current, items, fn)
    },
    [items],
  )

  const stepAnimationFrame = useCallback(
    (width: number, height: number): RenderItem<T>[] => {
      canvasSizeRef.current = { width, height }
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

      // Sort back-to-front (largest depth first = furthest from camera drawn first)
      projected.sort((a, b) => (b.z - camera.z) - (a.z - camera.z))
      return projected
    },
    [items, camera],
  )

  const handleItemClick = useCallback(
    (item: UniverseItem<T>) => {
      setSelectedId(item.id)
      onItemClick?.(item)
    },
    [onItemClick],
  )

  const handleItemDoubleClick = useCallback(
    (item: UniverseItem<T>) => {
      onItemDoubleClick?.(item)
    },
    [onItemDoubleClick],
  )

  // --- Native DOM event handlers (match types.ts canvasHandlers interface) ---

  const onPointerDown = useCallback((e: PointerEvent) => {
    pointerRef.current = {
      downX: e.clientX,
      downY: e.clientY,
      downTime: Date.now(),
      isDragging: false,
    }
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!pointerRef.current) return
    const dx = e.clientX - pointerRef.current.downX
    const dy = e.clientY - pointerRef.current.downY
    if (Math.sqrt(dx * dx + dy * dy) > 4) {
      pointerRef.current.isDragging = true
    }
    if (pointerRef.current.isDragging) {
      setCamera((c) => panCamera(c, -dx, -dy))
      pointerRef.current = { ...pointerRef.current, downX: e.clientX, downY: e.clientY }
    }
  }, [])

  const onPointerUp = useCallback((_e: PointerEvent) => {
    // Click resolution is handled by the canvas after hit-testing
    pointerRef.current = null
  }, [])

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const target = e.currentTarget as HTMLCanvasElement
      const rect = target.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      setCamera((c) =>
        zoomCamera(c, e.deltaY, cursorX, cursorY, rect.width, rect.height, deepestItemZ),
      )
    },
    [deepestItemZ],
  )

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      pointerRef.current = {
        downX: e.touches[0].clientX,
        downY: e.touches[0].clientY,
        downTime: Date.now(),
        isDragging: false,
      }
      prevTouchDistRef.current = null
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      prevTouchDistRef.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
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
          const target = e.currentTarget as HTMLCanvasElement
          const rect = target.getBoundingClientRect()
          setCamera((c) =>
            zoomCamera(c, delta * 2, mid.x - rect.left, mid.y - rect.top, rect.width, rect.height, deepestItemZ),
          )
        }
        prevTouchDistRef.current = dist
      }
    },
    [deepestItemZ],
  )

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (e.changedTouches.length === 1 && pointerRef.current) {
      const touch = e.changedTouches[0]
      if (isClick(pointerRef.current, touch.clientX, touch.clientY)) {
        prevTapWasClickRef.current = isDoubleTap(lastTapRef.current)
        lastTapRef.current = Date.now()
      }
      pointerRef.current = null
    }
  }, [])

  const onDoubleClick = useCallback((_e: MouseEvent) => {
    // Desktop double-click is resolved by the canvas after hit-testing
  }, [])

  return {
    renderItems: [],
    camera,
    selectedId,
    setGroupBy,
    handleItemClick,
    handleItemDoubleClick,
    prevTapWasClick: prevTapWasClickRef,
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
