import type { UniverseItem } from './types'
import type { ContentBounds } from './camera'

export interface AnimationState {
  [id: string]: {
    currentX: number; targetX: number
    currentY: number; targetY: number
    currentZ: number; targetZ: number
  }
}

export const GROUP_Z = 1000
const CLUSTER_PADDING = 200
const CELL_SIZE = 70
const LERP_FACTOR = 0.15 // per frame: 15% toward target (~38 frames to converge to within 0.5 units)
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // ≈ 137.5° — Fibonacci sunflower angle

function clusterRadius(itemCount: number): number {
  return CELL_SIZE * Math.sqrt(itemCount)
}

/**
 * Compute cluster center x positions along the x axis, sorted alphabetically.
 * Spacing is dynamic: adjacent clusters are separated by the sum of their radii plus padding.
 * Exported so core/index.ts can use the same formula for navigateToGroup.
 */
export function clusterCenters(
  groupKeys: string[],
  groupSizes?: Map<string, number>,
): Map<string, { x: number; y: number }> {
  const sorted = [...groupKeys].sort()
  const centers = new Map<string, { x: number; y: number }>()

  if (sorted.length === 0) return centers

  const radii = sorted.map((key) => clusterRadius(groupSizes?.get(key) ?? 1))

  const positions: number[] = [0]
  for (let i = 1; i < sorted.length; i++) {
    positions.push(positions[i - 1] + radii[i - 1] + radii[i] + CLUSTER_PADDING)
  }

  const mid = (positions[0] + positions[positions.length - 1]) / 2
  sorted.forEach((key, i) => {
    centers.set(key, { x: positions[i] - mid, y: 0 })
  })

  return centers
}

/**
 * Compute target x/y/z for each item.
 * Scatter: original x/y/z.
 * Grouped: grid position within cluster center + GROUP_Z.
 */
export function computeClusterTargets<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): Record<string, { x: number; y: number; z: number }> {
  if (!groupBy) {
    return Object.fromEntries(items.map((item) => [item.id, { x: item.x, y: item.y, z: item.z }]))
  }

  const itemKeys = items.map((item) => ({ item, key: groupBy(item) }))
  const groupKeys = [...new Set(itemKeys.map((e) => e.key))]

  const groupSizes = new Map<string, number>()
  for (const { key } of itemKeys) groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1)

  const centers = clusterCenters(groupKeys, groupSizes)

  // Group items by key, sorted by id for determinism
  const byKey = new Map<string, UniverseItem<T>[]>()
  for (const { item, key } of itemKeys) {
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(item)
  }
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.id.localeCompare(b.id))
  }

  const result: Record<string, { x: number; y: number; z: number }> = {}
  for (const [key, groupItems] of byKey) {
    const center = centers.get(key)!
    groupItems.forEach((item, idx) => {
      const radius = CELL_SIZE * Math.sqrt(idx + 0.5)
      const angle = idx * GOLDEN_ANGLE
      result[item.id] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        z: GROUP_Z,
      }
    })
  }
  return result
}

const SCATTER_RADIUS = 1400
const SCATTER_CENTER_Z = 1000

export function computeContentBounds<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
  groupBy: ((item: UniverseItem<T>) => string) | null,
): ContentBounds {
  if (!groupBy) {
    return { xMin: -SCATTER_RADIUS, xMax: SCATTER_RADIUS, yMin: -SCATTER_RADIUS, yMax: SCATTER_RADIUS, z: SCATTER_CENTER_Z }
  }

  const byKey = new Map<string, number>()
  for (const item of items) {
    const key = groupBy(item)
    byKey.set(key, (byKey.get(key) ?? 0) + 1)
  }
  const centers = clusterCenters([...byKey.keys()], byKey)
  const xs = [...centers.entries()].map(([key, c]) => {
    const r = clusterRadius(byKey.get(key)!)
    return { xMin: c.x - r, xMax: c.x + r, r }
  })
  const maxR = Math.max(...xs.map((e) => e.r))

  return {
    xMin: Math.min(...xs.map((e) => e.xMin)),
    xMax: Math.max(...xs.map((e) => e.xMax)),
    yMin: -maxR,
    yMax: maxR,
    z: GROUP_Z,
  }
}

/**
 * Generate `count` UniverseItems arranged in a uniform sphere distribution.
 * The caller only supplies the per-item data; positions and ids are handled here.
 */
export function createItems<T extends Record<string, unknown>>(
  count: number,
  getData: (index: number) => T,
  options?: { radius?: number; centerZ?: number },
): import('./types').UniverseItem<T>[] {
  const radius = options?.radius ?? SCATTER_RADIUS
  const centerZ = options?.centerZ ?? SCATTER_CENTER_Z
  return Array.from({ length: count }, (_, i) => {
    const u1 = ((i * 2654435761) % 1000) / 1000
    const u2 = ((i * 1140671485) % 1000) / 1000
    const u3 = ((i * 374761393) % 1000) / 1000
    const r = radius * Math.cbrt(u1)
    const phi = Math.acos(1 - 2 * u2)
    const theta = u3 * Math.PI * 2
    return {
      id: `item-${i}`,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: centerZ + r * Math.cos(phi),
      data: getData(i),
    }
  })
}

/** Build initial animation state from items (current = original position) */
export function initAnimationState<T extends Record<string, unknown>>(
  items: UniverseItem<T>[],
): AnimationState {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        currentX: item.x, targetX: item.x,
        currentY: item.y, targetY: item.y,
        currentZ: item.z, targetZ: item.z,
      },
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
      targetX: s.targetX,
      currentY: s.currentY + (s.targetY - s.currentY) * LERP_FACTOR,
      targetY: s.targetY,
      currentZ: s.currentZ + (s.targetZ - s.currentZ) * LERP_FACTOR,
      targetZ: s.targetZ,
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

  for (const id in state) {
    const t = targets[id] ?? { x: state[id].currentX, y: state[id].currentY, z: state[id].currentZ }
    next[id] = { ...state[id], targetX: t.x, targetY: t.y, targetZ: t.z }
  }

  for (const item of items) {
    if (!(item.id in next)) {
      const t = targets[item.id] ?? { x: item.x, y: item.y, z: item.z }
      next[item.id] = {
        currentX: item.x, targetX: t.x,
        currentY: item.y, targetY: t.y,
        currentZ: item.z, targetZ: t.z,
      }
    }
  }
  return next
}
