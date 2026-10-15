import { describe, expect, it } from "vitest";
import { FASTENER, LUMBER, MODULE_BOLT } from "./constants";
import { FRAME_MODULES, moduleParts, STORAGE_CLEAR_HEIGHT } from "./frame";
import { placementBox } from "./geometry";
import { FRAME_JOINTS } from "./joints";
import { BOLTS_PER_MODULE_JOINT, boltLengthForGrip, MODULE_JOINTS } from "./module-joints";
import type { Axis, Box3, FrameModule } from "./types";

type Post = {
  readonly moduleId: string;
  readonly partId: string;
  readonly placementIndex: number;
  readonly box: Box3;
};

describe("モジュールの連結", () => {
  const posts = FRAME_MODULES.flatMap(worldPosts);
  const touches = touchingPosts(posts);

  it("面で接している柱の組を、すべて六角ボルトで留める", () => {
    expect(MODULE_BOLT.name).not.toBe(FASTENER.rail.name);
    expect(touches.length).toBeGreaterThan(0);
    expect(MODULE_JOINTS).toHaveLength(touches.length);

    for (const touch of touches) {
      const joint = MODULE_JOINTS.find(
        (item) => item.axis === touch.axis && sameEnds(item.ends, touch.a, touch.b),
      );
      expect(joint, `${touch.a.moduleId} と ${touch.b.moduleId}`).toBeDefined();
      if (!joint) {
        continue;
      }
      const grip = span(touch.a.box, touch.axis) + span(touch.b.box, touch.axis);
      expect(joint.boltLength).toBe(boltLengthForGrip(grip));
      expect(joint.boltLength).toBeGreaterThanOrEqual(grip + MODULE_BOLT.endAllowance);
      expect(joint.positions).toHaveLength(BOLTS_PER_MODULE_JOINT);
      const across = touch.axis === "x" ? "z" : "x";
      const acrossMin = Math.max(touch.a.box.min[across], touch.b.box.min[across]);
      const acrossMax = Math.min(touch.a.box.max[across], touch.b.box.max[across]);
      for (const point of joint.positions) {
        expect(point[touch.axis]).toBe(contactOf(touch.a.box, touch.b.box, touch.axis));
        expect(point[across]).toBeGreaterThanOrEqual(acrossMin + MODULE_BOLT.diameter / 2);
        expect(point[across]).toBeLessThanOrEqual(acrossMax - MODULE_BOLT.diameter / 2);
        expect(point.y).toBeGreaterThan(LUMBER.width);
        expect(point.y).toBeLessThan(STORAGE_CLEAR_HEIGHT);
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

  it("角の柱では、直交するボルトの高さがボルト径より離れる", () => {
    const byPost = new Map<string, number[]>();
    for (const joint of MODULE_JOINTS) {
      for (const end of joint.ends) {
        const key = `${end.partId}#${end.placementIndex}`;
        const heights = byPost.get(key) ?? [];
        heights.push(...joint.positions.map((point) => point.y));
        byPost.set(key, heights);
      }
    }
    for (const heights of byPost.values()) {
      const sorted = [...heights].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect((sorted[i] ?? 0) - (sorted[i - 1] ?? 0)).toBeGreaterThan(MODULE_BOLT.diameter);
      }
    }
  });
});

function worldPosts(module: FrameModule): Post[] {
  return moduleParts(module).flatMap((part) => {
    if (part.name !== "柱") {
      return [];
    }
    return part.placements.map((placement, placementIndex) => {
      const local = placementBox(part.length, placement);
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

function touchingPosts(posts: readonly Post[]): { a: Post; b: Post; axis: "x" | "z" }[] {
  const touches: { a: Post; b: Post; axis: "x" | "z" }[] = [];
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i];
      const b = posts[j];
      if (!a || !b || a.moduleId === b.moduleId) {
        continue;
      }
      for (const axis of ["x", "z"] as const) {
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

function sameEnds(
  ends: readonly [
    { moduleId: string; placementIndex: number },
    { moduleId: string; placementIndex: number },
  ],
  a: Post,
  b: Post,
): boolean {
  const keys = ends.map((end) => `${end.moduleId}#${end.placementIndex}`).sort();
  const expected = [
    `${a.moduleId}#${a.placementIndex}`,
    `${b.moduleId}#${b.placementIndex}`,
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
