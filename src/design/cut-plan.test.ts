import { describe, expect, it } from "vitest";
import { LUMBER, LUMBER_2X4, PRICE } from "./constants";
import { createCutPlan, expandParts, pieceLabel } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import type { Part, PartPlacement } from "./types";

const placement: PartPlacement = {
  position: { x: 0, y: 0, z: 0 },
  lengthAxis: "x",
  widthAxis: "y",
};

function part(id: string, length: number, count: number, name = id): Part {
  return {
    id,
    name,
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
      expect(board.usedLength).toBeLessThanOrEqual(board.stockLength);
      expect(board.remainingLength).toBe(board.stockLength - board.usedLength);
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

  it("カット寸法図の左から、種類ごとに連番を付ける", () => {
    const plan = createCutPlan(FRAME_PARTS);
    const labels = plan.boards.map((board) => board.pieces.map((piece) => pieceLabel(piece)));

    expect(labels[0]).toEqual(["天板のすのこ 1", "天板のすのこ 2", "天板のすのこ 3", "パネル桟 1"]);
    expect(
      plan.stocks.find((stock) => stock.id === "2x4")?.boards[0]?.pieces.map(pieceLabel),
    ).toEqual(["上枠 1", "上枠 2", "上枠 3", "上枠 4", "受け材 1", "受け材 2"]);

    const byName = new Map<string, number[]>();
    for (const piece of plan.boards.flatMap((board) => board.pieces)) {
      const serials = byName.get(piece.name) ?? [];
      serials.push(piece.serial);
      byName.set(piece.name, serials);
    }
    for (const serials of byName.values()) {
      expect(serials).toEqual(serials.map((_, index) => index + 1));
    }
  });

  it("フレームの木取り本数とカット回数を求める", () => {
    const plan = createCutPlan(FRAME_PARTS);

    expect(plan.stocks.map((stock) => [stock.id, stock.boardCount])).toEqual([
      ["1x4", 7],
      ["2x4", 5],
    ]);
    expect(plan.boardCount).toBe(12);
    expect(plan.pieceCount).toBe(65);
    expect(plan.cutCount).toBe(65);
  });

  it("すのこは 1x4、上枠は 2x4 の材料費で求める", () => {
    const plan = createCutPlan(FRAME_PARTS);
    const slatStock = plan.stocks.find((stock) => stock.id === "1x4");
    const railStock = plan.stocks.find((stock) => stock.id === "2x4");

    expect(
      slatStock?.boards.every((board) =>
        board.pieces.every((piece) => piece.name === "天板のすのこ" || piece.name === "パネル桟"),
      ),
    ).toBe(true);
    expect(
      railStock?.boards.every((board) =>
        board.pieces.every((piece) => ["上枠", "脚", "受け材"].includes(piece.name)),
      ),
    ).toBe(true);
    expect(plan.cost).toEqual({
      materialCost: 7 * PRICE.lumber + 5 * PRICE.lumber2x4,
      cutCost: plan.cutCount * PRICE.cut,
      totalCost: 7 * PRICE.lumber + 5 * PRICE.lumber2x4 + plan.cutCount * PRICE.cut,
    });
  });

  it("断面が違う部材を、長さが足りても同じ材に入れない", () => {
    const plan = createCutPlan(
      [part("slat", 1000, 1), { ...part("rail", 1000, 1), section: LUMBER_2X4 }],
      LUMBER.length,
      3,
    );

    expect(plan.boardCount).toBe(2);
    expect(plan.stocks.map((stock) => stock.id)).toEqual(["1x4", "2x4"]);
    expect(plan.cost.materialCost).toBe(PRICE.lumber + PRICE.lumber2x4);
  });

  it("登録していない断面をエラーにする", () => {
    expect(() =>
      createCutPlan([{ ...part("odd", 100, 1), section: { thickness: 10, width: 10 } }]),
    ).toThrow("材種がない");
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
