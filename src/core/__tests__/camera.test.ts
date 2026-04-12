import { describe, it, expect } from 'vitest'
import {
  FOCAL_LENGTH,
  projectItem,
  clampCameraZ,
  panCamera,
  zoomCamera,
} from '../camera'

const makeItem = (x: number, y: number, z: number) => ({
  id: 'a',
  x,
  y,
  z,
  data: {},
})

describe('projectItem', () => {
  it('projects item at camera position to canvas center', () => {
    const camera = { x: 0, y: 0, z: 0, panX: 0, panY: 0 }
    const item = makeItem(0, 0, FOCAL_LENGTH)
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result).not.toBeNull()
    expect(result!.screenX).toBeCloseTo(400)
    expect(result!.screenY).toBeCloseTo(300)
  })

  it('returns null when item is behind the camera', () => {
    const camera = { x: 0, y: 0, z: 500, panX: 0, panY: 0 }
    const item = makeItem(0, 0, 100) // depth = 100 - 500 = -400
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result).toBeNull()
  })

  it('screenSize scales with distance', () => {
    const camera = { x: 0, y: 0, z: 0, panX: 0, panY: 0 }
    const near = projectItem(makeItem(0, 0, 100), camera, 800, 600, 50)
    const far = projectItem(makeItem(0, 0, 400), camera, 800, 600, 50)
    expect(near).not.toBeNull()
    expect(far).not.toBeNull()
    expect(near!.screenSize).toBeGreaterThan(far!.screenSize)
  })
})

describe('clampCameraZ', () => {
  it('does not go below minimum', () => {
    expect(clampCameraZ(-9999, 1000)).toBe(-5000)
  })

  it('does not exceed deepest item minus buffer', () => {
    expect(clampCameraZ(990, 1000)).toBe(950) // 1000 - 50 buffer
  })

  it('allows valid z', () => {
    expect(clampCameraZ(0, 1000)).toBe(0)
  })
})

describe('panCamera', () => {
  it('shifts panX and panY in screen space', () => {
    const cam = panCamera({ x: 0, y: 0, z: 0, panX: 0, panY: 0 }, 5, -3)
    expect(cam.panX).toBe(-5)
    expect(cam.panY).toBe(3)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })
})

describe('zoomCamera', () => {
  const cam0 = { x: 0, y: 0, z: 0, panX: 0, panY: 0 }

  it('moves camera z toward cursor world position', () => {
    const result = zoomCamera(cam0, -100, 400, 300, 800, 600, 1000)
    expect(result.z).toBeGreaterThan(0)
  })

  it('is clamped to deepest item z', () => {
    const camera = { x: 0, y: 0, z: 900, panX: 0, panY: 0 }
    const result = zoomCamera(camera, -10000, 400, 300, 800, 600, 1000)
    expect(result.z).toBeLessThanOrEqual(950) // 1000 - 50 buffer
  })

  it('shifts camera x/y to keep cursor world point fixed when cursor is off-center', () => {
    const result = zoomCamera(cam0, -100, 600, 200, 800, 600, 2000)
    expect(result.x).not.toBe(0)
    expect(result.y).not.toBe(0)
    const centered = zoomCamera(cam0, -100, 400, 300, 800, 600, 2000)
    expect(centered.x).toBeCloseTo(0)
    expect(centered.y).toBeCloseTo(0)
  })
})
