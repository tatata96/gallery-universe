const cache = new Map<string, HTMLImageElement>()

/**
 * Load and cache an image by URL.
 * Returns the same HTMLImageElement on repeated calls with the same URL.
 * Safe to call inside a renderItem callback on every frame.
 */
export function loadImage(url: string): HTMLImageElement {
  if (cache.has(url)) return cache.get(url)!
  const img = new Image()
  img.src = url
  cache.set(url, img)
  return img
}
