import { LUMBER, MATTRESS, SLAT_MAX_GAP, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import { type FrameModule, type Part, type PartPlacement, placedSize, type Vec3 } from "./types";

const T = LUMBER.thickness;
const B = LUMBER.width;

/** モジュール1つの外寸。マットレスを幅と長さでそれぞれ2等分する。 */
export const MODULE_SIZE = {
  width: MATTRESS.width / 2,
  length: MATTRESS.length / 2,
} as const;

/** 壁1面に積む 1x4 の段数。箱の高さに余裕を足した高さを超える最小の段数にする。 */
export const WALL_BOARD_COUNT = Math.ceil((STORAGE_BOX.height + STORAGE_CLEARANCE) / B);
export const WALL_HEIGHT = WALL_BOARD_COUNT * B;
/** 床からすのこの上面までの高さ。 */
export const FRAME_HEIGHT = WALL_HEIGHT + T;

/** すのこの枚数。すき間が SLAT_MAX_GAP 以下になる最小の枚数にする。 */
export const SLAT_COUNT = minSlatCount(MODULE_SIZE.width);
export const SLAT_GAP = (MODULE_SIZE.width - SLAT_COUNT * B) / (SLAT_COUNT - 1);

/** 背板とすき間なく接する、端板と仕切り板の長さ。 */
const CROSS_BOARD_LENGTH = MODULE_SIZE.width - T;
/** 箱を置ける奥行き。開口から背板の内側まで。 */
export const STORAGE_DEPTH = MODULE_SIZE.width - T;
/** 仕切り板の z 位置。2つの区画が同じ幅になるようにする。 */
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
  const levels = Array.from({ length: WALL_BOARD_COUNT }, (_, i) => i * B);
  const crossBoards = (z: number): PartPlacement[] =>
    levels.map((y) => ({ position: { x: 0, y, z }, lengthAxis: "x", widthAxis: "y" }));

  const parts: Part[] = [
    {
      id: `${module.id}-slat`,
      name: "天板のすのこ",
      moduleId: module.id,
      length: MODULE_SIZE.length,
      placements: Array.from({ length: SLAT_COUNT }, (_, i) => ({
        position: { x: i * (B + SLAT_GAP), y: WALL_HEIGHT, z: 0 },
        lengthAxis: "z",
        widthAxis: "x",
      })),
    },
    {
      id: `${module.id}-back`,
      name: "背板",
      moduleId: module.id,
      length: MODULE_SIZE.length,
      placements: levels.map((y) => ({
        position: { x: MODULE_SIZE.width - T, y, z: 0 },
        lengthAxis: "z",
        widthAxis: "y",
      })),
    },
    {
      id: `${module.id}-end`,
      name: "端板",
      moduleId: module.id,
      length: CROSS_BOARD_LENGTH,
      placements: [...crossBoards(0), ...crossBoards(MODULE_SIZE.length - T)],
    },
    {
      id: `${module.id}-divider`,
      name: "仕切り板",
      moduleId: module.id,
      length: CROSS_BOARD_LENGTH,
      placements: crossBoards(DIVIDER_Z),
    },
    {
      id: `${module.id}-cleat`,
      name: "縦桟",
      moduleId: module.id,
      length: WALL_HEIGHT,
      placements: [0, MODULE_SIZE.width - T - B].flatMap((x) =>
        [T, DIVIDER_Z - T, MODULE_SIZE.length - 2 * T].map(
          (z): PartPlacement => ({ position: { x, y: 0, z }, lengthAxis: "y", widthAxis: "x" }),
        ),
      ),
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
