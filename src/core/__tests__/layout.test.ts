import { describe, it, expect } from 'vitest'
import {
  computeClusterTargets,
  stepAnimation,
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
