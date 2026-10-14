import { describe, expect, it } from "vitest";
import { PART_SUMMARY, PURCHASE_ITEMS, summarizeParts } from "./materials";
import type { Part } from "./types";

describe("summarizeParts", () => {
  it("名前と長さが同じ部材の本数を合計する", () => {
    const parts: Part[] = [
      {
        id: "a",
        name: "側板",
        moduleId: "m1",
        length: 500,
        placements: [
          { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" },
          { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" },
        ],
      },
      {
        id: "b",
        name: "側板",
        moduleId: "m2",
        length: 500,
        placements: [{ position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" }],
      },
    ];

    expect(summarizeParts(parts)).toEqual([{ name: "側板", length: 500, quantity: 3 }]);
  });
});

describe("表示用の部材集計", () => {
  it("切り出す全部材を集計する", () => {
    expect(PART_SUMMARY.reduce((sum, row) => sum + row.quantity, 0)).toBe(108);
  });

  it("購入する12f材の小計が単価と本数に一致する", () => {
    for (const item of PURCHASE_ITEMS) {
      expect(item.subtotal).toBe(item.unitPrice * item.quantity);
    }
  });
});
