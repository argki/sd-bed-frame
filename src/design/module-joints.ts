import { LUMBER, MODULE_BOLT } from "./constants";
import { FRAME_MODULES, moduleParts, STORAGE_CLEAR_HEIGHT } from "./frame";
import { placementBox } from "./geometry";
import type { Axis, Box3, FrameModule, Vec3 } from "./types";

/** 接している柱1組を留めるボルトの本数。1本だと柱を軸に回る。 */
export const BOLTS_PER_MODULE_JOINT = 2;

/**
 * 左右方向のボルトと、頭足方向のボルトが、角の柱の中で交わらないように高さを分ける。
 * 値は、下横桟の上端から上横桟の下端までの区間に対する割合。
 */
const BOLT_FRACTIONS = {
  x: [1 / 5, 3 / 5],
  z: [2 / 5, 4 / 5],
} as const;

export type ModuleJointEnd = {
  readonly moduleId: string;
  readonly partId: string;
  readonly placementIndex: number;
};

/** 隣り合うモジュールの柱を、六角ボルトで締める箇所。位置はベッド全体の原点から。 */
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
  const posts = FRAME_MODULES.flatMap(modulePosts);
  const joints: ModuleJoint[] = [];
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i];
      const b = posts[j];
      if (!a || !b || a.moduleId === b.moduleId) {
        continue;
      }
      const axis = touchingAxis(a.box, b.box);
      if (!axis) {
        continue;
      }
      const [first, second] = a.box.min[axis] <= b.box.min[axis] ? [a, b] : [b, a];
      joints.push(jointBetween(first, second, axis));
    }
  }
  return joints;
}

function modulePosts(module: FrameModule): Post[] {
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
  const acrossMid = (acrossMin + acrossMax) / 2;
  const yMin = LUMBER.width;
  const yMax = STORAGE_CLEAR_HEIGHT;
  const fractions = BOLT_FRACTIONS[axis];
  if (fractions.length !== BOLTS_PER_MODULE_JOINT) {
    throw new Error("モジュール連結のボルト本数と、高さを分ける割合の数が違う");
  }
  const positions = fractions.map((fraction) => ({
    x: axis === "x" ? contact : acrossMid,
    y: yMin + (yMax - yMin) * fraction,
    z: axis === "z" ? contact : acrossMid,
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

function touchingAxis(a: Box3, b: Box3): "x" | "z" | undefined {
  for (const axis of ["x", "z"] as const) {
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
