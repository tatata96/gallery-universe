import type { RenderItem } from '../core/types'
import { loadImage } from './loadImage'

export interface ImageRendererStyle {
  placeholderColor?: string
  selectionColor?: string
  selectionLineWidth?: number
  selectionPadding?: number
}

export function createImageRenderer<T extends Record<string, unknown>>(
  imageUrlKey: keyof T & string,
  style?: ImageRendererStyle,
): (ctx: CanvasRenderingContext2D, item: RenderItem<T>, isSelected: boolean) => void {
  const {
    placeholderColor = '#ccc',
    selectionColor = '#ff0',
    selectionLineWidth = 3,
    selectionPadding = 2,
  } = style ?? {}

  return function renderItem(ctx, item, isSelected) {
    const { screenX, screenY, screenSize } = item
    const half = screenSize / 2
    const img = loadImage(item.data[imageUrlKey] as string)

    if (img.complete) {
      ctx.drawImage(img, screenX - half, screenY - half, screenSize, screenSize)
    } else {
      ctx.fillStyle = placeholderColor
      ctx.fillRect(screenX - half, screenY - half, screenSize, screenSize)
    }

    if (isSelected) {
      ctx.strokeStyle = selectionColor
      ctx.lineWidth = selectionLineWidth
      const pad = selectionPadding
      ctx.strokeRect(screenX - half - pad, screenY - half - pad, screenSize + pad * 2, screenSize + pad * 2)
    }
  }
}
