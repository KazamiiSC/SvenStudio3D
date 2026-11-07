import type { Brush, Vec3 } from './types';

/**
 * Imported GoldSrc brush entities often have no `origin` keyvalue at all:
 * their location is defined by their brush planes. The editor still needs
 * a position for the entity marker and gizmos. Compute that position from
 * the union of the imported brushes' WORLD bounds, not from [0,0,0].
 *
 * `inspectMapImport` reconstructs its brushes with zero rotation and unit
 * scale, so their world vertices are `brush.position + brush.vertices`.
 * This is an EDITOR display anchor only: never serialize it as an extra
 * `origin` property for func_door/func_button/other solid entities.
 */
export function importedBrushEntityAnchor(brushes: readonly Brush[]): Vec3 | null {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let points = 0;
  for (const brush of brushes) {
    for (const vertex of brush.vertices) {
      for (let axis = 0; axis < 3; axis++) {
        const value = brush.position[axis] + vertex[axis];
        if (!Number.isFinite(value)) return null;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
      points++;
    }
  }
  if (points === 0) return null;
  return [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
}
