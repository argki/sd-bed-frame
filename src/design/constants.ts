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
 * 部材を留めるコーススレッド。価格はビバホームオンラインの税込。
 * rail は柱の幅を貫いて横桟の木口へ入れる。slat はすのこの厚みを貫いて下の部材の木口へ入れる。
 * 呼び径、長さ、入数は、掲載されていた商品に合わせている。
 */
export const FASTENER = {
  rail: {
    id: "rail",
    name: "コーススレッド",
    thread: "半ねじ",
    diameter: 5.1,
    length: 120,
    packSize: 15,
    packPrice: 327,
    usage: "柱の外側の面から横桟の木口へ打つ",
  },
  slat: {
    id: "slat",
    name: "コーススレッド",
    thread: "全ねじ",
    diameter: 3.8,
    length: 45,
    packSize: 70,
    packPrice: 327,
    usage: "すのこの上面から、接している柱と上横桟の木口へ打つ",
  },
} as const;

/**
 * モジュール同士を留める六角ボルト。
 * ねじは木材に切らず、六角ナットへかける。座金はボルト1本につき両側で2枚。
 * 長さは、重ねた材の厚みに endAllowance（座金2枚、ナット、ナットから出るねじ山）を足して足りるものを短い順に選ぶ。
 * 税込価格は、購入リストへ出すときにビバホームの掲載に合わせる。
 */
export const MODULE_BOLT = {
  name: "六角ボルト",
  diameter: 6,
  nutName: "六角ナット",
  washerName: "平座金",
  washersPerBolt: 2,
  endAllowance: 12,
  lengths: [50, 200],
} as const;
