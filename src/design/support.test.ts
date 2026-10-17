import { describe, expect, it } from "vitest";
import { FRAME_HARDWARE, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import { FRAME_CUT_PLAN } from "./cut-plan";
import { PROJECT_COST, PURCHASE_ITEMS } from "./materials";
import { PRECHANGE_TOTAL, WOOD_SUPPORT } from "./support";

describe("木の脚と受け材", () => {
  it("開口は、箱の高さと余裕以上ある", () => {
    expect(WOOD_SUPPORT.leg.length).toBe(STORAGE_BOX.height + STORAGE_CLEARANCE);
    expect(WOOD_SUPPORT.leg.length).toBeGreaterThanOrEqual(STORAGE_BOX.height + STORAGE_CLEARANCE);
  });

  it("DIYデザイン脚と根太受けを買わず、検討前の合計以下になる", () => {
    expect(WOOD_SUPPORT.leg.name).not.toBe(FRAME_HARDWARE.leg.name);
    expect(PURCHASE_ITEMS.some((item) => item.name === FRAME_HARDWARE.leg.name)).toBe(false);
    expect(PURCHASE_ITEMS.some((item) => item.name === FRAME_HARDWARE.joistHanger.name)).toBe(
      false,
    );
    expect(PROJECT_COST.frameHardwareCost).toBe(0);
    expect(PROJECT_COST).toMatchObject({
      lumberCost: 10924,
      cutCost: 2850,
      fastenerCost: 4246,
      totalCost: 18020,
    });
    expect(PROJECT_COST.totalCost).toBeLessThanOrEqual(PRECHANGE_TOTAL);
    expect(PROJECT_COST.totalCost).toBe(
      PROJECT_COST.lumberCost +
        PROJECT_COST.cutCost +
        PROJECT_COST.fastenerCost +
        PROJECT_COST.frameHardwareCost,
    );
  });

  it("脚と受け材を足しても、定尺の本数は増えない", () => {
    expect(FRAME_CUT_PLAN.stocks.map((stock) => [stock.id, stock.boardCount])).toEqual([
      ["1x4", 7],
      ["2x4", 5],
    ]);
    expect(FRAME_CUT_PLAN.pieceCount).toBe(WOOD_SUPPORT.leg.count + WOOD_SUPPORT.seat.count + 40);
  });
});
