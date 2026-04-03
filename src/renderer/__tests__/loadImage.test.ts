import { describe, it, expect } from 'vitest'
import { loadImage } from '../loadImage'

describe('loadImage', () => {
  it('returns same HTMLImageElement for the same URL (caching)', () => {
    const a = loadImage('http://example.com/img.png')
    const b = loadImage('http://example.com/img.png')
    expect(a).toBe(b)
  })

  it('returns different elements for different URLs', () => {
    const a = loadImage('http://example.com/1.png')
    const b = loadImage('http://example.com/2.png')
    expect(a).not.toBe(b)
  })

  it('sets the src on the returned element', () => {
    const img = loadImage('http://example.com/test.png')
    expect(img.src).toBe('http://example.com/test.png')
  })
})
