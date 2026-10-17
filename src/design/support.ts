import { LUMBER_2X4, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";

/**
 * 検討前の概算合計。コミット 45651f7 の購入計算で、内訳は設計メモにある。
 */
export const PRECHANGE_TOTAL = 18113;

/**
 * 開口を支える方法。DIYデザイン脚と根太受けは買わない。
 * フレームは、この長さと本数で脚と受け材を置く。
 */
export const WOOD_SUPPORT = {
  leg: {
    name: "脚",
    section: LUMBER_2X4,
    /** 箱の高さと、出し入れの余裕。開口はこの長さになる。 */
    length: STORAGE_BOX.height + STORAGE_CLEARANCE,
    /**
     * 組み立てたベッドの、モジュールの角が集まる位置。
     * 幅方向3列、長さ方向3列。境の位置は、隣のモジュールと共有する。
     */
    count: 3 * 3,
  },
  seat: {
    name: "受け材",
    section: LUMBER_2X4,
    /** 中央の上枠の端の下に置く、2x4 の幅と同じ長さ。 */
    length: LUMBER_2X4.width,
    /** 4モジュールの、中央の上枠の両端。 */
    count: 4 * 2,
  },
} as const;
