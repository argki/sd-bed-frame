import { LUMBER_2X4, MODULE_BOLT } from "./constants";
import { FRAME_MODULES, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import type { Axis, Box3, FrameModule, Vec3 } from "./types";

/** 接している上枠1組を留めるボルトの本数。1本だと、そのボルトを軸にモジュールが回る。 */
export const BOLTS_PER_MODULE_JOINT = 2;

/**
 * 接している面の長い方向で、ボルトを置く割合。
 * 端と中央の上枠、その木口ネジを避ける。
 */
const BOLT_ALONG = [1 / 3, 2 / 3] as const;

/**
 * 上枠の高さ方向で、ボルトの中心を置く割合。
 * 下半分の木口ネジより上、すのこから下りるネジの先より下。
 */
const BOLT_HEIGHT_FRACTION = 0.6;

export type ModuleJointEnd = {
  readonly moduleId: string;
  readonly partId: string;
  readonly placementIndex: number;
};

/** 隣り合うモジュールの上枠を、ボルトとナットで締める箇所。位置はベッド全体の原点から。 */
export type ModuleJoint = {
  readonly id: string;
  readonly axis: "x" | "z";
  readonly boltLength: number;
  readonly ends: readonly [ModuleJointEnd, ModuleJointEnd];
  readonly positions: readonly Vec3[];
};

type Post = ModuleJointEnd & { readonly box: Box3 };

export const MODULE_JOINTS: readonly ModuleJoint[] = moduleJoints();

export function boltLengthForGrip(grip: number): number {
  const need = grip + MODULE_BOLT.endAllowance;
  const length = MODULE_BOLT.lengths.find((item) => item >= need);
  if (length === undefined) {
    throw new Error(`重ね厚 ${grip}mm を通せる六角ボルトの長さがない`);
  }
  return length;
}

function moduleJoints(): ModuleJoint[] {
  const rails = FRAME_MODULES.flatMap(moduleRails);
  const joints: ModuleJoint[] = [];
  for (let i = 0; i < rails.length; i++) {
    for (let j = i + 1; j < rails.length; j++) {
      const a = rails[i];
      const b = rails[j];
      if (!a || !b || a.moduleId === b.moduleId) {
        continue;
      }
      const axis = touchingThickness(a.box, b.box);
      if (!axis) {
        continue;
      }
      const [first, second] = a.box.min[axis] <= b.box.min[axis] ? [a, b] : [b, a];
      joints.push(jointBetween(first, second, axis));
    }
  }
  return joints;
}

function moduleRails(module: FrameModule): Post[] {
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
          min: add(local.min, module.origin),
          max: add(local.max, module.origin),
        },
      };
    });
  });
}

function jointBetween(first: Post, second: Post, axis: "x" | "z"): ModuleJoint {
  const grip = span(first.box, axis) + span(second.box, axis);
  const contact = first.box.max[axis];
  const across = axis === "x" ? "z" : "x";
  const acrossMin = Math.max(first.box.min[across], second.box.min[across]);
  const acrossMax = Math.min(first.box.max[across], second.box.max[across]);
  const yMin = Math.max(first.box.min.y, second.box.min.y);
  const yMax = Math.min(first.box.max.y, second.box.max.y);
  if (BOLT_ALONG.length !== BOLTS_PER_MODULE_JOINT) {
    throw new Error("モジュール連結のボルト本数と、位置を分ける割合の数が違う");
  }
  const positions = BOLT_ALONG.map((fraction) => ({
    x: axis === "x" ? contact : acrossMin + (acrossMax - acrossMin) * fraction,
    y: yMin + (yMax - yMin) * BOLT_HEIGHT_FRACTION,
    z: axis === "z" ? contact : acrossMin + (acrossMax - acrossMin) * fraction,
  }));
  return {
    id: `${first.moduleId}/${first.partId}#${first.placementIndex}/${second.moduleId}/${second.partId}#${second.placementIndex}`,
    axis,
    boltLength: boltLengthForGrip(grip),
    ends: [
      { moduleId: first.moduleId, partId: first.partId, placementIndex: first.placementIndex },
      { moduleId: second.moduleId, partId: second.partId, placementIndex: second.placementIndex },
    ],
    positions,
  };
}

/** 厚みの面で接しているときだけ通す。長さ方向の木口どうしは、材の全長を通すことになるので使わない。 */
function touchingThickness(a: Box3, b: Box3): "x" | "z" | undefined {
  for (const axis of ["x", "z"] as const) {
    if (span(a, axis) !== LUMBER_2X4.thickness || span(b, axis) !== LUMBER_2X4.thickness) {
      continue;
    }
    const [u, v] = axis === "x" ? (["y", "z"] as const) : (["x", "y"] as const);
    if (overlap(a, b, u) <= 0 || overlap(a, b, v) <= 0) {
      continue;
    }
    if (a.max[axis] === b.min[axis] || b.max[axis] === a.min[axis]) {
      return axis;
    }
  }
  return undefined;
}

function overlap(a: Box3, b: Box3, axis: Axis): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function span(box: Box3, axis: Axis): number {
  return box.max[axis] - box.min[axis];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
