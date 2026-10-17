import { describe, expect, it } from "vitest";
import { LUMBER, MATTRESS } from "./constants";
import { FRAME_CUT_PLAN, pieceLabel } from "./cut-plan";
import { explodedPosition, MODULE_EXPLODE_DISTANCE, panelGroupCenters } from "./explode";
import { FRAME_HEIGHT, FRAME_MODULES, FRAME_PARTS, MODULE_SIZE } from "./frame";
import { intersects } from "./geometry";
import { isPanelPart } from "./panel";
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

  it("部材分解では、すのこ5枚とパネル桟が相対位置を保って上へ離れる", () => {
    const module = FRAME_MODULES[0];
    if (!module) {
      throw new Error("モジュールがない");
    }
    const group = panelGroupCenters().get(module.id);
    const moduleCenter = {
      x: module.origin.x + MODULE_SIZE.width / 2,
      y: FRAME_HEIGHT / 2,
      z: module.origin.z + MODULE_SIZE.length / 2,
    };
    const members = panelMemberCenters(module.id);
    expect(members.filter((member) => member.name === "天板のすのこ")).toHaveLength(5);
    expect(members.filter((member) => member.name === "パネル桟")).toHaveLength(2);
    expect(group).toBeDefined();
    if (!group) {
      return;
    }
    const moved = members.map((member) =>
      explodedPosition(member.center, moduleCenter, bedCenter, 1, "part", group),
    );
    const origin = members[0];
    const originMoved = moved[0];
    if (!origin || !originMoved) {
      throw new Error("パネルの部材がない");
    }
    for (const [index, member] of members.entries()) {
      const next = moved[index];
      if (!next) {
        throw new Error("分解後の位置がない");
      }
      expect(next.x - member.center.x).toBeCloseTo(originMoved.x - origin.center.x);
      expect(next.y - member.center.y).toBeCloseTo(originMoved.y - origin.center.y);
      expect(next.z - member.center.z).toBeCloseTo(originMoved.z - origin.center.z);
    }
    expect(originMoved.y).toBeGreaterThan(origin.center.y);
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
  const groups = panelGroupCenters();
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
      const group = part && isPanelPart(part.name) ? groups.get(part.moduleId) : undefined;
      const exploded = explodedPosition(center, moduleCenter, bedCenter, 1, "part", group);
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

function panelMemberCenters(moduleId: string): { name: string; center: Vec3 }[] {
  const origin = FRAME_MODULES.find((module) => module.id === moduleId)?.origin;
  if (!origin) {
    throw new Error(`モジュール ${moduleId} の原点が見つからない`);
  }
  return FRAME_PARTS.filter((part) => part.moduleId === moduleId && isPanelPart(part.name)).flatMap(
    (part) =>
      part.placements.map((placement) => {
        const size = placedSize(part.length, placement, part.section);
        return {
          name: part.name,
          center: {
            x: origin.x + placement.position.x + size.x / 2,
            y: origin.y + placement.position.y + size.y / 2,
            z: origin.z + placement.position.z + size.z / 2,
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
