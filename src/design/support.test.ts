import { describe, expect, it } from "vitest";
import { FRAME_HARDWARE, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import { FRAME_CUT_PLAN } from "./cut-plan";
import { estimateWoodSupport, PRECHANGE_TOTAL, WOOD_SUPPORT } from "./support";

describe("木の脚と受け材", () => {
  const estimate = estimateWoodSupport();

  it("開口は、箱の高さと余裕以上ある", () => {
    expect(WOOD_SUPPORT.leg.length).toBeGreaterThanOrEqual(STORAGE_BOX.height + STORAGE_CLEARANCE);
    expect(WOOD_SUPPORT.leg.length).toBe(STORAGE_BOX.height + STORAGE_CLEARANCE);
  });

  it("DIYデザイン脚と根太受けを買わず、検討前の合計以下になる", () => {
    expect(WOOD_SUPPORT.leg.name).not.toBe(FRAME_HARDWARE.leg.name);
    expect(estimate).toMatchObject({
      lumberCost: 10924,
      cutCost: 2850,
      fastenerCost: 4246,
      totalCost: 18020,
    });
    expect(estimate.totalCost).toBeLessThanOrEqual(PRECHANGE_TOTAL);
    expect(estimate.totalCost).toBe(estimate.lumberCost + estimate.cutCost + estimate.fastenerCost);
  });

  it("追加の定尺を買わない", () => {
    expect(estimate.stocks).toEqual([
      { id: "1x4", boardCount: 7, cutCount: 20 },
      { id: "2x4", boardCount: 5, cutCount: 37 },
    ]);
    expect(estimate.stocks.map((stock) => stock.boardCount)).toEqual(
      FRAME_CUT_PLAN.stocks.map((stock) => stock.boardCount),
    );
    expect(FRAME_CUT_PLAN.pieceCount).toBe(40);
  });
});
