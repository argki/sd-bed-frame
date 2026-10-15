import { describe, expect, it } from "vitest";
import { explodedPosition, MODULE_EXPLODE_DISTANCE } from "./explode";
import type { Vec3 } from "./types";

const bedCenter: Vec3 = { x: 600, y: 200, z: 975 };
const moduleCenter: Vec3 = { x: 300, y: 200, z: 400 };
const partCenter: Vec3 = { x: 280, y: 390, z: 420 };

describe("explodedPosition", () => {
  it("度合い0では組み立て位置のまま", () => {
    expect(explodedPosition(partCenter, moduleCenter, bedCenter, 0, "part")).toEqual(partCenter);
    expect(explodedPosition(partCenter, moduleCenter, bedCenter, 0, "module")).toEqual(partCenter);
  });

  it("モジュール分解では、同じモジュールの部材を同じ方向へ同じ距離だけ離す", () => {
    const otherPart: Vec3 = { x: 400, y: 20, z: 500 };
    const a = explodedPosition(partCenter, moduleCenter, bedCenter, 1, "module");
    const b = explodedPosition(otherPart, moduleCenter, bedCenter, 1, "module");

    expect(a.x - partCenter.x).toBeCloseTo(b.x - otherPart.x);
    expect(a.z - partCenter.z).toBeCloseTo(b.z - otherPart.z);
    expect(Math.hypot(a.x - partCenter.x, a.z - partCenter.z)).toBeCloseTo(MODULE_EXPLODE_DISTANCE);
    expect(a.x).toBeLessThan(partCenter.x);
    expect(a.z).toBeLessThan(partCenter.z);
    expect(a.y).toBe(partCenter.y);
  });

  it("部材分解では、モジュール中心から離れた部材ほど大きくずらす", () => {
    const near = explodedPosition(moduleCenter, moduleCenter, bedCenter, 1, "part");
    const far = explodedPosition(partCenter, moduleCenter, bedCenter, 1, "part");

    expect(near.y).toBe(moduleCenter.y);
    expect(far.y).toBeGreaterThan(partCenter.y);
    expect(Math.hypot(far.x - near.x, far.z - near.z)).toBeGreaterThan(
      Math.hypot(partCenter.x - moduleCenter.x, partCenter.z - moduleCenter.z),
    );
  });
});
