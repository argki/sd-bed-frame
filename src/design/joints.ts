import { FASTENER } from "./constants";
import { FRAME_MODULES, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import type { Axis, Box3, FrameModule, Part, Vec3 } from "./types";

/** 柱と横桟の接合1か所に打つ本数。 */
export const SCREWS_PER_RAIL_END = 2;
/** すのこと、その下で接している部材との接合1か所に打つ本数。 */
export const SCREWS_PER_SLAT_SUPPORT = 1;

export type JointFace = {
  readonly axis: Axis;
  /** min はその軸の小さい側の面。ネジはこの面から部材の内側へ打つ。 */
  readonly side: "min" | "max";
};

/** 2つの部材を留めるネジ。位置はネジを打ち込む点で、所属モジュールの原点から測る。 */
export type ScrewJoint = {
  readonly id: string;
  readonly moduleId: string;
  readonly fromPartId: string;
  readonly fromPlacementIndex: number;
  readonly intoPartId: string;
  readonly intoPlacementIndex: number;
  readonly face: JointFace;
  readonly positions: readonly Vec3[];
  readonly fastenerId: string;
};

type Placed = {
  readonly part: Part;
  readonly index: number;
  readonly box: Box3;
};

type Touch = {
  readonly side: "min" | "max";
  readonly u: Axis;
  readonly v: Axis;
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
};

export const FRAME_JOINTS: readonly ScrewJoint[] = FRAME_MODULES.flatMap(moduleJoints);

function moduleJoints(module: FrameModule): ScrewJoint[] {
  const placed = moduleParts(module).flatMap((part) =>
    part.placements.map((placement, index) => ({
      part,
      index,
      box: placementBox(part.length, placement, part.section),
    })),
  );
  const posts = placed.filter((item) => item.part.name === "柱");
  const rails = placed.filter((item) => item.part.name === "上横桟" || item.part.name === "下横桟");
  const slats = placed.filter((item) => item.part.name === "天板のすのこ");
  const supports = placed.filter((item) => item.part.name === "柱" || item.part.name === "上横桟");

  return [
    ...jointsWhere(module, posts, rails, "x", SCREWS_PER_RAIL_END, FASTENER.rail),
    ...jointsWhere(module, slats, supports, "y", SCREWS_PER_SLAT_SUPPORT, FASTENER.slat, "min"),
  ];
}

function jointsWhere(
  module: FrameModule,
  from: readonly Placed[],
  into: readonly Placed[],
  axis: Axis,
  screwCount: number,
  fastener: (typeof FASTENER)[keyof typeof FASTENER],
  fromContactSide?: "min" | "max",
): ScrewJoint[] {
  const joints: ScrewJoint[] = [];
  for (const source of from) {
    for (const target of into) {
      const touch = touchOn(source.box, target.box, axis);
      if (!touch || (fromContactSide !== undefined && touch.side !== fromContactSide)) {
        continue;
      }
      const thickness = source.box.max[axis] - source.box.min[axis];
      if (fastener.length <= thickness) {
        throw new Error(
          `ネジ ${fastener.id} の長さ ${fastener.length}mm では、${thickness}mm の部材を貫けない`,
        );
      }
      const face = { axis, side: opposite(touch.side) };
      joints.push({
        id: `${module.id}/${source.part.id}#${source.index}/${target.part.id}#${target.index}`,
        moduleId: module.id,
        fromPartId: source.part.id,
        fromPlacementIndex: source.index,
        intoPartId: target.part.id,
        intoPlacementIndex: target.index,
        face,
        positions: screwPositions(source.box, face, touch, screwCount),
        fastenerId: fastener.id,
      });
    }
  }
  return joints;
}

/** a の面が b の面に接し、その面内で面積があるとき、a 側の面と重なりを返す。 */
function touchOn(a: Box3, b: Box3, axis: Axis): Touch | undefined {
  const [u, v] = otherAxes(axis);
  const uMin = Math.max(a.min[u], b.min[u]);
  const uMax = Math.min(a.max[u], b.max[u]);
  const vMin = Math.max(a.min[v], b.min[v]);
  const vMax = Math.min(a.max[v], b.max[v]);
  if (uMax <= uMin || vMax <= vMin) {
    return undefined;
  }
  if (a.max[axis] === b.min[axis]) {
    return { side: "max", u, v, uMin, uMax, vMin, vMax };
  }
  if (a.min[axis] === b.max[axis]) {
    return { side: "min", u, v, uMin, uMax, vMin, vMax };
  }
  return undefined;
}

function screwPositions(box: Box3, face: JointFace, touch: Touch, count: number): Vec3[] {
  const uSpan = touch.uMax - touch.uMin;
  const vSpan = touch.vMax - touch.vMin;
  const longAxis = uSpan >= vSpan ? touch.u : touch.v;
  const shortAxis = longAxis === touch.u ? touch.v : touch.u;
  const longMin = longAxis === touch.u ? touch.uMin : touch.vMin;
  const longMax = longAxis === touch.u ? touch.uMax : touch.vMax;
  const shortMin = shortAxis === touch.u ? touch.uMin : touch.vMin;
  const shortMax = shortAxis === touch.u ? touch.uMax : touch.vMax;
  const faceValue = face.side === "min" ? box.min[face.axis] : box.max[face.axis];
  const shortMid = (shortMin + shortMax) / 2;

  return Array.from({ length: count }, (_, i) => {
    const coords: Record<Axis, number> = { x: 0, y: 0, z: 0 };
    coords[face.axis] = faceValue;
    coords[longAxis] = longMin + (longMax - longMin) * ((i + 1) / (count + 1));
    coords[shortAxis] = shortMid;
    return { x: coords.x, y: coords.y, z: coords.z };
  });
}

function otherAxes(axis: Axis): readonly [Axis, Axis] {
  if (axis === "x") {
    return ["y", "z"];
  }
  if (axis === "y") {
    return ["x", "z"];
  }
  return ["x", "y"];
}

function opposite(side: "min" | "max"): "min" | "max" {
  return side === "min" ? "max" : "min";
}
