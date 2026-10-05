interface Bounds { top: number; bottom: number; left: number; right: number }

export function getFocusScrollDistance(target: Bounds, banner: Bounds): number {
  const overlaps = target.bottom > banner.top && target.top < banner.bottom
    && target.right > banner.left && target.left < banner.right;
  return overlaps ? target.bottom - banner.top + 12 : 0;
}
