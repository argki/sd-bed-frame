import {
  LUMBER,
  LUMBER_2X4,
  MATTRESS,
  SLAT_MAX_GAP,
  STORAGE_BOX,
  STORAGE_CLEARANCE,
} from "./constants";
import { WOOD_SUPPORT } from "./support";
import { type FrameModule, type Part, placedSize, type Vec3 } from "./types";

const SLAT_T = LUMBER.thickness;
const SLAT_W = LUMBER.width;
const RAIL_T = LUMBER_2X4.thickness;
const RAIL_W = LUMBER_2X4.width;

/** モジュール1つの外寸。マットレスを幅と長さでそれぞれ2等分する。 */
export const MODULE_SIZE = {
  width: MATTRESS.width / 2,
  length: MATTRESS.length / 2,
} as const;

/** 箱の高さと、出し入れに必要な余裕。開口はこの高さ以上にする。 */
export const STORAGE_CLEAR_HEIGHT = STORAGE_BOX.height + STORAGE_CLEARANCE;
/** 上枠の下端。木の脚の高さに合わせる。 */
export const RAIL_BOTTOM = WOOD_SUPPORT.leg.length;
/** 床からすのこの上面までの高さ。 */
export const FRAME_HEIGHT = RAIL_BOTTOM + RAIL_W + SLAT_T;

/** すのこの枚数。すき間が SLAT_MAX_GAP 以下になる最小の枚数にする。 */
export const SLAT_COUNT = minSlatCount(MODULE_SIZE.width);
export const SLAT_GAP = (MODULE_SIZE.width - SLAT_COUNT * SLAT_W) / (SLAT_COUNT - 1);

/** 長辺の上枠のあいだに渡す上枠の長さ。 */
export const CROSS_RAIL_LENGTH = MODULE_SIZE.width - 2 * RAIL_T;
/** 箱を置ける奥行き。反対側の開口まで使える。 */
export const STORAGE_DEPTH = MODULE_SIZE.width;
/** 中央の上枠の z 位置。2つの区画が同じ幅になるようにする。 */
const DIVIDER_Z = (MODULE_SIZE.length - RAIL_T) / 2;

