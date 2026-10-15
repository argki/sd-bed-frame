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

/** 箱を出し入れするために、箱の高さと横幅に足す余裕。横幅は左右に半分ずつ割り振る。 */
export const STORAGE_CLEARANCE = 20;

/** 天板のすのこの、板と板のすき間の上限。 */
export const SLAT_MAX_GAP = 50;

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

/**
 * 部材を留めるコーススレッド。
 * rail は柱の幅を貫いて横桟の木口へ入れる。slat はすのこの厚みを貫いて下の部材の木口へ入れる。
 * 呼び径と長さは、店頭で入手できる寸法に合わせた仮の値。
 */
export const FASTENER = {
  rail: { id: "rail", name: "コーススレッド", diameter: 4.2, length: 120 },
  slat: { id: "slat", name: "コーススレッド", diameter: 3.8, length: 45 },
} as const;
