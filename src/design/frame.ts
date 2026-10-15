import { LUMBER, MATTRESS, SLAT_MAX_GAP, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import { type FrameModule, type Part, type PartPlacement, placedSize, type Vec3 } from "./types";

const T = LUMBER.thickness;
const B = LUMBER.width;

/** モジュール1つの外寸。マットレスを幅と長さでそれぞれ2等分する。 */
export const MODULE_SIZE = {
  width: MATTRESS.width / 2,
  length: MATTRESS.length / 2,
} as const;

/** 箱を出し入れする開口の高さ。 */
export const STORAGE_CLEAR_HEIGHT = STORAGE_BOX.height + STORAGE_CLEARANCE;
/** 柱の長さ。柱の上端に横桟とすのこを載せる。 */
export const POST_HEIGHT = STORAGE_CLEAR_HEIGHT + B;
/** 床からすのこの上面までの高さ。 */
export const FRAME_HEIGHT = POST_HEIGHT + T;

/** すのこの枚数。すき間が SLAT_MAX_GAP 以下になる最小の枚数にする。 */
export const SLAT_COUNT = minSlatCount(MODULE_SIZE.width);
export const SLAT_GAP = (MODULE_SIZE.width - SLAT_COUNT * B) / (SLAT_COUNT - 1);

/** 左右の柱の間に渡す横桟の長さ。 */
export const CROSS_RAIL_LENGTH = MODULE_SIZE.width - 2 * B;
/** 箱を置ける奥行き。反対側の開口まで使える。 */
export const STORAGE_DEPTH = MODULE_SIZE.width;
/** 中央の上横桟の z 位置。2つの区画が同じ幅になるようにする。 */
const DIVIDER_Z = (MODULE_SIZE.length - T) / 2;

/** 開口から見た区画の z 範囲。端板、仕切り板の厚みを除く。 */
const BAYS = [
  { minZ: T, maxZ: DIVIDER_Z },
  { minZ: DIVIDER_Z + T, maxZ: MODULE_SIZE.length - T },
] as const;

/** 1つの区画に奥行き方向へ並べる箱の数。手前に余裕を残す。 */
export const BOXES_PER_BAY = Math.floor((STORAGE_DEPTH - STORAGE_CLEARANCE) / STORAGE_BOX.depth);

export const FRAME_MODULES: readonly FrameModule[] = [
  { id: "head-left", name: "頭側・左", origin: { x: 0, y: 0, z: 0 }, openSide: "left" },
  {
    id: "head-right",
    name: "頭側・右",
    origin: { x: MODULE_SIZE.width, y: 0, z: 0 },
    openSide: "right",
  },
  {
    id: "foot-left",
    name: "足側・左",
    origin: { x: 0, y: 0, z: MODULE_SIZE.length },
    openSide: "left",
  },
  {
    id: "foot-right",
    name: "足側・右",
    origin: { x: MODULE_SIZE.width, y: 0, z: MODULE_SIZE.length },
    openSide: "right",
  },
];

/** 収納する箱1つの置き場所。位置は所属モジュールの原点から。 */
export type StorageSlot = {
  readonly moduleId: string;
  readonly position: Vec3;
  readonly size: Vec3;
};

/** 箱は横幅を z 方向（開口の幅方向）、奥行きを x 方向（差し込む方向）に向けて置く。 */
export const STORED_BOX_SIZE: Vec3 = {
  x: STORAGE_BOX.depth,
  y: STORAGE_BOX.height,
  z: STORAGE_BOX.width,
};

export function moduleParts(module: FrameModule): Part[] {
  const parts: Part[] = [
    {
      id: `${module.id}-slat`,
      name: "天板のすのこ",
      moduleId: module.id,
      length: MODULE_SIZE.length,
      placements: Array.from({ length: SLAT_COUNT }, (_, i) => ({
        position: { x: i * (B + SLAT_GAP), y: POST_HEIGHT, z: 0 },
        lengthAxis: "z",
        widthAxis: "x",
      })),
    },
    {
      id: `${module.id}-post`,
      name: "柱",
      moduleId: module.id,
      length: POST_HEIGHT,
      placements: [0, MODULE_SIZE.width - B].flatMap((x) =>
        [0, DIVIDER_Z, MODULE_SIZE.length - T].map(
          (z): PartPlacement => ({
            position: { x, y: 0, z },
            lengthAxis: "y",
            widthAxis: "x",
          }),
        ),
      ),
    },
    {
      id: `${module.id}-upper-rail`,
      name: "上横桟",
      moduleId: module.id,
      length: CROSS_RAIL_LENGTH,
      placements: [0, DIVIDER_Z, MODULE_SIZE.length - T].map((z) => ({
        position: { x: B, y: STORAGE_CLEAR_HEIGHT, z },
        lengthAxis: "x",
        widthAxis: "y",
      })),
    },
    {
      id: `${module.id}-lower-rail`,
      name: "下横桟",
      moduleId: module.id,
      length: CROSS_RAIL_LENGTH,
      placements: [0, MODULE_SIZE.length - T].map((z) => ({
        position: { x: B, y: 0, z },
        lengthAxis: "x",
        widthAxis: "y",
      })),
    },
  ];

  if (module.openSide === "left") {
    return parts;
  }
  return parts.map((part) => ({
    ...part,
    placements: part.placements.map((placement) => ({
      ...placement,
      position: mirrorX(placement.position, placedSize(part.length, placement).x),
    })),
  }));
}

export function moduleStorageSlots(module: FrameModule): StorageSlot[] {
  return BAYS.flatMap((bay) => {
    const z = (bay.minZ + bay.maxZ - STORED_BOX_SIZE.z) / 2;
    return Array.from({ length: BOXES_PER_BAY }, (_, i) => {
      const position = { x: STORAGE_DEPTH - (i + 1) * STORED_BOX_SIZE.x, y: 0, z };
      return {
        moduleId: module.id,
        position: module.openSide === "left" ? position : mirrorX(position, STORED_BOX_SIZE.x),
        size: STORED_BOX_SIZE,
      };
    });
  });
}

export const FRAME_PARTS: readonly Part[] = FRAME_MODULES.flatMap(moduleParts);
export const STORAGE_SLOTS: readonly StorageSlot[] = FRAME_MODULES.flatMap(moduleStorageSlots);

function mirrorX(position: Vec3, sizeX: number): Vec3 {
  return { ...position, x: MODULE_SIZE.width - position.x - sizeX };
}

function minSlatCount(span: number): number {
  for (let count = 2; count * B <= span; count++) {
    if ((span - count * B) / (count - 1) <= SLAT_MAX_GAP) {
      return count;
    }
  }
  throw new Error(`幅 ${span}mm に、すき間 ${SLAT_MAX_GAP}mm 以下ですのこを並べられない`);
}
