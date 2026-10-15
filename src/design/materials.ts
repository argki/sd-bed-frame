import { FASTENER, LUMBER, PRICE } from "./constants";
import { FRAME_CUT_PLAN } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import { FRAME_JOINTS } from "./joints";
import type { Part } from "./types";

export type PartSummary = {
  readonly name: string;
  readonly length: number;
  readonly quantity: number;
};

export type PurchaseItem = {
  readonly name: string;
  readonly dimensions: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitPrice: number;
  readonly subtotal: number;
};

export type FastenerSummary = {
  readonly id: string;
  readonly name: string;
  readonly thread: string;
  readonly diameter: number;
  readonly length: number;
  readonly usage: string;
  readonly screwsPerJoint: number;
  readonly used: number;
  readonly packSize: number;
  readonly packCount: number;
  readonly packPrice: number;
  readonly subtotal: number;
};

export const PART_SUMMARY = summarizeParts(FRAME_PARTS);

export const FASTENER_SUMMARY: readonly FastenerSummary[] =
  Object.values(FASTENER).map(summarizeFastener);

const lumberItem: PurchaseItem = {
  name: "1x4材 12f",
  dimensions: `${LUMBER.thickness} × ${LUMBER.width} × ${LUMBER.length} mm`,
  quantity: FRAME_CUT_PLAN.boardCount,
  unit: "本",
  unitPrice: PRICE.lumber,
  subtotal: FRAME_CUT_PLAN.cost.materialCost,
};

const fastenerItems: readonly PurchaseItem[] = FASTENER_SUMMARY.map((fastener) => ({
  name: `${fastener.name} ${fastener.thread}`,
  dimensions: `${fastener.diameter} × ${fastener.length} mm（${fastener.packSize}本入、使用${fastener.used}本）`,
  quantity: fastener.packCount,
  unit: "袋",
  unitPrice: fastener.packPrice,
  subtotal: fastener.subtotal,
}));

export const PURCHASE_ITEMS: readonly PurchaseItem[] = [lumberItem, ...fastenerItems];

const fastenerCost = FASTENER_SUMMARY.reduce((sum, fastener) => sum + fastener.subtotal, 0);

/** 木材、コーススレッド、カット代を合わせた費用。 */
export const PROJECT_COST = {
  lumberCost: FRAME_CUT_PLAN.cost.materialCost,
  fastenerCost,
  cutCost: FRAME_CUT_PLAN.cost.cutCost,
  totalCost: FRAME_CUT_PLAN.cost.materialCost + fastenerCost + FRAME_CUT_PLAN.cost.cutCost,
} as const;

export function summarizeParts(parts: readonly Part[]): PartSummary[] {
  const rows = new Map<string, PartSummary>();

  for (const part of parts) {
    const key = `${part.name}:${part.length}`;
    const current = rows.get(key);
    rows.set(key, {
      name: part.name,
      length: part.length,
      quantity: (current?.quantity ?? 0) + part.placements.length,
    });
  }

  return [...rows.values()];
}

/** 使用本数を入数で切り上げ、買う袋数にする。 */
export function packsToBuy(used: number, packSize: number): number {
  if (!Number.isFinite(used) || used < 0 || !Number.isInteger(packSize) || packSize <= 0) {
    throw new Error("使用本数は0以上、入数は1以上の整数にする");
  }
  return Math.ceil(used / packSize);
}

function summarizeFastener(fastener: (typeof FASTENER)[keyof typeof FASTENER]): FastenerSummary {
  const joints = FRAME_JOINTS.filter((joint) => joint.fastenerId === fastener.id);
  const screwsPerJoint = joints[0]?.positions.length ?? 0;
  if (joints.some((joint) => joint.positions.length !== screwsPerJoint)) {
    throw new Error(`ネジ ${fastener.id} の1か所あたりの本数がそろっていない`);
  }
  const used = joints.reduce((sum, joint) => sum + joint.positions.length, 0);
  const packCount = packsToBuy(used, fastener.packSize);
  return {
    id: fastener.id,
    name: fastener.name,
    thread: fastener.thread,
    diameter: fastener.diameter,
    length: fastener.length,
    usage: fastener.usage,
    screwsPerJoint,
    used,
    packSize: fastener.packSize,
    packCount,
    packPrice: fastener.packPrice,
    subtotal: packCount * fastener.packPrice,
  };
}
