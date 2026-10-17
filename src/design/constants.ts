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

/**
 * 2x4 材（12f）。実寸は 38mm × 89mm。
 * 長さは 1x4 の 12f と同じ 3650mm として扱う。
 */
export const LUMBER_2X4 = {
  thickness: 38,
  width: 89,
  length: 3650,
} as const;

/** ビバホームでの価格。lumber2x4 は現地で見た 12f の税込。 */
export const PRICE = {
  lumber: 712,
  lumber2x4: 1188,
  cut: 50,
} as const;

/** 木取りと購入で分ける材種。断面が違う材は、同じ1本から切り出さない。 */
export const LUMBER_STOCKS = [
  {
    id: "1x4",
    name: "1x4材 12f",
    thickness: LUMBER.thickness,
    width: LUMBER.width,
    length: LUMBER.length,
    unitPrice: PRICE.lumber,
  },
  {
    id: "2x4",
    name: "2x4材 12f",
    thickness: LUMBER_2X4.thickness,
    width: LUMBER_2X4.width,
    length: LUMBER_2X4.length,
    unitPrice: PRICE.lumber2x4,
  },
] as const;

/** のこぎりの刃の厚み。1カットごとに失われる長さ。 */
export const KERF = 3;

/**
 * 部材を留めるコーススレッド。価格はビバホームオンラインの税込。
 * rail は長辺の上枠を貫いて、幅方向の上枠の木口へ入れる。
 * slat は、すのこの厚みを貫いてパネル桟へ入れる。脚と受け材は、同じネジを上面から材の中へ留める。
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
    usage:
      "長辺の上枠の外側から、幅方向の上枠の木口へ打つ。頭側・左の脚2本は上面から脚の中へ入れる",
  },
  slat: {
    id: "slat",
    name: "コーススレッド",
    thread: "全ねじ",
    diameter: 3.8,
    length: 45,
    packSize: 70,
    packPrice: 327,
    usage: "すのこは上面からパネル桟へ、脚と受け材は上面から材の中へ留める",
  },
} as const;

/**
 * モジュール同士を留めるボルト。
 * ねじは木材に切らず、六角ナットへかける。丸座金はボルト1本につき両側で2枚。
 * lengths は取り付ける長さで、重ねた材の厚みに endAllowance（座金2枚、ナット、ナットから出るねじ山）を足して足りるものを短い順に選ぶ。
 */
export const MODULE_BOLT = {
  name: "六角ボルト",
  diameter: 6,
  nutName: "六角ナット",
  washerName: "丸座金",
  washersPerBolt: 2,
  endAllowance: 12,
  lengths: [50, 285],
} as const;

/**
 * モジュール連結で買う金物。価格と入数は、ビバホームオンラインに掲載されていた税込。
 * 掲載は店舗での取り扱いだった。
 * acrossWidth は、取り付ける長さの六角ボルトが掲載になかったため、寸切ボルトを購入した長さのまま使う。頭がないので両端をナットで締める。切らない。
 */
export const MODULE_FASTENER = {
  acrossThickness: {
    id: "module-hex",
    name: "六角ボルト",
    diameter: MODULE_BOLT.diameter,
    length: 50,
    stockLength: 50,
    packSize: 1,
    packPrice: 107,
    nutsPerBolt: 1,
    unit: "本",
    usage: "重ねた上枠がこの長さに収まるときに通す",
  },
  acrossWidth: {
    id: "module-stud",
    name: "寸切ボルト",
    diameter: MODULE_BOLT.diameter,
    length: 285,
    stockLength: 285,
    packSize: 1,
    packPrice: 195,
    nutsPerBolt: 2,
    unit: "本",
    usage: "接している上枠を厚み方向に、購入した長さのまま通す",
  },
  nut: {
    id: "module-nut",
    name: "六角ナット",
    diameter: MODULE_BOLT.diameter,
    packSize: 4,
    packPrice: 107,
    unit: "袋",
    usage: "モジュールのボルトを締める",
  },
  washer: {
    id: "module-washer",
    name: "丸座金",
    diameter: MODULE_BOLT.diameter,
    outerDiameter: 13,
    thickness: 1,
    packSize: 4,
    packPrice: 74,
    unit: "袋",
    usage: "モジュールのボルトの両側に入れる",
  },
} as const;

/**
 * 上枠と脚のフレームで使う金物。価格と入数は、ビバホームオンラインに掲載されていた税込。
 * leg は高さ約370mmの鋼製シングル脚。joistHanger は 2x4 を89mm立てて渡すときの受け（内寸89×40）。
 * 外形の数値はメーカーの掲載寸法に合わせている。
 */
export const FRAME_HARDWARE = {
  leg: {
    id: "frame-leg",
    name: "DIYデザイン脚",
    height: 370,
    packSize: 1,
    packPrice: 2178,
    unit: "本",
    color: "黒",
    usage: "モジュール四隅で上枠を床まで支える",
  },
  joistHanger: {
    id: "joist-hanger",
    name: "2×4サポート 受け金物",
    model: "24-U2-WH",
    thickness: 2,
    width: 37,
    innerWidth: 89,
    depth: 40,
    packSize: 1,
    packPrice: 272,
    unit: "個",
    usage: "中央の上枠の両端を長辺の上枠へ受ける",
  },
} as const;
