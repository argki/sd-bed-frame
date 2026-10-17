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
  lengths: [50, 200],
} as const;

/**
 * モジュール連結で買う金物。価格と入数は、ビバホームオンラインに掲載されていた税込。
 * 掲載は店舗での取り扱いだった。
 * acrossWidth は、取り付ける長さの六角ボルトが掲載になかったため、寸切ボルトを切って使う。頭がないので両端をナットで締める。
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
    usage: "頭側と足側の、接している柱を厚み方向に通す",
  },
  acrossWidth: {
    id: "module-stud",
    name: "寸切ボルト",
    diameter: MODULE_BOLT.diameter,
    length: 200,
    stockLength: 285,
    packSize: 1,
    packPrice: 195,
    nutsPerBolt: 2,
    unit: "本",
    usage: "左右の、接している柱を幅方向に通す。285mmを200mmに切る",
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
