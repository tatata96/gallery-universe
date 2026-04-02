import type { UniverseItem } from './types'

export interface AnimationState {
  [id: string]: { currentX: number; currentY: number; targetX: number; targetY: number }
}

const CLUSTER_RADIUS = 600
const ITEM_SPREAD = 80
const LERP_FACTOR = 0.1  // per frame: 10% toward target (~60 frames to converge to within 0.5 units)

/** Simple seeded hash so offsets are deterministic per item id */
function hashId(id: string): number {
  let h = 2166136261 // FNV-1a offset basis
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619) // FNV prime
    h = h >>> 0 // keep unsigned 32-bit
  }
  // xorshift finalizer for better avalanche
  h ^= h >>> 16
  h = Math.imul(h, 0x45d9f3b) >>> 0
  h ^= h >>> 16
  return h / 0x100000000
}

/**
 * Deterministic radial cluster center layout.
 * Groups are sorted by key, then evenly distributed around a circle.
 */
function clusterCenters(groupKeys: string[]): Map<string, { x: number; y: number }> {
  const sorted = [...groupKeys].sort()
  const count = sorted.length
  const centers = new Map<string, { x: number; y: number }>()
  sorted.forEach((key, i) => {
    const angle = (2 * Math.PI * i) / count
    centers.set(key, {
      x: Math.cos(angle) * CLUSTER_RADIUS,
      y: Math.sin(angle) * CLUSTER_RADIUS,
    })
  })
  return centers
}

/**
 * Compute target x/y for each item.
 * If groupBy is null, targets are the item's original x/y.
 * Otherwise, targets are the cluster center + a small deterministic offset.
 */
export function computeClusterTargets<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): Record<string, { x: number; y: number }> {
  if (!groupBy) {
    return Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y }]))
  }

  const itemKeys = items.map((item) => ({ item, key: groupBy(item) }))
  const groupKeys = [...new Set(itemKeys.map((e) => e.key))]
  const centers = clusterCenters(groupKeys)

  return Object.fromEntries(
    itemKeys.map(({ item, key }) => {
      const center = centers.get(key)!
      const seed = hashId(item.id)
      const angle = seed * 2 * Math.PI
      const radius = hashId(item.id + 'r') * ITEM_SPREAD
      return [
        item.id,
        {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        },
      ]
    }),
  )
}

/** Build initial animation state from items (current = original position) */
export function initAnimationState<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
): AnimationState {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      { currentX: item.x, currentY: item.y, targetX: item.x, targetY: item.y },
    ]),
  )
}

/** Apply one lerp step to every item. Returns a new state object. */
export function stepAnimation(state: AnimationState): AnimationState {
  const next: AnimationState = {}
  for (const id in state) {
    const s = state[id]
    next[id] = {
      currentX: s.currentX + (s.targetX - s.currentX) * LERP_FACTOR,
      currentY: s.currentY + (s.targetY - s.currentY) * LERP_FACTOR,
      targetX: s.targetX,
      targetY: s.targetY,
    }
  }
  return next
}

/** Update all target positions (called when groupBy changes) */
export function updateTargets<T extends Record<string, unknown>>(
  state: AnimationState,
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): AnimationState {
  const targets = computeClusterTargets(items, groupBy)
  const next: AnimationState = {}
  // Update existing items
  for (const id in state) {
    const t = targets[id] ?? { x: state[id].currentX, y: state[id].currentY }
    next[id] = { ...state[id], targetX: t.x, targetY: t.y }
  }
  // Add new items not yet in state (use their world position as starting point)
  for (const item of items) {
    if (!(item.id in next)) {
      const t = targets[item.id] ?? { x: item.x, y: item.y }
      next[item.id] = { currentX: item.x, currentY: item.y, targetX: t.x, targetY: t.y }
    }
  }
  return next
}
