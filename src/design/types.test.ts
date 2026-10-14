import { describe, expect, it } from "vitest";
import { LUMBER } from "./constants";
import { type Part, partCount, placedSize } from "./types";

describe("placedSize", () => {
  it("長さ方向に部材の長さ、幅方向に材の幅、残りの軸に材の厚みを割り当てる", () => {
    expect(
      placedSize(1000, { position: { x: 0, y: 0, z: 0 }, lengthAxis: "z", widthAxis: "y" }),
    ).toEqual({ x: LUMBER.thickness, y: LUMBER.width, z: 1000 });
  });

  it("寝かせて置いた部材は高さが材の厚みになる", () => {
    expect(
      placedSize(500, { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "z" }),
    ).toEqual({ x: 500, y: LUMBER.thickness, z: LUMBER.width });
  });

  it("長さ方向と幅方向が同じ軸ならエラーにする", () => {
    expect(() =>
      placedSize(500, { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "x" }),
    ).toThrow();
  });
});

describe("partCount", () => {
  it("置き方の数を本数とする", () => {
    const part: Part = {
      id: "side",
      name: "側板",
      moduleId: "m1",
      length: 900,
      placements: [
        { position: { x: 0, y: 0, z: 0 }, lengthAxis: "z", widthAxis: "y" },
        { position: { x: 0, y: LUMBER.width, z: 0 }, lengthAxis: "z", widthAxis: "y" },
      ],
    };
    expect(partCount(part)).toBe(2);
  });
});
