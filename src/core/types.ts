import type React from 'react'

export interface Camera {
  x: number
  y: number
  z: number
}

export interface UniverseItem<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  x: number
  y: number
  z: number
  data: T
}

export interface RenderItem<T extends Record<string, unknown> = Record<string, unknown>>
  extends UniverseItem<T> {
  screenX: number
  screenY: number
  screenSize: number
}

export interface UniverseCore<T extends Record<string, unknown> = Record<string, unknown>> {
  renderItems: RenderItem<T>[]
  camera: Camera
  selectedId: string | null
  setGroupBy: (fn: ((item: UniverseItem<T>) => string) | null) => void
  canvasHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void
    onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void
    onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void
    onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void
  }
}
