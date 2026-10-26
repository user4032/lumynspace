/** Геометрія кропу: однакова для прев'ю в діалозі й для canvas-експорту. */

export type CropViewport = { width: number; height: number }
export type CropOffset = { x: number; y: number }
export type CropArea = { sx: number; sy: number; sw: number; sh: number }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Масштаб, за якого фото повністю покриває вьюпорт (як object-cover). */
export function coverScale(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number) {
  if (!imageWidth || !imageHeight || !viewportWidth || !viewportHeight) return 1
  return Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight)
}

/** Частина оригіналу, яка потрапляє у видимий прямокутник кропу. */
export function cropArea({
  imageWidth,
  imageHeight,
  viewport,
  zoom,
  offset,
}: {
  imageWidth: number
  imageHeight: number
  viewport: CropViewport
  zoom: number
  offset: CropOffset
}): CropArea {
  const scale = coverScale(imageWidth, imageHeight, viewport.width, viewport.height) * Math.max(1, zoom)
  const sw = Math.min(imageWidth, viewport.width / scale)
  const sh = Math.min(imageHeight, viewport.height / scale)
  const sx = clamp(imageWidth / 2 - sw / 2 - offset.x / scale, 0, imageWidth - sw)
  const sy = clamp(imageHeight / 2 - sh / 2 - offset.y / scale, 0, imageHeight - sh)
  return { sx, sy, sw, sh }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Малює кроп у canvas. Спочатку зменшує до 2× цільового розміру, потім до
 * фінального — так браузер не робить один різкий стрибок і не дає аліасингу.
 */
function drawCropped(ctx: CanvasRenderingContext2D, image: HTMLImageElement, area: CropArea, outWidth: number, outHeight: number) {
  const ratio = Math.min(1, (outWidth * 2) / area.sw, (outHeight * 2) / area.sh)
  let width = Math.max(1, Math.round(area.sw * ratio))
  let height = Math.max(1, Math.round(area.sh * ratio))
  let source: CanvasImageSource = image

  if (ratio < 1) {
    const first = document.createElement("canvas")
    first.width = width
    first.height = height
    const firstCtx = first.getContext("2d")
    if (!firstCtx) throw new Error("Не вдалося обробити фото")
    firstCtx.imageSmoothingEnabled = true
    firstCtx.imageSmoothingQuality = "high"
    firstCtx.drawImage(image, area.sx, area.sy, area.sw, area.sh, 0, 0, width, height)
    source = first
  }

  while (width > outWidth * 2 && height > outHeight * 2) {
    const nextWidth = Math.max(outWidth, Math.floor(width / 2))
    const nextHeight = Math.max(outHeight, Math.floor(height / 2))
    const next = document.createElement("canvas")
    next.width = nextWidth
    next.height = nextHeight
    const nextCtx = next.getContext("2d")
    if (!nextCtx) throw new Error("Не вдалося обробити фото")
    nextCtx.imageSmoothingEnabled = true
    nextCtx.imageSmoothingQuality = "high"
    nextCtx.drawImage(source, 0, 0, width, height, 0, 0, nextWidth, nextHeight)
    source = next
    width = nextWidth
    height = nextHeight
  }

  if (source === image) {
    ctx.drawImage(image, area.sx, area.sy, area.sw, area.sh, 0, 0, outWidth, outHeight)
  } else {
    ctx.drawImage(source, 0, 0, width, height, 0, 0, outWidth, outHeight)
  }
}

/** Ріже оригінал за областю й віддає готовий File для Storage. */
export async function cropImageToFile(
  image: HTMLImageElement,
  area: CropArea,
  outWidth: number,
  outHeight: number,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Не вдалося обробити фото")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  drawCropped(ctx, image, area, outWidth, outHeight)

  const webp = await toBlob(canvas, "image/webp", 0.92)
  const blob = webp ?? (await toBlob(canvas, "image/jpeg", 0.9))
  if (!blob) throw new Error("Не вдалося обробити фото")
  const type = blob.type || "image/jpeg"
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg"
  return new File([blob], `${fileName}.${ext}`, { type, lastModified: Date.now() })
}
