import { describe, expect, it } from "vitest";
import { LUMBER, PRICE } from "./constants";
import { createCutPlan, expandParts } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import type { Part, PartPlacement } from "./types";

const placement: PartPlacement = {
  position: { x: 0, y: 0, z: 0 },
  lengthAxis: "x",
  widthAxis: "y",
};

function part(id: string, length: number, count: number): Part {
  return {
    id,
    name: id,
    moduleId: "test",
    length,
    placements: Array.from({ length: count }, () => placement),
  };
}

describe("expandParts", () => {
  it("置き方の数だけ、切り出す部材を作る", () => {
    expect(expandParts([part("side", 500, 3)])).toEqual([
      expect.objectContaining({ id: "side-1", length: 500 }),
      expect.objectContaining({ id: "side-2", length: 500 }),
      expect.objectContaining({ id: "side-3", length: 500 }),
    ]);
  });
});

describe("createCutPlan", () => {
  it("長い部材から、収まる最初の材へ詰める", () => {
    const plan = createCutPlan([part("long", 600, 2), part("short", 300, 2)], 1000, 10);

    expect(plan.boards.map((board) => board.pieces.map((piece) => piece.length))).toEqual([
      [600, 300],
      [600, 300],
    ]);
    expect(plan.boards.map((board) => board.remainingLength)).toEqual([80, 80]);
  });

  it("部材とカットロスの合計が材の長さを超えない", () => {
    const plan = createCutPlan(FRAME_PARTS);

    for (const board of plan.boards) {
      expect(board.usedLength).toBeLessThanOrEqual(LUMBER.length);
      expect(board.remainingLength).toBe(LUMBER.length - board.usedLength);
    }
  });

  it("フレームの全部材を重複や欠落なく割り当てる", () => {
    const expected = expandParts(FRAME_PARTS)
      .map((piece) => piece.id)
      .sort();
    const actual = createCutPlan(FRAME_PARTS)
      .boards.flatMap((board) => board.pieces.map((piece) => piece.id))
      .sort();

    expect(actual).toEqual(expected);
  });

  it("フレームの木取り本数とカット回数を求める", () => {
    const plan = createCutPlan(FRAME_PARTS);

    expect(plan.boardCount).toBe(11);
    expect(plan.pieceCount).toBe(64);
    expect(plan.cutCount).toBe(64);
  });

  it("材料費、カット代、合計を求める", () => {
    const plan = createCutPlan(FRAME_PARTS);

    expect(plan.cost).toEqual({
      materialCost: plan.boardCount * PRICE.lumber,
      cutCost: plan.cutCount * PRICE.cut,
      totalCost: plan.boardCount * PRICE.lumber + plan.cutCount * PRICE.cut,
    });
  });

  it("材の端まで使い切る場合は最後のカットを数えない", () => {
    const plan = createCutPlan([part("exact", 495, 2)], 1000, 10);

    expect(plan.boards[0]).toMatchObject({
      usedLength: 1000,
      remainingLength: 0,
      cutCount: 1,
    });
  });

  it("材より長い部材をエラーにする", () => {
    expect(() => createCutPlan([part("too-long", 1001, 1)], 1000, 3)).toThrow(
      "材（1000mm）より長い",
    );
  });

  it("カットロスを木取りへ反映する", () => {
    const parts = [part("piece", 498, 2)];

    expect(createCutPlan(parts, 1000, 1).boardCount).toBe(1);
    expect(createCutPlan(parts, 1000, 3).boardCount).toBe(2);
  });
});
