import { describe, expect, it } from "vitest";
import { FASTENER, LUMBER_2X4, MODULE_BOLT, MODULE_FASTENER } from "./constants";
import { FRAME_MODULES, moduleParts, STORAGE_CLEAR_HEIGHT } from "./frame";
import { intersects, placementBox } from "./geometry";
import { FRAME_JOINTS } from "./joints";
import { BOLTS_PER_MODULE_JOINT, boltLengthForGrip, MODULE_JOINTS } from "./module-joints";
import type { Axis, Box3, FrameModule, Vec3 } from "./types";

type Post = {
  readonly moduleId: string;
  readonly partId: string;
  readonly placementIndex: number;
  readonly box: Box3;
};

describe("モジュールの連結", () => {
  const rails = FRAME_MODULES.flatMap(worldRails);
  const touches = touchingRails(rails);

  it("厚みの面で接している上枠を、ボルトとナットで留める", () => {
    expect(MODULE_BOLT.name).not.toBe(FASTENER.rail.name);
    expect(touches.length).toBeGreaterThan(0);
    expect(MODULE_JOINTS).toHaveLength(touches.length);
    expect(rails.some((rail) => rail.partId.includes("post"))).toBe(false);

    for (const touch of touches) {
      const joint = MODULE_JOINTS.find(
        (item) => item.axis === touch.axis && sameEnds(item.ends, touch.a, touch.b),
      );
      expect(joint, `${touch.a.moduleId} と ${touch.b.moduleId}`).toBeDefined();
      if (!joint) {
        continue;
      }
      const grip = span(touch.a.box, touch.axis) + span(touch.b.box, touch.axis);
      expect(grip).toBe(LUMBER_2X4.thickness * 2);
      expect(joint.boltLength).toBe(boltLengthForGrip(grip));
      expect(joint.boltLength).toBeGreaterThanOrEqual(grip + MODULE_BOLT.endAllowance);
      expect(joint.positions).toHaveLength(BOLTS_PER_MODULE_JOINT);
      const across = touch.axis === "x" ? "z" : "x";
      const acrossMin = Math.max(touch.a.box.min[across], touch.b.box.min[across]);
      const acrossMax = Math.min(touch.a.box.max[across], touch.b.box.max[across]);
      const yMin = Math.max(touch.a.box.min.y, touch.b.box.min.y);
      const yMax = Math.min(touch.a.box.max.y, touch.b.box.max.y);
      for (const point of joint.positions) {
        expect(point[touch.axis]).toBe(contactOf(touch.a.box, touch.b.box, touch.axis));
        expect(point[across]).toBeGreaterThanOrEqual(acrossMin + MODULE_BOLT.diameter / 2);
        expect(point[across]).toBeLessThanOrEqual(acrossMax - MODULE_BOLT.diameter / 2);
        expect(point.y).toBeGreaterThan(yMin);
        expect(point.y).toBeLessThan(yMax);
      }
    }
  });

  it("各モジュールは、隣り合うモジュールとだけ連結する", () => {
    const partners = new Map<string, Set<string>>();
    for (const joint of MODULE_JOINTS) {
      const [a, b] = joint.ends;
      partners.get(a.moduleId)?.add(b.moduleId) ?? partners.set(a.moduleId, new Set([b.moduleId]));
      partners.get(b.moduleId)?.add(a.moduleId) ?? partners.set(b.moduleId, new Set([a.moduleId]));
    }
    expect(partners.get("head-left")).toEqual(new Set(["head-right", "foot-left"]));
    expect(partners.get("head-right")).toEqual(new Set(["head-left", "foot-right"]));
    expect(partners.get("foot-left")).toEqual(new Set(["head-left", "foot-right"]));
    expect(partners.get("foot-right")).toEqual(new Set(["head-right", "foot-left"]));
  });

  it("モジュールの中のコーススレッドは、モジュールをまたがない", () => {
    for (const joint of FRAME_JOINTS) {
      expect(joint.fromPartId.startsWith(joint.moduleId)).toBe(true);
      expect(joint.intoPartId.startsWith(joint.moduleId)).toBe(true);
    }
  });

  it("寸切ボルトは購入した長さのままで、パネル桟と開口に入らない", () => {
    expect(MODULE_FASTENER.acrossWidth.length).toBe(MODULE_FASTENER.acrossWidth.stockLength);
    const radius = MODULE_BOLT.diameter / 2;
    const battens = battenBoxes();
    for (const joint of MODULE_JOINTS) {
      for (const point of joint.positions) {
        const start = Math.min(...jointEnds(joint).map((end) => end.box.min[joint.axis]));
        const shaft = {
          min: {
            x: point.x - radius,
            y: point.y - radius,
            z: point.z - radius,
            [joint.axis]: start,
          },
          max: {
            x: point.x + radius,
            y: point.y + radius,
            z: point.z + radius,
            [joint.axis]: start + joint.boltLength,
          },
        };
        for (const batten of battens) {
          expect(intersects(shaft, batten)).toBe(false);
        }
        expect(shaft.min.y).toBeGreaterThanOrEqual(STORAGE_CLEAR_HEIGHT);
      }
    }
  });

  it("ボルトは、モジュール内のネジに当たらない", () => {
    const bolts = MODULE_JOINTS.flatMap((joint) =>
      joint.positions.map((point) => ({
        start: {
          ...point,
          [joint.axis]: Math.min(...jointEnds(joint).map((end) => end.box.min[joint.axis])),
        },
        end: {
          ...point,
          [joint.axis]:
            Math.min(...jointEnds(joint).map((end) => end.box.min[joint.axis])) + joint.boltLength,
        },
        radius: MODULE_BOLT.diameter / 2,
      })),
    );
    const screws = screwShafts();
    for (const bolt of bolts) {
      for (const screw of screws) {
        expect(
          segmentDistance(bolt.start, bolt.end, screw.start, screw.end),
        ).toBeGreaterThanOrEqual(bolt.radius + screw.radius - 0.01);
      }
    }
  });
});

