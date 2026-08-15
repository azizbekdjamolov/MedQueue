export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Validate an image file before it is processed or uploaded.
 *
 * @returns {{ ok: true } | { ok: false, error: 'type' | 'size' }}
 */
export function validateImage(file) {
  if (!file || !IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'type' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'size' }
  return { ok: true }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Downscale an image via canvas. Used to produce a small persisted thumbnail
 * (sent to the AI) and a session-only full-size variant (kept in memory).
 *
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number }} [options]
 * @returns {Promise<string>} A JPEG (or PNG, for transparency) data URL.
 */
export async function processImage(file, { maxDim = 1280, quality = 0.82 } = {}) {
  const dataUrl = await readAsDataURL(file)
  const img = await loadImage(dataUrl)

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  if (file.type === 'image/png') {
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}