/** 開口から見た区画の z 範囲。両端と中央の上枠の厚みを除く。 */
const BAYS = [
  { minZ: RAIL_T, maxZ: DIVIDER_Z },
  { minZ: DIVIDER_Z + RAIL_T, maxZ: MODULE_SIZE.length - RAIL_T },
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

/** 木材ではない脚と根太受け。位置は所属モジュールの原点から。 */
export type FrameHardwarePlacement = {
  readonly id: string;
  readonly name: string;
  readonly moduleId: string;
  readonly position: Vec3;
  readonly size: Vec3;
};

export function moduleParts(module: FrameModule): Part[] {
  const parts: Part[] = [
    {
      id: `${module.id}-side-rail`,
      name: "上枠",
      moduleId: module.id,
      length: MODULE_SIZE.length,
      section: LUMBER_2X4,
      placements: [0, MODULE_SIZE.width - RAIL_T].map((x) => ({
        position: { x, y: RAIL_BOTTOM, z: 0 },
        lengthAxis: "z",
        widthAxis: "y",
      })),
    },
    {
      id: `${module.id}-cross-rail`,
      name: "上枠",
      moduleId: module.id,
      length: CROSS_RAIL_LENGTH,
      section: LUMBER_2X4,
      placements: [0, DIVIDER_Z, MODULE_SIZE.length - RAIL_T].map((z) => ({
        position: { x: RAIL_T, y: RAIL_BOTTOM, z },
        lengthAxis: "x",
        widthAxis: "y",
      })),
    },
    {
      id: `${module.id}-slat`,
      name: "天板のすのこ",
      moduleId: module.id,
      length: MODULE_SIZE.length,
      section: LUMBER,
      placements: Array.from({ length: SLAT_COUNT }, (_, i) => ({
        position: { x: i * (SLAT_W + SLAT_GAP), y: RAIL_BOTTOM + RAIL_W, z: 0 },
        lengthAxis: "z",
        widthAxis: "x",
      })),
    },
    {
      id: `${module.id}-seat`,
      name: WOOD_SUPPORT.seat.name,
      moduleId: module.id,
      length: WOOD_SUPPORT.seat.length,
      section: LUMBER_2X4,
      placements: [0, MODULE_SIZE.width - LUMBER_2X4.width].map((x) => ({
        position: { x, y: RAIL_BOTTOM - WOOD_SUPPORT.seat.length, z: DIVIDER_Z },
        lengthAxis: "y",
        widthAxis: "x",
      })),
    },
  ];
  const mirrored =
    module.openSide === "left"
      ? parts
      : parts.map((part) => ({
          ...part,
          placements: part.placements.map((placement) => ({
            ...placement,
            position: mirrorX(
              placement.position,
              placedSize(part.length, placement, part.section).x,
            ),
          })),
        }));
  const legs = legPart(module);
  return legs ? [...mirrored, legs] : mirrored;
}

/** 鋼製の脚と根太受けは置かない。開口の支えは木材の脚と受け材である。 */
export function moduleHardware(_module: FrameModule): FrameHardwarePlacement[] {
  return [];
}

/**
 * 境の脚は、頭側または左側のモジュールに付ける。
 * 幅の境では 89mm を境の両側へ出し、長さの境では 89mm を境の両側へ出す。
 * 外隅は、ベッドの外側へ出さない。
 */
const LEG_PLACEMENTS: readonly {
  moduleId: string;
  x: number;
  z: number;
  widthAxis: "x" | "z";
}[] = [
  { moduleId: "head-left", x: 0, z: 0, widthAxis: "x" },
  { moduleId: "head-left", x: MODULE_SIZE.width - LUMBER_2X4.width / 2, z: 0, widthAxis: "x" },
  { moduleId: "head-left", x: 0, z: MODULE_SIZE.length - LUMBER_2X4.width / 2, widthAxis: "z" },
  {
    moduleId: "head-left",
    x: MODULE_SIZE.width - LUMBER_2X4.width / 2,
    z: MODULE_SIZE.length - LUMBER_2X4.thickness / 2,
    widthAxis: "x",
  },
  { moduleId: "head-right", x: MODULE_SIZE.width - LUMBER_2X4.width, z: 0, widthAxis: "x" },
  {
    moduleId: "head-right",
    x: MODULE_SIZE.width - RAIL_T,
    z: MODULE_SIZE.length - LUMBER_2X4.width / 2,
    widthAxis: "z",
  },
  { moduleId: "foot-left", x: 0, z: MODULE_SIZE.length - RAIL_T, widthAxis: "x" },
  {
    moduleId: "foot-left",
    x: MODULE_SIZE.width - LUMBER_2X4.width / 2,
    z: MODULE_SIZE.length - RAIL_T,
    widthAxis: "x",
  },
  {
    moduleId: "foot-right",
    x: MODULE_SIZE.width - LUMBER_2X4.width,
    z: MODULE_SIZE.length - RAIL_T,
    widthAxis: "x",
  },
];

function legPart(module: FrameModule): Part | undefined {
  const placements = LEG_PLACEMENTS.filter((item) => item.moduleId === module.id);
  if (placements.length === 0) {
    return undefined;
  }
  return {
    id: `${module.id}-leg`,
    name: WOOD_SUPPORT.leg.name,
    moduleId: module.id,
    length: WOOD_SUPPORT.leg.length,
    section: LUMBER_2X4,
    placements: placements.map((item) => ({
      position: { x: item.x, y: 0, z: item.z },
      lengthAxis: "y" as const,
      widthAxis: item.widthAxis,
    })),
  };
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
export const FRAME_HARDWARE_PLACEMENTS: readonly FrameHardwarePlacement[] =
  FRAME_MODULES.flatMap(moduleHardware);
export const STORAGE_SLOTS: readonly StorageSlot[] = FRAME_MODULES.flatMap(moduleStorageSlots);

function mirrorX(position: Vec3, sizeX: number): Vec3 {
  return { ...position, x: MODULE_SIZE.width - position.x - sizeX };
}

function minSlatCount(span: number): number {
  for (let count = 2; count * SLAT_W <= span; count++) {
    if ((span - count * SLAT_W) / (count - 1) <= SLAT_MAX_GAP) {
      return count;
    }
  }
  throw new Error(`幅 ${span}mm に、すき間 ${SLAT_MAX_GAP}mm 以下ですのこを並べられない`);
}
