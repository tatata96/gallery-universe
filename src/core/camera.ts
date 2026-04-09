import type { Camera, UniverseItem, RenderItem } from './types'

export const FOCAL_LENGTH = 800
export const ITEM_WORLD_SIZE = 50
const CAMERA_Z_MIN = -2000
const CAMERA_Z_BUFFER = 50

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

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * Zoom by moving camera.z, keeping the world point under the cursor fixed on screen.
 *
 * Derivation: for a point P at world (px, py, pz), its screen x is:
 *   sx = (px - cx) * F / (pz - cz) + W/2
 * We want sx to remain constant as cz changes by dz. Differentiating wrt cz:
 *   d(sx)/d(cz) = (px - cx) * F / (pz - cz)^2
 * To compensate, shift cx by:
 *   dcx = (sx - W/2) / F * dz   (uses screen offset and focal length)
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
  const dzRaw = -wheelDelta * 6
  const newZ = clampCameraZ(camera.z + dzRaw, deepestItemZ)
  const dz = newZ - camera.z

  const offsetX = cursorScreenX - canvasWidth / 2
  const offsetY = cursorScreenY - canvasHeight / 2

  return {
    x: camera.x + (offsetX / FOCAL_LENGTH) * dz,
    y: camera.y + (offsetY / FOCAL_LENGTH) * dz,
    z: newZ,
  }
}
