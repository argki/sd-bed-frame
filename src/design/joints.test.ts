import { describe, expect, it } from "vitest";
import { FASTENER, LUMBER } from "./constants";
import { FRAME_MODULES, MODULE_SIZE, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import { FRAME_JOINTS, type ScrewJoint } from "./joints";
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
  it("柱と下横桟がないので、そのネジ止めは生成されない", () => {
    expect(FRAME_JOINTS).toHaveLength(0);
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

  it("ネジは打ち込む面にあり、相手の部材の木口へ入る", () => {
    for (const joint of joints) {
      const fastener = fasteners.find((item) => item.id === joint.fastenerId);
      expect(fastener).toBeDefined();
      if (!fastener) {
        continue;
      }
      const from = placedBox(module.id, joint.fromPartId, joint.fromPlacementIndex);
      const into = placedBox(module.id, joint.intoPartId, joint.intoPlacementIndex);
      const axis = joint.face.axis;
      const inward = joint.face.side === "min" ? 1 : -1;
      const thickness = from.max[axis] - from.min[axis];
      const faceValue = joint.face.side === "min" ? from.min[axis] : from.max[axis];
      const contact = faceValue + inward * thickness;

      expect(fastener.length).toBeGreaterThan(thickness);
      expect(inward > 0 ? into.min[axis] : into.max[axis]).toBeCloseTo(contact);

      for (const point of joint.positions) {
        expect(axisOf(point, axis)).toBeCloseTo(faceValue);
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
  it("横桟用は柱の幅より長く、すのこ用は板厚より長い", () => {
    expect(FASTENER.rail.length).toBeGreaterThan(LUMBER.width);
    expect(FASTENER.slat.length).toBeGreaterThan(LUMBER.thickness);
    expect(FASTENER.slat.length - LUMBER.thickness).toBeLessThanOrEqual(LUMBER.width);
  });
});
