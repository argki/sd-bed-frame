import { describe, expect, it } from "vitest";
import { FASTENER, LUMBER, LUMBER_2X4 } from "./constants";
import { CROSS_RAIL_LENGTH, FRAME_MODULES, MODULE_SIZE, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import {
  FRAME_JOINTS,
  SCREWS_PER_HANGER_SEAT,
  SCREWS_PER_LEG,
  SCREWS_PER_RAIL_END,
  SCREWS_PER_SLAT_SUPPORT,
  type ScrewJoint,
} from "./joints";
import type { Axis, Box3, Vec3 } from "./types";

const fasteners = [FASTENER.rail, FASTENER.slat];

function jointsOf(moduleId: string): ScrewJoint[] {
  return FRAME_JOINTS.filter((joint) => joint.moduleId === moduleId);
}

function placedBox(moduleId: string, partId: string, index: number): Box3 {
  const module = FRAME_MODULES.find((item) => item.id === moduleId);
  if (!module) {
    throw new Error(`モジュール ${moduleId} がない`);
  }
  const part = moduleParts(module).find((item) => item.id === partId);
  const placement = part?.placements[index];
  if (!part || !placement) {
    throw new Error(`部材 ${partId} の ${index} 本目がない`);
  }
  return placementBox(part.length, placement, part.section);
}

function axisOf(point: Vec3, axis: Axis): number {
  return point[axis];
}

describe("ネジ止め", () => {
  it("接合の id は重複しない", () => {
    expect(FRAME_JOINTS.length).toBeGreaterThan(0);
    expect(new Set(FRAME_JOINTS.map((joint) => joint.id)).size).toBe(FRAME_JOINTS.length);
  });

  it("頭側と足側で、上枠とすのこと受け材の留め位置は同じ", () => {
    expect(withoutModule(withoutLegs(jointsOf("foot-left")), "foot-left")).toEqual(
      withoutModule(withoutLegs(jointsOf("head-left")), "head-left"),
    );
    expect(withoutModule(withoutLegs(jointsOf("foot-right")), "foot-right")).toEqual(
      withoutModule(withoutLegs(jointsOf("head-right")), "head-right"),
    );
  });

  it("右側の上枠とすのこと受け材の留め位置は、左側を左右反転した位置になる", () => {
    const left = withoutLegs(jointsOf("head-left"));
    const right = withoutLegs(jointsOf("head-right"));
    expect(right).toHaveLength(left.length);

    for (const joint of left) {
      const mirrored = right.find(
        (item) =>
          item.fromPlacementIndex === joint.fromPlacementIndex &&
          item.intoPlacementIndex === joint.intoPlacementIndex &&
          item.positions[0]?.z === joint.positions[0]?.z &&
          item.fromPartId.replace("head-right", "") === joint.fromPartId.replace("head-left", "") &&
          item.intoPartId.replace("head-right", "") === joint.intoPartId.replace("head-left", ""),
      );
      expect(mirrored).toBeDefined();
      if (!mirrored) {
        continue;
      }
      expect(mirrored.face.axis).toBe(joint.face.axis);
      expect(mirrored.face.side).toBe(
        joint.face.axis === "x" ? opposite(joint.face.side) : joint.face.side,
      );
      expect(mirrored.fastenerId).toBe(joint.fastenerId);
      for (const [i, point] of joint.positions.entries()) {
        const other = mirrored.positions[i];
        expect(other?.x).toBeCloseTo(MODULE_SIZE.width - point.x);
        expect(other?.y).toBeCloseTo(point.y);
        expect(other?.z).toBeCloseTo(point.z);
      }
    }
  });
});

describe.each(FRAME_MODULES)("モジュール $name のネジ止め", (module) => {
  const joints = jointsOf(module.id);
  const parts = moduleParts(module);
  const rails = parts.filter((part) => part.name === "上枠");
  const cross = rails.find((part) => part.length === CROSS_RAIL_LENGTH);
  const slats = parts.find((part) => part.name === "天板のすのこ");

  it("端の上枠も中央の上枠も、長辺の上枠から木口へ留める", () => {
    expect(cross).toBeDefined();
    if (!cross) {
      return;
    }
    const boxes = cross.placements.map((placement) =>
      placementBox(cross.length, placement, cross.section),
    );
    const centerIndex = boxes.findIndex((rail) => {
      const before = boxes.some((other) => other.max.z <= rail.min.z);
      const after = boxes.some((other) => other.min.z >= rail.max.z);
      return before && after;
    });
    expect(centerIndex).toBeGreaterThanOrEqual(0);

    for (const [index] of boxes.entries()) {
      const atEnd = joints.filter(
        (joint) =>
          joint.intoPartId === cross.id &&
          joint.intoPlacementIndex === index &&
          joint.fastenerId === FASTENER.rail.id,
      );
      expect(atEnd).toHaveLength(2);
      for (const joint of atEnd) {
        expect(joint.positions).toHaveLength(SCREWS_PER_RAIL_END);
        expect(joint.fromPartId).toContain("side-rail");
        const from = placedBox(module.id, joint.fromPartId, joint.fromPlacementIndex);
        for (const point of joint.positions) {
          expect(point.y).toBeLessThanOrEqual(from.min.y + (from.max.y - from.min.y) * 0.5);
        }
      }
    }
  });

  it("すのこは、パネル桟へ上面から1本ずつ打ち、上枠へは打たない", () => {
    expect(slats).toBeDefined();
    if (!slats) {
      return;
    }
    const slatBoxes = slats.placements.map((placement) =>
      placementBox(slats.length, placement, slats.section),
    );
    const battens = parts.filter((part) => part.name === "パネル桟");
    const battenBoxes = battens.flatMap((part) =>
      part.placements.map((placement, index) => ({
        partId: part.id,
        index,
        box: placementBox(part.length, placement, part.section),
      })),
    );
    const contacts = slatBoxes.flatMap((slat, slatIndex) =>
      battenBoxes
        .filter(
          (batten) =>
            slat.min.y === batten.box.max.y &&
            overlap(slat, batten.box, "x") > 0 &&
            overlap(slat, batten.box, "z") > 0,
        )
        .map((batten) => ({ slatIndex, batten })),
    );
    expect(contacts).toHaveLength(slatBoxes.length * battenBoxes.length);
    for (const contact of contacts) {
      const matched = joints.filter(
        (joint) =>
          joint.fromPartId === slats.id &&
          joint.fromPlacementIndex === contact.slatIndex &&
          joint.intoPartId === contact.batten.partId &&
          joint.intoPlacementIndex === contact.batten.index,
      );
      expect(matched).toHaveLength(1);
      expect(matched[0]?.fastenerId).toBe(FASTENER.slat.id);
      expect(matched[0]?.positions).toHaveLength(SCREWS_PER_SLAT_SUPPORT);
      expect(matched[0]?.face).toEqual({ axis: "y", side: "max" });
    }
    expect(
      joints.some((joint) => joint.fromPartId === slats.id && joint.intoPartId.includes("rail")),
    ).toBe(false);
  });

  it("脚と受け材は、長辺の上枠に接する上面から2本留める", () => {
    const supports = parts.filter((part) => part.name === "脚" || part.name === "受け材");
    expect(supports.length).toBeGreaterThan(0);
    for (const part of supports) {
      for (const [index] of part.placements.entries()) {
        const matched = joints.filter(
          (joint) => joint.fromPartId === part.id && joint.fromPlacementIndex === index,
        );
        expect(matched).toHaveLength(1);
        expect(matched[0]?.fastenerId).toBe(
          part.name === "脚" && module.id === "head-left" && index < 2
            ? FASTENER.rail.id
            : FASTENER.slat.id,
        );
        expect(matched[0]?.positions).toHaveLength(
          part.name === "脚" ? SCREWS_PER_LEG : SCREWS_PER_HANGER_SEAT,
        );
        expect(matched[0]?.face).toEqual({ axis: "y", side: "max" });
        expect(matched[0]?.intoPartId).toContain("side-rail");
      }
    }
  });

  it("ネジは打ち込む面にあり、相手の中へ入る", () => {
    for (const joint of joints) {
      const fastener = fasteners.find((item) => item.id === joint.fastenerId);
      expect(fastener).toBeDefined();
      if (!fastener) {
        continue;
      }
      const from = placedBox(module.id, joint.fromPartId, joint.fromPlacementIndex);
      const axis = joint.face.axis;
      const inward = joint.face.side === "min" ? 1 : -1;
      const faceValue = joint.face.side === "min" ? from.min[axis] : from.max[axis];
      const thickness = from.max[axis] - from.min[axis];

      for (const point of joint.positions) {
        expect(axisOf(point, axis)).toBeCloseTo(faceValue);
        const into = placedBox(module.id, joint.intoPartId, joint.intoPlacementIndex);
        const staysInSupport = fastener.length <= thickness;
        if (staysInSupport) {
          const tip = shift(point, axis, inward * (fastener.length - 1));
          expect(strictlyInside(from, tip)).toBe(true);
          expect(inward < 0 ? into.min[axis] : into.max[axis]).toBeCloseTo(faceValue);
        } else {
          expect(fastener.length).toBeGreaterThan(thickness);
          const contact = faceValue + inward * thickness;
          expect(inward > 0 ? into.min[axis] : into.max[axis]).toBeCloseTo(contact);
          const entered = shift(point, axis, inward * (thickness + 1));
          expect(strictlyInside(into, entered)).toBe(true);
        }
        for (const other of otherAxes(axis)) {
          expect(axisOf(point, other)).toBeGreaterThanOrEqual(
            Math.max(from.min[other], into.min[other]) + fastener.diameter / 2,
          );
          expect(axisOf(point, other)).toBeLessThanOrEqual(
            Math.min(from.max[other], into.max[other]) - fastener.diameter / 2,
          );
        }
      }
    }
  });

  it("同じモジュールのネジどうしが当たらない", () => {
    const shafts = joints.flatMap((joint) => {
      const fastener = fasteners.find((item) => item.id === joint.fastenerId);
      if (!fastener) {
        return [];
      }
      const inward = joint.face.side === "min" ? 1 : -1;
      return joint.positions.map((point) => ({
        start: point,
        end: shift(point, joint.face.axis, inward * fastener.length),
        radius: fastener.diameter / 2,
      }));
    });
    for (const [i, a] of shafts.entries()) {
      for (const b of shafts.slice(i + 1)) {
        expect(segmentDistance(a.start, a.end, b.start, b.end)).toBeGreaterThanOrEqual(
          a.radius + b.radius - 0.01,
        );
      }
    }
  });
});

function withoutModule(joints: readonly ScrewJoint[], moduleId: string): ScrewJoint[] {
  return joints.map((joint) => ({
    ...joint,
    id: joint.id.replaceAll(moduleId, "module"),
    moduleId: "module",
    fromPartId: joint.fromPartId.replaceAll(moduleId, "module"),
    intoPartId: joint.intoPartId.replaceAll(moduleId, "module"),
  }));
}

function withoutLegs(joints: readonly ScrewJoint[]): ScrewJoint[] {
  return joints.filter((joint) => !joint.fromPartId.endsWith("-leg"));
}

function opposite(side: "min" | "max"): "min" | "max" {
  return side === "min" ? "max" : "min";
}

function otherAxes(axis: Axis): Axis[] {
  return (["x", "y", "z"] as const).filter((item) => item !== axis);
}

function shift(point: Vec3, axis: Axis, distance: number): Vec3 {
  return { ...point, [axis]: point[axis] + distance };
}

function strictlyInside(box: Box3, point: Vec3): boolean {
  return (
    point.x > box.min.x &&
    point.x < box.max.x &&
    point.y > box.min.y &&
    point.y < box.max.y &&
    point.z > box.min.z &&
    point.z < box.max.z
  );
}

describe("コーススレッド", () => {
  it("木口用は長辺の厚みより長く、下面から打つネジは上枠の高さより短い", () => {
    expect(FASTENER.rail.length).toBeGreaterThan(LUMBER_2X4.thickness);
    expect(FASTENER.slat.length).toBeGreaterThan(LUMBER.thickness);
    expect(FASTENER.slat.length).toBeLessThan(LUMBER_2X4.width);
  });
});

function overlap(a: Box3, b: Box3, axis: Axis): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
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
  return lengthOf(subtract(add(a0, scale(d1, s)), add(b0, scale(d2, t))));
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
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
