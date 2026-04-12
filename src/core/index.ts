import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'
import { projectItem, panCamera, zoomCamera, FOCAL_LENGTH } from './camera'
import {
  initAnimationState,
  stepAnimation,
  updateTargets,
  clusterCenters,
  GROUP_Z,
  type AnimationState,
} from './layout'
import { isClick, isDoubleTap, type PointerState } from './interaction'

export type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'

interface UseUniverseCoreOptions<T extends Record<string, unknown>> {
  items: UniverseItem<T>[]
  onItemClick?: (item: UniverseItem<T>) => void
  onItemDoubleClick?: (item: UniverseItem<T>) => void
}

export interface UniverseCoreExtended<T extends Record<string, unknown>> extends UniverseCore<T> {
  animationState: AnimationState
  stepAnimationFrame: (width: number, height: number) => RenderItem<T>[]
  handleItemClick: (item: UniverseItem<T>) => void
  handleItemDoubleClick: (item: UniverseItem<T>) => void
  prevTapWasClick: RefObject<boolean>
}

const INITIAL_CAMERA_Z = -2000

export function useUniverseCore<T extends Record<string, unknown>>(
  options: UseUniverseCoreOptions<T>,
): UniverseCoreExtended<T> {
  const { items, onItemClick, onItemDoubleClick } = options

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: INITIAL_CAMERA_Z, panX: 0, panY: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setGroupByState] = useState<((item: UniverseItem<T>) => string) | null>(null)

  const animRef = useRef<AnimationState>(initAnimationState(items))
  const pointerRef = useRef<PointerState | null>(null)
  const lastTapRef = useRef<number>(0)
  const prevTapWasClickRef = useRef<boolean>(false)
  const prevTouchDistRef = useRef<number | null>(null)
  const groupCentersRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const pendingNavGroupRef = useRef<string | null>(null)

  const deepestItemZ = items.reduce((max, item) => Math.max(max, item.z), 0)

  const setGroupBy = useCallback(
    (fn: ((item: UniverseItem<T>) => string) | null) => {
      pendingNavGroupRef.current = null
      setGroupByState(() => fn)
      animRef.current = updateTargets(animRef.current, items, fn)
      if (fn) {
        // Key extraction must stay consistent with computeClusterTargets in layout.ts
        const keys = [...new Set(items.map(fn))]
        groupCentersRef.current = clusterCenters(keys)
        setCamera({ x: 0, y: 0, z: -2500, panX: 0, panY: 0 })
      } else {
        groupCentersRef.current = new Map()
        setCamera({ x: 0, y: 0, z: INITIAL_CAMERA_Z, panX: 0, panY: 0 })
      }
    },
    [items],
  )

  // Queues a smooth camera pan to center the given group on screen.
  const navigateToGroup = useCallback((key: string) => {
    if (groupCentersRef.current.has(key)) {
      pendingNavGroupRef.current = key
    }
  }, [])

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

  /** Called each rAF frame by the renderer. Steps animation and returns projected, culled, sorted items. */
  const stepAnimationFrame = useCallback(
    (width: number, height: number): RenderItem<T>[] => {
      animRef.current = stepAnimation(animRef.current)

      // Smoothly pan camera toward the pending navigation target
      if (pendingNavGroupRef.current) {
        const center = groupCentersRef.current.get(pendingNavGroupRef.current)
        if (center) {
          const depth = GROUP_Z - camera.z
          if (depth > 0) {
            const perspective = FOCAL_LENGTH / depth
            const targetPanX = -(center.x - camera.x) * perspective
            const targetPanY = -(center.y - camera.y) * perspective
            const nextPanX = camera.panX + (targetPanX - camera.panX) * 0.08
            const nextPanY = camera.panY + (targetPanY - camera.panY) * 0.08
            if (Math.abs(nextPanX - targetPanX) < 0.5 && Math.abs(nextPanY - targetPanY) < 0.5) {
              pendingNavGroupRef.current = null
              setCamera((c) => ({ ...c, panX: targetPanX, panY: targetPanY }))
            } else {
              setCamera((c) => ({ ...c, panX: nextPanX, panY: nextPanY }))
            }
          }
        }
      }

      const projected: RenderItem<T>[] = []
      for (const item of items) {
        const anim = animRef.current[item.id]
        const withAnim: UniverseItem<T> = anim
          ? { ...item, x: anim.currentX, y: anim.currentY, z: anim.currentZ }
          : item
        const rendered = projectItem(withAnim, camera, width, height)
        if (rendered) projected.push(rendered)
      }

      // Sort back-to-front: items with larger depth (further from camera) drawn first
      projected.sort((a, b) => (b.z - camera.z) - (a.z - camera.z))
      return projected
    },
    [items, camera],
  )

  function onPointerDown(e: PointerEvent) {
    pointerRef.current = {
      downX: e.clientX,
      downY: e.clientY,
      downTime: Date.now(),
      isDragging: false,
    }
  }

  function onPointerMove(e: PointerEvent) {
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
  }

  function onPointerUp(_e: PointerEvent) {
    pointerRef.current = null
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const target = e.currentTarget as HTMLCanvasElement
    const rect = target.getBoundingClientRect()

    if (e.ctrlKey) {
      // Pinch-to-zoom (trackpad pinch or Ctrl+scroll)
      // Cap per-event delta so a single fast gesture can't slam the camera into the limit
      const clampedDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 15)
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      setCamera((c) => zoomCamera(c, clampedDelta, cursorX, cursorY, rect.width, rect.height, deepestItemZ))
    } else {
      // Two-finger trackpad pan (scroll)
      setCamera((c) => panCamera(c, e.deltaX, e.deltaY))
    }
  }

  function onTouchStart(e: TouchEvent) {
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
  }

  function onTouchMove(e: TouchEvent) {
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
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      if (prevTouchDistRef.current !== null) {
        const rawDelta = prevTouchDistRef.current - dist
        const clampedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta * 2), 15)
        const target = e.currentTarget as HTMLCanvasElement
        const rect = target.getBoundingClientRect()
        setCamera((c) => zoomCamera(c, clampedDelta, midX - rect.left, midY - rect.top, rect.width, rect.height, deepestItemZ))
      }
      prevTouchDistRef.current = dist
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length === 1 && pointerRef.current) {
      const touch = e.changedTouches[0]
      if (isClick(pointerRef.current, touch.clientX, touch.clientY)) {
        prevTapWasClickRef.current = isDoubleTap(lastTapRef.current)
        lastTapRef.current = Date.now()
      }
      pointerRef.current = null
    }
  }

  function onDoubleClick(_e: MouseEvent) {
    // desktop double-click resolved by canvas via handleItemDoubleClick
  }

  return {
    renderItems: [],
    camera,
    selectedId,
    setGroupBy,
    navigateToGroup,
    animationState: animRef.current,
    stepAnimationFrame,
    handleItemClick,
    handleItemDoubleClick,
    prevTapWasClick: prevTapWasClickRef,
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
