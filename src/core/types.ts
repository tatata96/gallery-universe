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
  handleItemClick: (item: UniverseItem<T>) => void
  handleItemDoubleClick: (item: UniverseItem<T>) => void
  canvasHandlers: {
    onPointerDown: (e: PointerEvent) => void
    onPointerMove: (e: PointerEvent) => void
    onPointerUp: (e: PointerEvent) => void
    onWheel: (e: WheelEvent) => void
    onTouchStart: (e: TouchEvent) => void
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
    onDoubleClick: (e: MouseEvent) => void
  }
}
