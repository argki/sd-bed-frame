import { describe, expect, it } from "vitest";
import { FASTENER, FRAME_HARDWARE, LUMBER, LUMBER_2X4 } from "./constants";
import {
  CROSS_RAIL_LENGTH,
  FRAME_MODULES,
  MODULE_SIZE,
  moduleHardware,
  moduleParts,
} from "./frame";
import { boxFrom, intersects, placementBox } from "./geometry";
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

  it("頭側と足側で、モジュール内の留め位置は同じ", () => {
    expect(withoutModule(jointsOf("foot-left"), "foot-left")).toEqual(
      withoutModule(jointsOf("head-left"), "head-left"),
    );
    expect(withoutModule(jointsOf("foot-right"), "foot-right")).toEqual(
      withoutModule(jointsOf("head-right"), "head-right"),
    );
  });

  it("右側の留め位置は、左側を左右反転した位置になる", () => {
    const left = jointsOf("head-left");
    const right = jointsOf("head-right");
    expect(right).toHaveLength(left.length);

    for (const joint of left) {
      const mirrored = right.find(
        (item) =>
          item.fromPlacementIndex === joint.fromPlacementIndex &&
          item.intoPlacementIndex === joint.intoPlacementIndex &&
          item.positions[0]?.z === joint.positions[0]?.z &&
          item.hardwareId?.replaceAll("head-right", "") ===
            joint.hardwareId?.replaceAll("head-left", "") &&
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
      expect(mirrored.hardwareId?.replaceAll("head-right", "")).toBe(
        joint.hardwareId?.replaceAll("head-left", ""),
      );
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
  const hardware = moduleHardware(module).map((item) => ({
    ...item,
    box: boxFrom(item.position, item.size),
  }));
  const rails = parts.filter((part) => part.name === "上枠");
  const cross = rails.find((part) => part.length === CROSS_RAIL_LENGTH);
  const slats = parts.find((part) => part.name === "天板のすのこ");

  it("端の上枠は両端を、中央の上枠は根太受けごと、長辺の上枠から留める", () => {
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

    for (const [index, rail] of boxes.entries()) {
      const atEnd = joints.filter(
        (joint) =>
          joint.intoPartId === cross.id &&
          joint.intoPlacementIndex === index &&
          joint.hardwareId === undefined &&
          joint.fastenerId === FASTENER.rail.id,
      );
      expect(atEnd).toHaveLength(2);
      for (const joint of atEnd) {
        expect(joint.positions).toHaveLength(SCREWS_PER_RAIL_END);
        expect(joint.fromPartId).toContain("side-rail");
        const from = placedBox(module.id, joint.fromPartId, joint.fromPlacementIndex);
        const inward = joint.face.side === "min" ? 1 : -1;
        const thickness = from.max.x - from.min.x;
        for (const point of joint.positions) {
          expect(point.y).toBeLessThanOrEqual(from.min.y + (from.max.y - from.min.y) * 0.5);
          if (index !== centerIndex) {
            continue;
          }
          const entered = shift(point, "x", inward * (thickness + 1));
          const hanger = hardware.find(
            (item) =>
              item.name === FRAME_HARDWARE.joistHanger.name && strictlyInside(item.box, entered),
          );
          expect(hanger, "中央の上枠へ入るネジは根太受けを通る").toBeDefined();
          expect(intersects(hanger?.box ?? rail, rail)).toBe(true);
        }
      }
    }
  });

  it("すのこは、接している上枠へ上面から1本ずつ打つ", () => {
    expect(slats).toBeDefined();
    if (!slats) {
      return;
    }
    const slatBoxes = slats.placements.map((placement) =>
      placementBox(slats.length, placement, slats.section),
    );
    const railBoxes = rails.flatMap((part) =>
      part.placements.map((placement, index) => ({
        partId: part.id,
        index,
        box: placementBox(part.length, placement, part.section),
      })),
    );
    const contacts = slatBoxes.flatMap((slat, slatIndex) =>
      railBoxes
        .filter(
          (rail) =>
            slat.min.y === rail.box.max.y &&
            overlap(slat, rail.box, "x") > 0 &&
            overlap(slat, rail.box, "z") > 0,
        )
        .map((rail) => ({ slatIndex, rail })),
    );
    expect(contacts.length).toBeGreaterThan(0);
    for (const contact of contacts) {
      const matched = joints.filter(
        (joint) =>
          joint.fromPartId === slats.id &&
          joint.fromPlacementIndex === contact.slatIndex &&
          joint.intoPartId === contact.rail.partId &&
          joint.intoPlacementIndex === contact.rail.index,
      );
      expect(matched).toHaveLength(1);
      expect(matched[0]?.fastenerId).toBe(FASTENER.slat.id);
      expect(matched[0]?.positions).toHaveLength(SCREWS_PER_SLAT_SUPPORT);
      expect(matched[0]?.face).toEqual({ axis: "y", side: "max" });
    }
  });

  it("四隅の脚と、中央の上枠の根太受けを、上枠の下面から留める", () => {
    const legs = hardware.filter((item) => item.name === FRAME_HARDWARE.leg.name);
    const hangers = hardware.filter((item) => item.name === FRAME_HARDWARE.joistHanger.name);
    expect(legs).toHaveLength(4);
    expect(hangers).toHaveLength(2);

    for (const leg of legs) {
      const matched = joints.filter((joint) => joint.hardwareId === leg.id);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.fastenerId).toBe(FASTENER.slat.id);
      expect(matched[0]?.positions).toHaveLength(SCREWS_PER_LEG);
      expect(matched[0]?.face).toEqual({ axis: "y", side: "min" });
      expect(matched[0]?.fromPartId).toContain("side-rail");
    }
    for (const hanger of hangers) {
      const matched = joints.filter((joint) => joint.hardwareId === hanger.id);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.fastenerId).toBe(FASTENER.slat.id);
      expect(matched[0]?.positions).toHaveLength(SCREWS_PER_HANGER_SEAT);
      expect(matched[0]?.fromPartId).toContain("cross-rail");
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
        if (joint.hardwareId) {
          const tip = shift(point, axis, inward * (fastener.length - 1));
          expect(strictlyInside(from, tip)).toBe(true);
          continue;
        }
        const into = placedBox(module.id, joint.intoPartId, joint.intoPlacementIndex);
        expect(fastener.length).toBeGreaterThan(thickness);
        const contact = faceValue + inward * thickness;
        expect(inward > 0 ? into.min[axis] : into.max[axis]).toBeCloseTo(contact);
        const entered = shift(point, axis, inward * (thickness + 1));
        expect(strictlyInside(into, entered)).toBe(true);
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
    hardwareId: joint.hardwareId?.replaceAll(moduleId, "module"),
  }));
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
