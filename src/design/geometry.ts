import { type Box3, type LumberSection, type PartPlacement, placedSize, type Vec3 } from "./types";

export function boxFrom(position: Vec3, size: Vec3): Box3 {
  return {
    min: position,
    max: { x: position.x + size.x, y: position.y + size.y, z: position.z + size.z },
  };
}

export function placementBox(
  length: number,
  placement: PartPlacement,
  section?: LumberSection,
): Box3 {
  return boxFrom(placement.position, placedSize(length, placement, section));
}

/** 2つの直方体が体積を持って重なるか。面で接するだけなら重ならないとみなす。 */
export function intersects(a: Box3, b: Box3): boolean {
  return (
    a.min.x < b.max.x &&
    b.min.x < a.max.x &&
    a.min.y < b.max.y &&
    b.min.y < a.max.y &&
    a.min.z < b.max.z &&
    b.min.z < a.max.z
  );
}

/** b が a の内側（面で接する場合を含む）に収まるか。 */
export function contains(a: Box3, b: Box3): boolean {
  return (
    a.min.x <= b.min.x &&
    b.max.x <= a.max.x &&
    a.min.y <= b.min.y &&
    b.max.y <= a.max.y &&
    a.min.z <= b.min.z &&
    b.max.z <= a.max.z
  );
}
