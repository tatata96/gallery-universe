import type { Camera, UniverseItem, RenderItem } from './types'

export const FOCAL_LENGTH = 800
export const ITEM_WORLD_SIZE = 50
// Reference z of content planes — used for screen↔world pan conversion.
export const CONTENT_Z = 1000
const CAMERA_Z_MIN = -5000
const CAMERA_Z_BUFFER = 50
const CLAMP_MARGIN = 100

export interface ContentBounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  z: number
}

export function projectItem<T extends Record<string, unknown>>(
  item: UniverseItem<T>,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  itemWorldSize: number = ITEM_WORLD_SIZE,
): RenderItem<T> | null {
  const depth = item.z - camera.z
  if (depth <= 0) return null
  const perspective = FOCAL_LENGTH / depth
  return {
    ...item,
    screenX: (item.x - camera.x) * perspective + canvasWidth / 2,
    screenY: (item.y - camera.y) * perspective + canvasHeight / 2,
    screenSize: itemWorldSize * perspective,
  }
}

export function clampCameraZ(z: number, deepestItemZ: number): number {
  const max = deepestItemZ - CAMERA_Z_BUFFER
  return Math.max(CAMERA_Z_MIN, Math.min(z, max))
}

/**
 * Clamp camera.x/y so that content bounds always overlap the screen by at least CLAMP_MARGIN px.
 * Operates in world space: valid range expands when zoomed in (small depth) and shrinks when zoomed out.
 */
export function clampCameraXY(
  camera: Camera,
  bounds: ContentBounds,
  canvasW: number,
  canvasH: number,
  margin = CLAMP_MARGIN,
): Pick<Camera, 'x' | 'y'> {
  const depth = bounds.z - camera.z
  if (depth <= 0) return { x: camera.x, y: camera.y }

  // Half-screen minus margin, converted to world units at content depth.
  const halfW = (canvasW / 2 - margin) * depth / FOCAL_LENGTH
  const halfH = (canvasH / 2 - margin) * depth / FOCAL_LENGTH

  const xMin = bounds.xMin - halfW
  const xMax = bounds.xMax + halfW
  const yMin = bounds.yMin - halfH
  const yMax = bounds.yMax + halfH

  return {
    x: xMin > xMax ? camera.x : Math.min(xMax, Math.max(xMin, camera.x)),
    y: yMin > yMax ? camera.y : Math.min(yMax, Math.max(yMin, camera.y)),
  }
}

/**
 * Zoom by moving camera.z, keeping the world point under the cursor fixed on screen.
 * Pan is expressed solely as camera.x/y (world space), so the zoom anchor formula
 * reduces to a simple cursor-offset term with no panX/panY dependency — eliminating drift.
 *
 * Derivation: screen x of world point wx is:
 *   sx = (wx - cx) * F / depth + W/2
 * To keep sx constant as cz changes by dz (depth changes by -dz):
 *   dcx = (sx - W/2) / F * dz = offsetX / F * dz
 * Same for y.
 */
export function zoomCamera(
  camera: Camera,
  wheelDelta: number,
  cursorScreenX: number,
  cursorScreenY: number,
  canvasWidth: number,
  canvasHeight: number,
  deepestItemZ: number,
): Camera {
  const dzRaw = -wheelDelta * (deepestItemZ - camera.z) * 0.004
  const limit = deepestItemZ - CAMERA_Z_BUFFER
  const maxStep = dzRaw > 0 ? (limit - camera.z) * 0.3 : Infinity
  const newZ = clampCameraZ(camera.z + Math.min(dzRaw, maxStep), deepestItemZ)
  const dz = newZ - camera.z

  const offsetX = cursorScreenX - canvasWidth / 2
  const offsetY = cursorScreenY - canvasHeight / 2

  return {
    x: camera.x + (offsetX / FOCAL_LENGTH) * dz,
    y: camera.y + (offsetY / FOCAL_LENGTH) * dz,
    z: newZ,
    panX: 0,
    panY: 0,
  }
}
