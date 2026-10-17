import type { Vec3 } from "./types";

/** 分解しきったとき、モジュールをベッド中心から離す距離。 */
export const MODULE_EXPLODE_DISTANCE = 320;

/**
 * 部材分解でモジュールを離す距離。
 * 部材はモジュール中心から広がるので、境の部材は隣のモジュール側へ戻る。
 * 戻っても重ならないよう、モジュール分解より長く離す。
 */
export const PART_EXPLODE_DISTANCE = 480;

/** 分解しきったとき、部材をモジュール中心から離す倍率。 */
export const PART_EXPLODE_SCALE = 0.7;

export type ExplodeMode = "module" | "part";

/** 組み立て位置を、分解の度合いに応じてずらす。amount は 0 が組み立て済み、1 が分解。 */
export function explodedPosition(
  partCenter: Vec3,
  moduleCenter: Vec3,
  bedCenter: Vec3,
  amount: number,
  mode: ExplodeMode,
): Vec3 {
  const t = clamp01(amount);
  const distance = mode === "part" ? PART_EXPLODE_DISTANCE : MODULE_EXPLODE_DISTANCE;
  const moduleOffset = scale(horizontalDirection(bedCenter, moduleCenter), distance * t);
  const partOffset =
    mode === "part" ? scale(subtract(partCenter, moduleCenter), PART_EXPLODE_SCALE * t) : zero;
  return add(partCenter, moduleOffset, partOffset);
}

const zero: Vec3 = { x: 0, y: 0, z: 0 };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function horizontalDirection(from: Vec3, to: Vec3): Vec3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) {
    return zero;
  }
  return { x: dx / length, y: 0, z: dz / length };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(value: Vec3, factor: number): Vec3 {
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function add(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return { x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z };
}
