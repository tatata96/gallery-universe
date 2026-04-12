import { describe, it, expect } from 'vitest'
import {
  computeClusterTargets,
  stepAnimation,
  initAnimationState,
  updateTargets,
  GROUP_Z,
  type AnimationState,
} from '../layout'
import type { UniverseItem } from '../types'

const items: UniverseItem<{ genre: string }>[] = [
  { id: 'a', x: 0, y: 0, z: 100, data: { genre: 'rock' } },
  { id: 'b', x: 50, y: 50, z: 200, data: { genre: 'jazz' } },
  { id: 'c', x: -50, y: 20, z: 150, data: { genre: 'rock' } },
]

describe('computeClusterTargets', () => {
  it('returns original positions and z when groupBy is null', () => {
    const targets = computeClusterTargets(items, null)
    expect(targets['a']).toEqual({ x: 0, y: 0, z: 100 })
    expect(targets['b']).toEqual({ x: 50, y: 50, z: 200 })
    expect(targets['c']).toEqual({ x: -50, y: 20, z: 150 })
  })

  it('sets z to GROUP_Z for all grouped items', () => {
    const targets = computeClusterTargets(items, (item) => item.data.genre)
    expect(targets['a'].z).toBe(GROUP_Z)
    expect(targets['b'].z).toBe(GROUP_Z)
    expect(targets['c'].z).toBe(GROUP_Z)
  })

  it('groups items near their cluster center', () => {
    const targets = computeClusterTargets(items, (item) => item.data.genre)
    const rockA = targets['a']
    const rockC = targets['c']
    const jazz = targets['b']
    // rock items should be near each other (within one grid)
    expect(Math.abs(rockA.x - rockC.x)).toBeLessThan(500)
    expect(Math.abs(rockA.y - rockC.y)).toBeLessThan(500)
    // jazz center should differ from rock center
    const rockCenterX = (rockA.x + rockC.x) / 2
    expect(Math.abs(jazz.x - rockCenterX)).toBeGreaterThan(100)
  })

  it('is deterministic — same result on repeated calls', () => {
    const a = computeClusterTargets(items, (item) => item.data.genre)
    const b = computeClusterTargets(items, (item) => item.data.genre)
    expect(a).toEqual(b)
  })

  it('no two items in the same group overlap (distance >= CELL_SIZE)', () => {
    const targets = computeClusterTargets(items, (item) => item.data.genre)
    const rockA = targets['a']
    const rockC = targets['c']
    const dx = rockA.x - rockC.x
    const dy = rockA.y - rockC.y
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(70)
  })
})

describe('stepAnimation', () => {
  it('moves current position toward target (x, y, z)', () => {
    const state: AnimationState = {
      a: { currentX: 0, currentY: 0, currentZ: 0, targetX: 100, targetY: 100, targetZ: 500 },
    }
    const next = stepAnimation(state)
    expect(next['a'].currentX).toBeGreaterThan(0)
    expect(next['a'].currentX).toBeLessThan(100)
    expect(next['a'].currentZ).toBeGreaterThan(0)
    expect(next['a'].currentZ).toBeLessThan(500)
  })

  it('converges to target within 60 frames', () => {
    let state: AnimationState = {
      a: { currentX: 0, currentY: 0, currentZ: 0, targetX: 100, targetY: 100, targetZ: 500 },
    }
    for (let i = 0; i < 60; i++) state = stepAnimation(state)
    expect(state['a'].currentX).toBeCloseTo(100, 0)
    expect(state['a'].currentY).toBeCloseTo(100, 0)
    expect(state['a'].currentZ).toBeCloseTo(500, 0)
  })
})

describe('initAnimationState', () => {
  it('sets current and target to item x/y/z', () => {
    const state = initAnimationState(items)
    expect(state['a']).toEqual({ currentX: 0, currentY: 0, currentZ: 100, targetX: 0, targetY: 0, targetZ: 100 })
    expect(state['b']).toEqual({ currentX: 50, currentY: 50, currentZ: 200, targetX: 50, targetY: 50, targetZ: 200 })
  })
})

describe('updateTargets', () => {
  it('updates targets (including z) when groupBy changes', () => {
    const state = initAnimationState(items)
    const updated = updateTargets(state, items, (item) => item.data.genre)
    expect(updated['a'].targetX).not.toBe(0)
    expect(updated['a'].targetZ).toBe(GROUP_Z)
  })

  it('restores original z when returning to scatter', () => {
    const state = initAnimationState(items)
    const grouped = updateTargets(state, items, (item) => item.data.genre)
    const scatter = updateTargets(grouped, items, null)
    expect(scatter['a'].targetZ).toBe(100)
    expect(scatter['b'].targetZ).toBe(200)
  })

  it('adds new items not present in state', () => {
    const state = initAnimationState(items)
    const newItems = [
      ...items,
      { id: 'new', x: 100, y: 200, z: 300, data: { genre: 'blues' } },
    ]
    const updated = updateTargets(state, newItems, null)
    expect(updated['new']).toBeDefined()
    expect(updated['new'].currentX).toBe(100)
    expect(updated['new'].currentY).toBe(200)
    expect(updated['new'].currentZ).toBe(300)
  })

  it('preserves current positions while updating targets', () => {
    let state = initAnimationState(items)
    for (let i = 0; i < 5; i++) {
      state = updateTargets(state, items, (item) => item.data.genre)
      state = stepAnimation(state)
    }
    const reset = updateTargets(state, items, null)
    expect(reset['a'].targetX).toBe(0)
    expect(reset['a'].targetY).toBe(0)
    expect(reset['a'].targetZ).toBe(100)
    expect(reset['a'].currentX).toBe(state['a'].currentX)
  })
})
