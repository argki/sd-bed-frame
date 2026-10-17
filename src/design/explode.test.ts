import { describe, expect, it } from "vitest";
import { LUMBER, MATTRESS } from "./constants";
import { FRAME_CUT_PLAN, pieceLabel } from "./cut-plan";
import { explodedPosition, MODULE_EXPLODE_DISTANCE } from "./explode";
import { FRAME_HEIGHT, FRAME_MODULES, FRAME_PARTS, MODULE_SIZE } from "./frame";
import { intersects } from "./geometry";
import { type Box3, placedSize, type Vec3 } from "./types";

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

  it("部材分解では、左右の境で接していた上枠とすのこが重ならない", () => {
    const boxes = explodedPartBoxes();
    const seam = MODULE_SIZE.width;
    const pairs = boxes.flatMap((left, index) =>
      boxes.slice(index + 1).flatMap((right) => {
        if (left.moduleId === right.moduleId) {
          return [];
        }
        const touchesSeam =
          (left.assembled.max.x === seam && right.assembled.min.x === seam) ||
          (right.assembled.max.x === seam && left.assembled.min.x === seam);
        return touchesSeam ? [[left, right] as const] : [];
      }),
    );

    expect(pairs.length).toBeGreaterThan(0);
    for (const [left, right] of pairs) {
      expect(intersects(left.box, right.box), `${left.label} と ${right.label}`).toBe(false);
      expect(separation(left.box, right.box)).toBeGreaterThanOrEqual(LUMBER.width);
    }
  });
});

function explodedPartBoxes(): {
  label: string;
  moduleId: string;
  box: Box3;
  assembled: Box3;
}[] {
  const bedCenter = { x: MATTRESS.width / 2, y: FRAME_HEIGHT / 2, z: MATTRESS.length / 2 };
  const centers = new Map(
    FRAME_MODULES.map((module) => [
      module.id,
      {
        x: module.origin.x + MODULE_SIZE.width / 2,
        y: FRAME_HEIGHT / 2,
        z: module.origin.z + MODULE_SIZE.length / 2,
      },
    ]),
  );
  const parts = new Map(FRAME_PARTS.map((part) => [part.id, part]));

  return FRAME_CUT_PLAN.boards.flatMap((board) =>
    board.pieces.map((piece) => {
      const part = parts.get(piece.partId);
      const placementIndex = Number(piece.id.slice(piece.partId.length + 1)) - 1;
      const placement = part?.placements[placementIndex];
      const origin = FRAME_MODULES.find((module) => module.id === part?.moduleId)?.origin;
      const moduleCenter = part ? centers.get(part.moduleId) : undefined;
      if (!part || !placement || !origin || !moduleCenter) {
        throw new Error(`${pieceLabel(piece)} の位置が見つからない`);
      }
      const size = placedSize(part.length, placement, part.section);
      const center = {
        x: origin.x + placement.position.x + size.x / 2,
        y: origin.y + placement.position.y + size.y / 2,
        z: origin.z + placement.position.z + size.z / 2,
      };
      const exploded = explodedPosition(center, moduleCenter, bedCenter, 1, "part");
      const assembled = {
        min: {
          x: center.x - size.x / 2,
          y: center.y - size.y / 2,
          z: center.z - size.z / 2,
        },
        max: {
          x: center.x + size.x / 2,
          y: center.y + size.y / 2,
          z: center.z + size.z / 2,
        },
      };
      return {
        label: pieceLabel(piece),
        moduleId: part.moduleId,
        assembled,
        box: {
          min: {
            x: exploded.x - size.x / 2,
            y: exploded.y - size.y / 2,
            z: exploded.z - size.z / 2,
          },
          max: {
            x: exploded.x + size.x / 2,
            y: exploded.y + size.y / 2,
            z: exploded.z + size.z / 2,
          },
        },
      };
    }),
  );
}

/** 重なっていなければ、最も狭い軸方向のすき間。重なっていれば負。 */
function separation(a: Box3, b: Box3): number {
  return Math.max(
    Math.max(a.min.x, b.min.x) - Math.min(a.max.x, b.max.x),
    Math.max(a.min.y, b.min.y) - Math.min(a.max.y, b.max.y),
    Math.max(a.min.z, b.min.z) - Math.min(a.max.z, b.max.z),
  );
}
