import { FASTENER } from "./constants";
import { FRAME_MODULES, MODULE_SIZE, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import { PANEL_BATTEN } from "./panel";
import { WOOD_SUPPORT } from "./support";
import type { Axis, Box3, FrameModule, Part, Vec3 } from "./types";

/** 幅方向の上枠の木口1か所に打つ本数。 */
export const SCREWS_PER_RAIL_END = 2;
/** すのこと、その下のパネル桟との接合1か所に打つ本数。 */
export const SCREWS_PER_SLAT_SUPPORT = 1;
/** 脚1本を上枠へ留める本数。1本だと、そのネジを軸に脚が回る。 */
export const SCREWS_PER_LEG = 2;
/**
 * 頭側・左の脚のうち、半ねじで留める本数。
 * 全ねじが70本を超えると袋がもう1つ要る。120mmは脚の長さの中に収まる。
 */
const LEGS_USING_RAIL_PACK = 2;
/** 受け材1個を、長辺の上枠へ留める本数。1本だと、そのネジを軸に回る。 */
export const SCREWS_PER_HANGER_SEAT = 2;

/**
 * 木口へ打つネジを、面の下半分に置く。
 * 上半分は、すのこから下りるネジの先が来る。
 */
const RAIL_END_BAND = { start: 0, end: 0.5 } as const;

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
  const rails = placed.filter((item) => item.part.name === "上枠");
  const slats = placed.filter((item) => item.part.name === "天板のすのこ");
  const battens = placed.filter((item) => item.part.name === PANEL_BATTEN.name);
  const supports = placed.filter(
    (item) => item.part.name === WOOD_SUPPORT.leg.name || item.part.name === WOOD_SUPPORT.seat.name,
  );
  const sideRails = rails.filter((item) => item.part.length === MODULE_SIZE.length);
  const crossRails = rails.filter((item) => item.part.length !== MODULE_SIZE.length);
  const centerRails = crossRails.filter(
    (rail) => rail.box.min.z > 0 && rail.box.max.z < MODULE_SIZE.length,
  );
  const endRails = crossRails.filter((rail) => !centerRails.includes(rail));

  return [
    ...jointsWhere(
      module,
      sideRails,
      endRails,
      "x",
      SCREWS_PER_RAIL_END,
      FASTENER.rail,
      undefined,
      RAIL_END_BAND,
    ),
    ...jointsWhere(
      module,
      sideRails,
      centerRails,
      "x",
      SCREWS_PER_RAIL_END,
      FASTENER.rail,
      undefined,
      RAIL_END_BAND,
    ),
    ...jointsWhere(module, slats, battens, "y", SCREWS_PER_SLAT_SUPPORT, FASTENER.slat, "min"),
    ...supports.flatMap((support) => supportJoints(module, sideRails, support)),
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
  alongBand: { readonly start: number; readonly end: number } = { start: 0, end: 1 },
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
        positions: screwPositions(source.box, face, touch, screwCount, alongBand),
        fastenerId: fastener.id,
      });
    }
  }
  return joints;
}

/**
 * 脚または受け材の上面から、その材の中へネジを入れる。
 * 全ねじ 45mm は上枠の高さ 89mm より短いので、上枠を貫いて下の材へは届かない。
 */
function supportJoints(
  module: FrameModule,
  rails: readonly Placed[],
  support: Placed,
): ScrewJoint[] {
  const screwCount =
    support.part.name === WOOD_SUPPORT.leg.name ? SCREWS_PER_LEG : SCREWS_PER_HANGER_SEAT;
  const joints: ScrewJoint[] = [];
  for (const rail of rails) {
    const overlapX =
      Math.min(rail.box.max.x, support.box.max.x) - Math.max(rail.box.min.x, support.box.min.x);
    const overlapZ =
      Math.min(rail.box.max.z, support.box.max.z) - Math.max(rail.box.min.z, support.box.min.z);
    if (rail.box.min.y !== support.box.max.y || overlapX <= 0 || overlapZ <= 0) {
      continue;
    }
    const fastener = legUsesRailPack(module, support) ? FASTENER.rail : FASTENER.slat;
    if (fastener.length >= support.box.max.y - support.box.min.y) {
      throw new Error(
        `ネジ ${fastener.id} の長さ ${fastener.length}mm では、脚または受け材を上面から貫いてしまう`,
      );
    }
    const face: JointFace = { axis: "y", side: "max" };
    joints.push({
      id: `${module.id}/${support.part.id}#${support.index}/${rail.part.id}#${rail.index}`,
      moduleId: module.id,
      fromPartId: support.part.id,
      fromPlacementIndex: support.index,
      intoPartId: rail.part.id,
      intoPlacementIndex: rail.index,
      face,
      positions: seatPositions(rail.box, support.box, screwCount),
      fastenerId: fastener.id,
    });
  }
  return joints;
}

function legUsesRailPack(module: FrameModule, support: Placed): boolean {
  return (
    support.part.name === WOOD_SUPPORT.leg.name &&
    module.id === "head-left" &&
    support.index < LEGS_USING_RAIL_PACK
  );
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

function screwPositions(
  box: Box3,
  face: JointFace,
  touch: Touch,
  count: number,
  alongBand: { readonly start: number; readonly end: number },
): Vec3[] {
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
  const bandMin = longMin + (longMax - longMin) * alongBand.start;
  const bandMax = longMin + (longMax - longMin) * alongBand.end;

  return Array.from({ length: count }, (_, i) => {
    const coords: Record<Axis, number> = { x: 0, y: 0, z: 0 };
    coords[face.axis] = faceValue;
    coords[longAxis] = bandMin + (bandMax - bandMin) * ((i + 1) / (count + 1));
    coords[shortAxis] = shortMid;
    return { x: coords.x, y: coords.y, z: coords.z };
  });
}

function seatPositions(rail: Box3, hardware: Box3, count: number): Vec3[] {
  const xMin = Math.max(rail.min.x, hardware.min.x);
  const xMax = Math.min(rail.max.x, hardware.max.x);
  const zMin = Math.max(rail.min.z, hardware.min.z);
  const zMax = Math.min(rail.max.z, hardware.max.z);
  const spanX = xMax - xMin;
  const spanZ = zMax - zMin;
  const towardStart = hardware.min.z < MODULE_SIZE.length / 2;
  const towardLowX = (hardware.min.x + hardware.max.x) / 2 < MODULE_SIZE.width / 2;
  const z = towardStart ? zMin + spanZ * 0.25 : zMax - spanZ * 0.25;
  return Array.from({ length: count }, (_, i) => {
    const along = (i + 1) / (count + 1);
    return {
      x: towardLowX ? xMin + spanX * along : xMax - spanX * along,
      y: rail.min.y,
      z,
    };
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
