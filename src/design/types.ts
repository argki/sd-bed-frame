import { LUMBER } from "./constants";

/** 材の断面。厚みと幅だけを使い、長さは部材ごとに別である。 */
export type LumberSection = {
  readonly thickness: number;
  readonly width: number;
};

/**
 * 座標系は three.js と同じ Y 軸上向き。単位は mm。
 * x はベッドの幅方向、y は高さ方向、z はベッドの長さ方向。
 */
export type Vec3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type Axis = "x" | "y" | "z";

/** 部材1本の置き方。 */
export type PartPlacement = {
  /** 部材を囲む直方体のうち、x、y、z が最小になる角の位置。所属モジュールの原点からの距離。 */
  readonly position: Vec3;
  /** 材の長さ方向が向く軸。 */
  readonly lengthAxis: Axis;
  /** 材の幅方向が向く軸。lengthAxis と同じ軸にはできない。 */
  readonly widthAxis: Axis;
};

/** 同じ長さで切り出す部材の種類。本数は placements の数で決まる。 */
export type Part = {
  readonly id: string;
  readonly name: string;
  readonly moduleId: string;
  /** カット後の長さ。 */
  readonly length: number;
  /** 省略したときは 1x4 の断面として置く。 */
  readonly section?: LumberSection;
  readonly placements: readonly PartPlacement[];
};

/** 4分割したベースの1区画。 */
export type FrameModule = {
  readonly id: string;
  readonly name: string;
  /** 組み立て済みの状態での、ベッド全体の原点からの位置。 */
  readonly origin: Vec3;
  /** 箱を出し入れする開口が、ベッドの左右どちらの長辺にあるか。left は x が小さい側。 */
  readonly openSide: "left" | "right";
};

/** 軸に沿った直方体。min の各座標は max 以下。 */
export type Box3 = {
  readonly min: Vec3;
  readonly max: Vec3;
};

export function partCount(part: Part): number {
  return part.placements.length;
}

/** 置いた部材が x、y、z 方向に占める大きさ。 */
export function placedSize(
  length: number,
  placement: PartPlacement,
  section: LumberSection = LUMBER,
): Vec3 {
  const { lengthAxis, widthAxis } = placement;
  if (lengthAxis === widthAxis) {
    throw new Error(`lengthAxis と widthAxis が同じ軸（${lengthAxis}）になっている`);
  }
  const size: Record<Axis, number> = {
    x: section.thickness,
    y: section.thickness,
    z: section.thickness,
  };
  size[lengthAxis] = length;
  size[widthAxis] = section.width;
  return size;
}
