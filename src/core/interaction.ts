import type { RenderItem } from './types'

export interface PointerState {
  downX: number
  downY: number
  downTime: number
  isDragging: boolean
}

const CLICK_DISTANCE_PX = 4
const CLICK_TIME_MS = 300
const DOUBLE_TAP_MS = 300

/**
 * Find the topmost item at screen coordinates (x, y).
 * items is assumed sorted back-to-front, so we reverse-iterate
 * to find the frontmost hit first.
 */
export function hitTest<T extends Record<string, unknown>>(
  items: RenderItem<T>[],
  x: number,
  y: number,
): RenderItem<T> | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    const half = item.screenSize / 2
    if (
      x >= item.screenX - half &&
      x <= item.screenX + half &&
      y >= item.screenY - half &&
      y <= item.screenY + half
    ) {
      return item
    }
  }
  return null
}

/** Returns true if the pointer-up event qualifies as a click (not a drag). */
export function isClick(state: PointerState, upX: number, upY: number): boolean {
  const dx = upX - state.downX
  const dy = upY - state.downY
  const dist = Math.sqrt(dx * dx + dy * dy)
  const elapsed = Date.now() - state.downTime
  return dist < CLICK_DISTANCE_PX && elapsed < CLICK_TIME_MS
}

/** Returns true if the current tap follows a previous tap within the double-tap threshold. */
export function isDoubleTap(lastTapTime: number): boolean {
  return Date.now() - lastTapTime < DOUBLE_TAP_MS
}
