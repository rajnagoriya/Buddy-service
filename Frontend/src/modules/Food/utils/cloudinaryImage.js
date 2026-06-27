const CLOUDINARY_HOST_RE = /res\.cloudinary\.com/i;
const CLOUDINARY_UPLOAD_RE = /\/image\/upload\//i;
const HAS_TRANSFORM_RE = /\/image\/upload\/(?:[^/]+\/)*(?:f_|q_|w_|h_|c_|dpr_|g_)/i;

/**
 * Build an optimized Cloudinary delivery URL.
 * @param {string} url
 * @param {{ width?: number, quality?: string, format?: string }} [options]
 * @returns {string}
 */
export function optimizeCloudinaryUrl(url, options = {}) {
  const raw = String(url || '').trim();
  if (!raw || !CLOUDINARY_HOST_RE.test(raw) || !CLOUDINARY_UPLOAD_RE.test(raw)) {
    return raw;
  }
  if (HAS_TRANSFORM_RE.test(raw)) {
    return raw;
  }

  const width = Number(options.width) > 0 ? Number(options.width) : 800;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const transform = `f_${format},q_${quality},w_${width}`;

  return raw.replace('/image/upload/', `/image/upload/${transform}/`);
}

/**
 * Build responsive srcset entries for Cloudinary images.
 * @param {string} url
 * @param {number[]} widths
 */
export function buildCloudinarySrcSet(url, widths = [400, 600, 800, 1200]) {
  const base = String(url || '').trim();
  if (!base) return undefined;
  if (!CLOUDINARY_HOST_RE.test(base)) return undefined;

  return widths
    .map((width) => `${optimizeCloudinaryUrl(base, { width, format: 'auto', quality: 'auto' })} ${width}w`)
    .join(', ');
}

export function isCloudinaryUrl(url) {
  return CLOUDINARY_HOST_RE.test(String(url || ''));
}
