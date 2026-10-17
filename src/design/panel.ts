/**
 * 天板のすのこ5枚を一つにまとめる桟。
 * フレームへはネジ止めせず、パネルごと上へ外す。
 */
export const PANEL_BATTEN = {
  name: "パネル桟",
  /** 1本だと、すのこがその桟を軸に回る。区画ごとに1本、モジュールに2本。 */
  perModule: 2,
} as const;

/** 部材分解で、一つのパネルとして上へ離す部材。 */
export const PANEL_PART_NAMES = ["天板のすのこ", PANEL_BATTEN.name] as const;

export function isPanelPart(name: string): boolean {
  return (PANEL_PART_NAMES as readonly string[]).includes(name);
}

/** ベッドはひっくり返さない。上から、この順で分ける。 */
export const DISASSEMBLY_STEPS = [
  "パネルを上へ外す",
  "モジュール同士のボルトを外す",
  "モジュールを分ける",
] as const;
