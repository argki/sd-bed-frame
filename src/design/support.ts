import { FASTENER, LUMBER_2X4, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import { createCutPlan } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import { FRAME_JOINTS, SCREWS_PER_HANGER_SEAT, SCREWS_PER_LEG } from "./joints";
import { FASTENER_SUMMARY, PROJECT_COST, packsToBuy } from "./materials";
import type { Part, PartPlacement } from "./types";

/**
 * 検討前の概算合計。コミット 45651f7 の購入計算で、内訳は設計メモにある。
 */
export const PRECHANGE_TOTAL = 18113;

const placement: PartPlacement = {
  position: { x: 0, y: 0, z: 0 },
  lengthAxis: "y",
  widthAxis: "x",
};

/**
 * 開口を支える方法。DIYデザイン脚と根太受けは買わない。
 * フレームの配置へは、まだ反映していない。
 */
export const WOOD_SUPPORT = {
  leg: {
    name: "脚",
    section: LUMBER_2X4,
    /** 箱の高さと、出し入れの余裕。開口はこの長さになる。 */
    length: STORAGE_BOX.height + STORAGE_CLEARANCE,
    /**
     * 組み立てたベッドの、モジュールの角が集まる位置。
     * 幅方向3列、長さ方向3列。境の位置は、隣のモジュールと共有する。
     */
    count: 3 * 3,
  },
  seat: {
    name: "受け材",
    section: LUMBER_2X4,
    /** 中央の上枠の高さを受ける長さ。 */
    length: LUMBER_2X4.width,
    /** 4モジュールの、中央の上枠の両端。 */
    count: 4 * 2,
  },
} as const;

export type SupportEstimate = {
  readonly lumberCost: number;
  readonly cutCost: number;
  readonly fastenerCost: number;
  readonly totalCost: number;
  readonly stocks: readonly { id: string; boardCount: number; cutCount: number }[];
};

/** いまの上枠とすのこに、脚と受け材を足したときの概算。鋼製の脚と根太受けは含まない。 */
export function estimateWoodSupport(): SupportEstimate {
  const plan = createCutPlan([
    ...FRAME_PARTS,
    supportPart("proposed-leg", WOOD_SUPPORT.leg),
    supportPart("proposed-seat", WOOD_SUPPORT.seat),
  ]);
  const fastenerCost = fastenerCostWithSupportScrews();
  return {
    lumberCost: plan.cost.materialCost,
    cutCost: plan.cost.cutCost,
    fastenerCost,
    totalCost: plan.cost.materialCost + plan.cost.cutCost + fastenerCost,
    stocks: plan.stocks.map((stock) => ({
      id: stock.id,
      boardCount: stock.boardCount,
      cutCount: stock.cutCount,
    })),
  };
}

function supportPart(
  id: string,
  item: { name: string; section: typeof LUMBER_2X4; length: number; count: number },
): Part {
  return {
    id,
    name: item.name,
    moduleId: "support",
    length: item.length,
    section: item.section,
    placements: Array.from({ length: item.count }, () => placement),
  };
}

function fastenerCostWithSupportScrews(): number {
  const slat = FASTENER_SUMMARY.find((item) => item.id === FASTENER.slat.id);
  if (!slat) {
    throw new Error("全ねじの集計がない");
  }
  const hardwareScrews = FRAME_JOINTS.filter((joint) => joint.hardwareId).reduce(
    (sum, joint) => sum + joint.positions.length,
    0,
  );
  const supportScrews =
    WOOD_SUPPORT.leg.count * SCREWS_PER_LEG + WOOD_SUPPORT.seat.count * SCREWS_PER_HANGER_SEAT;
  const used = slat.used - hardwareScrews + supportScrews;
  const packCount = packsToBuy(used, slat.packSize);
  return PROJECT_COST.fastenerCost - slat.subtotal + packCount * slat.packPrice;
}
