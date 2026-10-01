/** Taille de la fenêtre de recadrage (px). */
export const CROP_VIEWPORT_PX = 200;
/** Taille exportée (carré, px) — qualité suffisante pour un avatar. */
export const CROP_OUTPUT_PX = 400;

export function computeBaseCoverScale(natW: number, natH: number, viewport: number): number {
  if (natW <= 0 || natH <= 0) {
    return 1;
  }
  return Math.max(viewport / natW, viewport / natH);
}

export function clampPan(
  panX: number,
  panY: number,
  natW: number,
  natH: number,
  displayScale: number,
  viewport: number,
): { x: number; y: number } {
  const sw = natW * displayScale;
  const sh = natH * displayScale;
  const minX = viewport - sw;
  const minY = viewport - sh;
  const maxX = 0;
  const maxY = 0;
  return {
    x: Math.min(maxX, Math.max(minX, panX)),
    y: Math.min(maxY, Math.max(minY, panY)),
  };
}

/** Coordonnées source dans l’image naturelle pour le carré visible du viewport. */
export function visibleRectInNaturalImage(
  panX: number,
  panY: number,
  displayScale: number,
  viewport: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = -panX / displayScale;
  const sy = -panY / displayScale;
  const sw = viewport / displayScale;
  const sh = viewport / displayScale;
  return { sx, sy, sw, sh };
}
