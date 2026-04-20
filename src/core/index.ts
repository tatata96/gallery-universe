import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'
import { projectItem, zoomCamera, clampCameraXY, FOCAL_LENGTH, type ContentBounds } from './camera'
import {
  initAnimationState,
  stepAnimation,
  updateTargets,
  clusterCenters,
  computeContentBounds,
  type AnimationState,
} from './layout'

export { createItems } from './layout'
import { isClick, isDoubleTap, type PointerState } from './interaction'

export type { Camera, UniverseItem, RenderItem, UniverseCore } from './types'

interface UseUniverseCoreOptions<T extends Record<string, unknown>> {
  items: UniverseItem<T>[]
  onItemClick?: (item: UniverseItem<T>) => void
  onItemDoubleClick?: (item: UniverseItem<T>) => void
}

export interface UniverseCoreExtended<T extends Record<string, unknown>> extends UniverseCore<T> {
  cameraRef: RefObject<Camera>
  animRef: RefObject<AnimationState>
  groupCentersRef: RefObject<Map<string, { x: number; y: number }>>
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

  const cameraRef = useRef<Camera>({ x: 0, y: 0, z: INITIAL_CAMERA_Z, panX: 0, panY: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setGroupByState] = useState<((item: UniverseItem<T>) => string) | null>(null)

  const animRef = useRef<AnimationState>(initAnimationState(items))
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: window.innerWidth, h: window.innerHeight })
  const contentBoundsRef = useRef<ContentBounds>(computeContentBounds(items, null))
  const pointerRef = useRef<PointerState | null>(null)
  const lastTapRef = useRef<number>(0)
  const prevTapWasClickRef = useRef<boolean>(false)
  const prevTouchDistRef = useRef<number | null>(null)
  const groupCentersRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    return () => {
      gsap.killTweensOf(cameraRef.current)
    }
  }, [])

  const deepestItemZ = items.reduce((max, item) => Math.max(max, item.z), 0)

  const setGroupBy = useCallback(
    (fn: ((item: UniverseItem<T>) => string) | null) => {
      setGroupByState(() => fn)
      animRef.current = updateTargets(animRef.current, items, fn)
      contentBoundsRef.current = computeContentBounds(items, fn)
      if (fn) {
        const keys = [...new Set(items.map(fn))]
        const sizes = new Map<string, number>()
        for (const item of items) sizes.set(fn(item), (sizes.get(fn(item)) ?? 0) + 1)
        groupCentersRef.current = clusterCenters(keys, sizes)
        gsap.killTweensOf(cameraRef.current)
        Object.assign(cameraRef.current, { x: 0, y: 0, z: -2500, panX: 0, panY: 0 })
      } else {
        groupCentersRef.current = new Map()
        gsap.killTweensOf(cameraRef.current)
        Object.assign(cameraRef.current, { x: 0, y: 0, z: INITIAL_CAMERA_Z, panX: 0, panY: 0 })
      }
    },
    [items],
  )

  const navigateToGroup = useCallback((key: string) => {
    const center = groupCentersRef.current.get(key)
    if (!center) return
    gsap.to(cameraRef.current, {
      x: center.x,
      y: center.y,
      duration: 0.6,
      ease: 'power3.inOut',
      overwrite: 'auto',
    })
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

  function applyClamp() {
    const { w, h } = canvasSizeRef.current
    const clamped = clampCameraXY(cameraRef.current, contentBoundsRef.current, w, h)
    cameraRef.current.x = clamped.x
    cameraRef.current.y = clamped.y
  }

  /** Called each rAF frame by the renderer. Steps animation and returns projected, culled, sorted items. */
  const stepAnimationFrame = useCallback(
    (width: number, height: number): RenderItem<T>[] => {
      canvasSizeRef.current.w = width
      canvasSizeRef.current.h = height
      animRef.current = stepAnimation(animRef.current)
      const cam = cameraRef.current

      const projected: RenderItem<T>[] = []
      for (const item of items) {
        const anim = animRef.current[item.id]
        const withAnim: UniverseItem<T> = anim
          ? { ...item, x: anim.currentX, y: anim.currentY, z: anim.currentZ }
          : item
        const rendered = projectItem(withAnim, cam, width, height)
        if (rendered) projected.push(rendered)
      }

      // Sort back-to-front: items with larger depth (further from camera) drawn first
      projected.sort((a, b) => (b.z - cam.z) - (a.z - cam.z))
      return projected
    },
    [items],
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
      gsap.killTweensOf(cameraRef.current, 'x,y')
      const depth = contentBoundsRef.current.z - cameraRef.current.z
      if (depth > 0) {
        cameraRef.current.x -= dx * depth / FOCAL_LENGTH
        cameraRef.current.y -= dy * depth / FOCAL_LENGTH
        applyClamp()
      }
      pointerRef.current = { ...pointerRef.current, downX: e.clientX, downY: e.clientY }
    }
  }

  function onPointerUp() {
    pointerRef.current = null
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const target = e.currentTarget as HTMLCanvasElement
    const rect = target.getBoundingClientRect()

    if (e.ctrlKey) {
      // Pinch-to-zoom (trackpad pinch or Ctrl+scroll)
      const clampedDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 15)
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const zoomed = zoomCamera(cameraRef.current, clampedDelta, cursorX, cursorY, rect.width, rect.height, deepestItemZ)
      gsap.killTweensOf(cameraRef.current, 'x,y,z')
      Object.assign(cameraRef.current, { x: zoomed.x, y: zoomed.y, z: zoomed.z })
    } else {
      // Two-finger trackpad pan — convert screen delta to world space
      gsap.killTweensOf(cameraRef.current, 'x,y')
      const depth = contentBoundsRef.current.z - cameraRef.current.z
      if (depth > 0) {
        cameraRef.current.x += e.deltaX * depth / FOCAL_LENGTH
        cameraRef.current.y += e.deltaY * depth / FOCAL_LENGTH
        applyClamp()
      }
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
      gsap.killTweensOf(cameraRef.current, 'x,y')
      const depth = contentBoundsRef.current.z - cameraRef.current.z
      if (depth > 0) {
        cameraRef.current.x -= dx * depth / FOCAL_LENGTH
        cameraRef.current.y -= dy * depth / FOCAL_LENGTH
        applyClamp()
      }
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
        const touchTarget = e.currentTarget as HTMLCanvasElement
        const rect = touchTarget.getBoundingClientRect()
        const pinchTarget = zoomCamera(cameraRef.current, clampedDelta, midX - rect.left, midY - rect.top, rect.width, rect.height, deepestItemZ)
        gsap.to(cameraRef.current, {
          x: pinchTarget.x,
          y: pinchTarget.y,
          z: pinchTarget.z,
          duration: 0.15,
          ease: 'power2.out',
          overwrite: 'auto',
        })
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

  function onDoubleClick() {
    // desktop double-click resolved by canvas via handleItemDoubleClick
  }

  return {
    renderItems: [],
    cameraRef,
    animRef,
    groupCentersRef,
    selectedId,
    setGroupBy,
    navigateToGroup,
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
