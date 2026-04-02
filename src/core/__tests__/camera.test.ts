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
    const camera = { x: 0, y: 0, z: 0 }
    const item = makeItem(0, 0, FOCAL_LENGTH)
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result.screenX).toBeCloseTo(400)
    expect(result.screenY).toBeCloseTo(300)
  })

  it('returns null when item is behind the camera', () => {
    const camera = { x: 0, y: 0, z: 500 }
    const item = makeItem(0, 0, 100) // depth = 100 - 500 = -400
    const result = projectItem(item, camera, 800, 600, 50)
    expect(result).toBeNull()
  })

  it('screenSize scales with distance', () => {
    const camera = { x: 0, y: 0, z: 0 }
    const near = projectItem(makeItem(0, 0, 100), camera, 800, 600, 50)
    const far = projectItem(makeItem(0, 0, 400), camera, 800, 600, 50)
    expect(near!.screenSize).toBeGreaterThan(far!.screenSize)
  })
})

describe('clampCameraZ', () => {
  it('does not go below minimum', () => {
    expect(clampCameraZ(-9999, 1000)).toBe(-2000)
  })

  it('does not exceed deepest item minus buffer', () => {
    expect(clampCameraZ(990, 1000)).toBe(950) // 1000 - 50 buffer
  })

  it('allows valid z', () => {
    expect(clampCameraZ(0, 1000)).toBe(0)
  })
})

describe('panCamera', () => {
  it('adds delta to camera x and y', () => {
    const cam = panCamera({ x: 10, y: 20, z: 0 }, 5, -3)
    expect(cam.x).toBe(15)
    expect(cam.y).toBe(17)
    expect(cam.z).toBe(0)
  })
})

describe('zoomCamera', () => {
  it('moves camera z toward cursor world position', () => {
    const camera = { x: 0, y: 0, z: 0 }
    // scrolling in (negative delta) should increase z (move forward)
    const result = zoomCamera(camera, -100, 400, 300, 800, 600, 1000)
    expect(result.z).toBeGreaterThan(0)
  })

  it('is clamped to deepest item z', () => {
    const camera = { x: 0, y: 0, z: 900 }
    const result = zoomCamera(camera, -10000, 400, 300, 800, 600, 1000)
    expect(result.z).toBeLessThanOrEqual(950) // 1000 - 50 buffer
  })
})
