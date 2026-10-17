import { FASTENER, LUMBER, MODULE_BOLT, MODULE_FASTENER, PRICE } from "./constants";
import { FRAME_CUT_PLAN } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import { FRAME_JOINTS } from "./joints";
import { MODULE_JOINTS } from "./module-joints";
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
  /** 同じネジの接合がすべて同じ本数のとき、その本数。本数が混ざるときは null。 */
  readonly screwsPerJoint: number | null;
  readonly used: number;
  readonly packSize: number;
  readonly packCount: number;
  readonly packPrice: number;
  readonly subtotal: number;
};

export const PART_SUMMARY = summarizeParts(FRAME_PARTS);

export const FASTENER_SUMMARY: readonly FastenerSummary[] =
  Object.values(FASTENER).map(summarizeFastener);

export type HardwareSummary = {
  readonly id: string;
  readonly name: string;
  readonly dimensions: string;
  readonly usage: string;
  readonly used: number;
  readonly packSize: number;
  readonly packCount: number;
  readonly packPrice: number;
  readonly subtotal: number;
  readonly unit: string;
};

const moduleBolts = [MODULE_FASTENER.acrossThickness, MODULE_FASTENER.acrossWidth] as const;

export const MODULE_HARDWARE_SUMMARY: readonly HardwareSummary[] = summarizeModuleHardware();

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

const hardwareItems: readonly PurchaseItem[] = MODULE_HARDWARE_SUMMARY.map((item) => ({
  name: item.name,
  dimensions: item.dimensions,
  quantity: item.packCount,
  unit: item.unit,
  unitPrice: item.packPrice,
  subtotal: item.subtotal,
}));

export const PURCHASE_ITEMS: readonly PurchaseItem[] = [
  lumberItem,
  ...fastenerItems,
  ...hardwareItems,
];

const fastenerCost =
  FASTENER_SUMMARY.reduce((sum, fastener) => sum + fastener.subtotal, 0) +
  MODULE_HARDWARE_SUMMARY.reduce((sum, item) => sum + item.subtotal, 0);

/** 木材、コーススレッド、モジュールの連結金物、カット代を合わせた費用。 */
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

function summarizeModuleHardware(): HardwareSummary[] {
  for (const joint of MODULE_JOINTS) {
    if (!moduleBolts.some((bolt) => bolt.length === joint.boltLength)) {
      throw new Error(`長さ ${joint.boltLength}mm のモジュールボルトの購入品がない`);
    }
  }

  const bolts = moduleBolts.map((bolt) => {
    const used = boltCount(bolt.length);
    const packCount = packsToBuy(used, bolt.packSize);
    const cut = bolt.stockLength === bolt.length ? "" : `、${bolt.length}mmに切る`;
    return {
      id: bolt.id,
      name: `${bolt.name} ${bolt.diameter}×${bolt.stockLength}`,
      dimensions: `${bolt.diameter} × ${bolt.stockLength} mm（${bolt.packSize}本入、使用${used}本${cut}）`,
      usage: bolt.usage,
      used,
      packSize: bolt.packSize,
      packCount,
      packPrice: bolt.packPrice,
      subtotal: packCount * bolt.packPrice,
      unit: bolt.unit,
    };
  });

  const nutUsed = moduleBolts.reduce(
    (sum, bolt) => sum + boltCount(bolt.length) * bolt.nutsPerBolt,
    0,
  );
  const washerUsed = boltTotal() * MODULE_BOLT.washersPerBolt;
  return [
    ...bolts,
    packItem(MODULE_FASTENER.nut, nutUsed, `M${MODULE_FASTENER.nut.diameter}`),
    packItem(
      MODULE_FASTENER.washer,
      washerUsed,
      `${MODULE_FASTENER.washer.diameter}×${MODULE_FASTENER.washer.outerDiameter}×${MODULE_FASTENER.washer.thickness.toFixed(1)} mm`,
    ),
  ];
}

function boltCount(length: number): number {
  return MODULE_JOINTS.filter((joint) => joint.boltLength === length).reduce(
    (sum, joint) => sum + joint.positions.length,
    0,
  );
}

function boltTotal(): number {
  return MODULE_JOINTS.reduce((sum, joint) => sum + joint.positions.length, 0);
}

function packItem(
  item: typeof MODULE_FASTENER.nut | typeof MODULE_FASTENER.washer,
  used: number,
  size: string,
): HardwareSummary {
  const packCount = packsToBuy(used, item.packSize);
  return {
    id: item.id,
    name: `${item.name} M${item.diameter}`,
    dimensions: `${size}（${item.packSize}個入、使用${used}個）`,
    usage: item.usage,
    used,
    packSize: item.packSize,
    packCount,
    packPrice: item.packPrice,
    subtotal: packCount * item.packPrice,
    unit: item.unit,
  };
}

function summarizeFastener(fastener: (typeof FASTENER)[keyof typeof FASTENER]): FastenerSummary {
  const joints = FRAME_JOINTS.filter((joint) => joint.fastenerId === fastener.id);
  const counts = new Set(joints.map((joint) => joint.positions.length));
  const screwsPerJoint = counts.size === 1 ? ([...counts][0] ?? null) : null;
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
