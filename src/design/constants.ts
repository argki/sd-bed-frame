/** 長さの単位はすべて mm、金額の単位は円。 */

/** セミダブルのマットレス。 */
export const MATTRESS = {
  width: 1200,
  length: 1950,
} as const;

/** 収納するダンボール箱。 */
export const STORAGE_BOX = {
  height: 280,
  width: 380,
  depth: 270,
} as const;

/** 1x4 材（12f）。 */
export const LUMBER = {
  thickness: 19,
  width: 89,
  length: 3650,
} as const;

/** ビバホームでの価格。 */
export const PRICE = {
  lumber: 712,
  cut: 50,
} as const;

/** のこぎりの刃の厚み。1カットごとに失われる長さ。 */
export const KERF = 3;