function battenBoxes(): Box3[] {
  return FRAME_MODULES.flatMap((module) =>
    moduleParts(module)
      .filter((part) => part.name === "パネル桟")
      .flatMap((part) =>
        part.placements.map((placement) => {
          const local = placementBox(part.length, placement, part.section);
          return {
            min: {
              x: module.origin.x + local.min.x,
              y: module.origin.y + local.min.y,
              z: module.origin.z + local.min.z,
            },
            max: {
              x: module.origin.x + local.max.x,
              y: module.origin.y + local.max.y,
              z: module.origin.z + local.max.z,
            },
          };
        }),
      ),
  );
}

function worldRails(module: FrameModule): Post[] {
  return moduleParts(module).flatMap((part) => {
    if (part.name !== "上枠") {
      return [];
    }
    return part.placements.map((placement, placementIndex) => {
      const local = placementBox(part.length, placement, part.section);
      return {
        moduleId: module.id,
        partId: part.id,
        placementIndex,
        box: {
          min: {
            x: local.min.x + module.origin.x,
            y: local.min.y + module.origin.y,
            z: local.min.z + module.origin.z,
          },
          max: {
            x: local.max.x + module.origin.x,
            y: local.max.y + module.origin.y,
            z: local.max.z + module.origin.z,
          },
        },
      };
    });
  });
}

function touchingRails(rails: readonly Post[]): { a: Post; b: Post; axis: "x" | "z" }[] {
  const touches: { a: Post; b: Post; axis: "x" | "z" }[] = [];
  for (let i = 0; i < rails.length; i++) {
    for (let j = i + 1; j < rails.length; j++) {
      const a = rails[i];
      const b = rails[j];
      if (!a || !b || a.moduleId === b.moduleId) {
        continue;
      }
      for (const axis of ["x", "z"] as const) {
        if (
          span(a.box, axis) !== LUMBER_2X4.thickness ||
          span(b.box, axis) !== LUMBER_2X4.thickness
        ) {
          continue;
        }
        const [u, v] = axis === "x" ? (["y", "z"] as const) : (["x", "y"] as const);
        if (overlap(a.box, b.box, u) <= 0 || overlap(a.box, b.box, v) <= 0) {
          continue;
        }
        if (a.box.max[axis] === b.box.min[axis] || b.box.max[axis] === a.box.min[axis]) {
          touches.push({ a, b, axis });
        }
      }
    }
  }
  return touches;
}

function jointEnds(joint: (typeof MODULE_JOINTS)[number]): Post[] {
  return joint.ends.map((end) => {
    const rail = FRAME_MODULES.flatMap(worldRails).find(
      (item) =>
        item.moduleId === end.moduleId &&
        item.partId === end.partId &&
        item.placementIndex === end.placementIndex,
    );
    if (!rail) {
      throw new Error(`${end.partId} が見つからない`);
    }
    return rail;
  });
}

function screwShafts(): { start: Vec3; end: Vec3; radius: number }[] {
  return FRAME_MODULES.flatMap((module) => {
    const fasteners = [FASTENER.rail, FASTENER.slat];
    return FRAME_JOINTS.filter((joint) => joint.moduleId === module.id).flatMap((joint) => {
      const fastener = fasteners.find((item) => item.id === joint.fastenerId);
      if (!fastener) {
        return [];
      }
      const inward = joint.face.side === "min" ? 1 : -1;
      return joint.positions.map((point) => {
        const start = {
          x: point.x + module.origin.x,
          y: point.y + module.origin.y,
          z: point.z + module.origin.z,
        };
        return {
          start,
          end: { ...start, [joint.face.axis]: start[joint.face.axis] + inward * fastener.length },
          radius: fastener.diameter / 2,
        };
      });
    });
  });
}

function sameEnds(
  ends: readonly [
    { moduleId: string; partId: string; placementIndex: number },
    { moduleId: string; partId: string; placementIndex: number },
  ],
  a: Post,
  b: Post,
): boolean {
  const keys = ends.map((end) => `${end.moduleId}#${end.partId}#${end.placementIndex}`).sort();
  const expected = [
    `${a.moduleId}#${a.partId}#${a.placementIndex}`,
    `${b.moduleId}#${b.partId}#${b.placementIndex}`,
  ].sort();
  return keys[0] === expected[0] && keys[1] === expected[1];
}

function contactOf(a: Box3, b: Box3, axis: "x" | "z"): number {
  return a.max[axis] === b.min[axis] ? a.max[axis] : b.max[axis];
}

function overlap(a: Box3, b: Box3, axis: Axis): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function span(box: Box3, axis: Axis): number {
  return box.max[axis] - box.min[axis];
}

function segmentDistance(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): number {
  const d1 = subtract(a1, a0);
  const d2 = subtract(b1, b0);
  const r = subtract(a0, b0);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= 1e-8 && e <= 1e-8) {
    return lengthOf(r);
  }
  if (a <= 1e-8) {
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= 1e-8) {
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  return lengthOf(subtract(addVec(a0, scale(d1, s)), addVec(b0, scale(d2, t))));
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(value: Vec3, factor: number): Vec3 {
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function lengthOf(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
