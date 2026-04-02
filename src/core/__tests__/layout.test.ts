import { describe, it, expect } from 'vitest'
import {
  computeClusterTargets,
  stepAnimation,
  initAnimationState,
  updateTargets,
  type AnimationState,
} from '../layout'
import type { UniverseItem } from '../types'

const items: UniverseItem<{ genre: string }>[] = [
  { id: 'a', x: 0, y: 0, z: 100, data: { genre: 'rock' } },
  { id: 'b', x: 50, y: 50, z: 200, data: { genre: 'jazz' } },
  { id: 'c', x: -50, y: 20, z: 150, data: { genre: 'rock' } },
]

describe('computeClusterTargets', () => {
  it('returns original positions when groupBy is null', () => {
    const targets = computeClusterTargets(items, null)
    expect(targets['a']).toEqual({ x: 0, y: 0 })
    expect(targets['b']).toEqual({ x: 50, y: 50 })
    expect(targets['c']).toEqual({ x: -50, y: 20 })
  })

  it('groups items near their cluster center', () => {
    const targets = computeClusterTargets(items, (item) => item.data.genre)
    // rock group: items a and c. jazz group: item b.
    const rockA = targets['a']
    const rockC = targets['c']
    const jazz = targets['b']
    // rock items should be near each other (within cluster spread)
    expect(Math.abs(rockA.x - rockC.x)).toBeLessThan(300)
    expect(Math.abs(rockA.y - rockC.y)).toBeLessThan(300)
    // jazz center should differ from rock center
    const rockCenterX = (rockA.x + rockC.x) / 2
    expect(Math.abs(jazz.x - rockCenterX)).toBeGreaterThan(50)
  })

  it('is deterministic — same result on repeated calls', () => {
    const a = computeClusterTargets(items, (item) => item.data.genre)
    const b = computeClusterTargets(items, (item) => item.data.genre)
    expect(a).toEqual(b)
  })
})

describe('stepAnimation', () => {
  it('moves current position toward target', () => {
    const state: AnimationState = {
      a: { currentX: 0, currentY: 0, targetX: 100, targetY: 100 },
    }
    const next = stepAnimation(state)
    expect(next['a'].currentX).toBeGreaterThan(0)
    expect(next['a'].currentX).toBeLessThan(100)
  })

  it('converges to target within 60 frames', () => {
    let state: AnimationState = {
      a: { currentX: 0, currentY: 0, targetX: 100, targetY: 100 },
    }
    for (let i = 0; i < 60; i++) state = stepAnimation(state)
    expect(state['a'].currentX).toBeCloseTo(100, 0)
    expect(state['a'].currentY).toBeCloseTo(100, 0)
  })
})

describe('initAnimationState', () => {
  it('sets current and target to item x/y', () => {
    const state = initAnimationState(items)
    expect(state['a']).toEqual({ currentX: 0, currentY: 0, targetX: 0, targetY: 0 })
    expect(state['b']).toEqual({ currentX: 50, currentY: 50, targetX: 50, targetY: 50 })
  })
})

describe('updateTargets', () => {
  it('updates targets when groupBy changes', () => {
    const state = initAnimationState(items)
    const updated = updateTargets(state, items, (item) => item.data.genre)
    // targets should now be cluster positions, not original positions
    expect(updated['a'].targetX).not.toBe(0)
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
  })

  it('preserves current positions while updating targets', () => {
    let state = initAnimationState(items)
    // animate a few frames so current !== original
    for (let i = 0; i < 5; i++) {
      state = updateTargets(state, items, (item) => item.data.genre)
      state = stepAnimation(state)
    }
    // now reset targets back to scatter
    const reset = updateTargets(state, items, null)
    // current positions should be preserved (mid-animation), targets should go back to original
    expect(reset['a'].targetX).toBe(0)
    expect(reset['a'].targetY).toBe(0)
    // current should NOT have jumped back to 0
    expect(reset['a'].currentX).toBe(state['a'].currentX)
  })
})
