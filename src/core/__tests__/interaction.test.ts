import { describe, it, expect } from 'vitest'
import {
  hitTest,
  isClick,
  isDoubleTap,
  type PointerState,
} from '../interaction'
import type { RenderItem } from '../types'

const makeRenderItem = (screenX: number, screenY: number, screenSize: number): RenderItem<Record<string, unknown>> => ({
  id: 'x',
  x: 0, y: 0, z: 100,
  data: {},
  screenX,
  screenY,
  screenSize,
})

describe('hitTest', () => {
  it('returns item when pointer is inside its bounding box', () => {
    const items = [makeRenderItem(100, 100, 40)]
    expect(hitTest(items, 105, 105)).toBe(items[0])
  })

  it('returns null when pointer is outside all items', () => {
    const items = [makeRenderItem(100, 100, 40)]
    expect(hitTest(items, 200, 200)).toBeNull()
  })

  it('returns the topmost (last in array = closest) item when overlapping', () => {
    const back = makeRenderItem(100, 100, 40)
    const front = { ...makeRenderItem(100, 100, 40), id: 'front' }
    expect(hitTest([back, front], 100, 100)).toBe(front)
  })
})

describe('isClick', () => {
  it('returns true for small movement under 300ms', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 100,
      isDragging: false,
    }
    expect(isClick(state, 12, 11)).toBe(true)
  })

  it('returns false when pointer moved more than 4px', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 100,
      isDragging: false,
    }
    expect(isClick(state, 20, 10)).toBe(false)
  })

  it('returns false when more than 300ms elapsed', () => {
    const state: PointerState = {
      downX: 10,
      downY: 10,
      downTime: Date.now() - 400,
      isDragging: false,
    }
    expect(isClick(state, 11, 10)).toBe(false)
  })
})

describe('isDoubleTap', () => {
  it('returns true when two taps within 300ms', () => {
    const lastTap = Date.now() - 200
    expect(isDoubleTap(lastTap)).toBe(true)
  })

  it('returns false when taps are too far apart', () => {
    const lastTap = Date.now() - 400
    expect(isDoubleTap(lastTap)).toBe(false)
  })
})
