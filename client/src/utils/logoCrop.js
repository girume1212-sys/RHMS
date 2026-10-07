function loadImage(src) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function toBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type);
  });
}

/**
 * Detects the bounding box of the logo content (pixels that differ from the
 * surrounding background) and crops the image to that content, trimming the
 * unnecessary background area. Falls back to the original file when no
 * meaningful background crop is found.
 *
 * @param {File|Blob} file
 * @returns {Promise<Blob>} cropped image blob (PNG), or the original file
 */
export async function cropLogoImage(file) {
  const img = await loadImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) return file;

  const ANALYZE_MAX = 256;
  const aScale = Math.min(1, ANALYZE_MAX / Math.max(srcW, srcH));
  const aw = Math.max(1, Math.round(srcW * aScale));
  const ah = Math.max(1, Math.round(srcH * aScale));

  const ac = document.createElement('canvas');
  ac.width = aw;
  ac.height = ah;
  const actx = ac.getContext('2d', { willReadFrequently: true });
  actx.drawImage(img, 0, 0, aw, ah);

  let id;
  try {
    id = actx.getImageData(0, 0, aw, ah);
  } catch (e) {
    return file;
  }
  const data = id.data;

  const corners = [
    0,
    (aw - 1) * 4,
    (ah - 1) * aw * 4,
    ((ah - 1) * aw + (aw - 1)) * 4
  ];
  let br = 0, bg = 0, bb = 0;
  corners.forEach(off => {
    br += data[off];
    bg += data[off + 1];
    bb += data[off + 2];
  });
  br = br / corners.length;
  bg = bg / corners.length;
  bb = bb / corners.length;

  const tolerance = 28;
  let minX = aw, minY = ah, maxX = -1, maxY = -1;
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const idx = (y * aw + x) * 4;
      if (data[idx + 3] <= 40) continue;
      const dr = Math.abs(data[idx] - br);
      const dg = Math.abs(data[idx + 1] - bg);
      const db = Math.abs(data[idx + 2] - bb);
      if (dr + dg + db > tolerance) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return file;

  const contentArea = (maxX - minX + 1) * (maxY - minY + 1);
  const totalArea = aw * ah;
  if (contentArea / totalArea >= 0.96) return file;

  const sFactor = srcW / aw;
  const padX = Math.round((maxX - minX + 1) * 0.04);
  const padY = Math.round((maxY - minY + 1) * 0.04);

  const sx = Math.max(0, Math.floor(minX * sFactor) - Math.round(padX * sFactor));
  const sy = Math.max(0, Math.floor(minY * sFactor) - Math.round(padY * sFactor));
  const sW = Math.min(srcW - sx, Math.ceil((maxX - minX + 1) * sFactor) + Math.round(padX * 2 * sFactor));
  const sH = Math.min(srcH - sy, Math.ceil((maxY - minY + 1) * sFactor) + Math.round(padY * 2 * sFactor));

  if (sW <= 0 || sH <= 0) return file;
  if (sW >= srcW * 0.99 && sH >= srcH * 0.99) return file;

  const out = document.createElement('canvas');
  out.width = Math.max(1, sW);
  out.height = Math.max(1, sH);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, sx, sy, sW, sH, 0, 0, out.width, out.height);

  return await toBlob(out, 'image/png');
}