import { describe, expect, it } from "vitest";
import { LUMBER, MATTRESS, SLAT_MAX_GAP, STORAGE_BOX, STORAGE_CLEARANCE } from "./constants";
import {
  FRAME_HEIGHT,
  FRAME_MODULES,
  MODULE_SIZE,
  moduleParts,
  moduleStorageSlots,
  POST_HEIGHT,
  SLAT_GAP,
  STORAGE_CLEAR_HEIGHT,
} from "./frame";
import { boxFrom, contains, intersects, placementBox } from "./geometry";
import type { Box3, FrameModule } from "./types";

const moduleBounds: Box3 = boxFrom(
  { x: 0, y: 0, z: 0 },
  { x: MODULE_SIZE.width, y: FRAME_HEIGHT, z: MODULE_SIZE.length },
);

function partBoxes(module: FrameModule): { name: string; box: Box3 }[] {
  return moduleParts(module).flatMap((part) =>
    part.placements.map((placement) => ({
      name: part.name,
      box: placementBox(part.length, placement),
    })),
  );
}

/** 箱を開口から置き場所まで差し込むときに通る空間。高さと横幅に余裕を含める。 */
function insertionPath(module: FrameModule, slot: Box3): Box3 {
  const half = STORAGE_CLEARANCE / 2;
  return {
    min: {
      x: module.openSide === "left" ? 0 : slot.min.x,
      y: 0,
      z: slot.min.z - half,
    },
    max: {
      x: module.openSide === "left" ? slot.max.x : MODULE_SIZE.width,
      y: slot.max.y + STORAGE_CLEARANCE,
      z: slot.max.z + half,
    },
  };
}

describe("モジュールの配置", () => {
  it("4つのモジュールがマットレスの範囲をすき間なく覆う", () => {
    expect(FRAME_MODULES).toHaveLength(4);
    const area = FRAME_MODULES.length * MODULE_SIZE.width * MODULE_SIZE.length;
    expect(area).toBe(MATTRESS.width * MATTRESS.length);

    const boxes = FRAME_MODULES.map((m) =>
      boxFrom(m.origin, { x: MODULE_SIZE.width, y: FRAME_HEIGHT, z: MODULE_SIZE.length }),
    );
    const bed = boxFrom(
      { x: 0, y: 0, z: 0 },
      { x: MATTRESS.width, y: FRAME_HEIGHT, z: MATTRESS.length },
    );
    for (const [i, a] of boxes.entries()) {
      expect(contains(bed, a)).toBe(true);
      for (const b of boxes.slice(i + 1)) {
        expect(intersects(a, b)).toBe(false);
      }
    }
  });

  it("開口はベッドの外側の長辺に向いている", () => {
    for (const m of FRAME_MODULES) {
      expect(m.openSide).toBe(m.origin.x === 0 ? "left" : "right");
    }
  });
});

describe.each(FRAME_MODULES)("モジュール $name", (module) => {
  const parts = partBoxes(module);
  const slots = moduleStorageSlots(module).map((s) => boxFrom(s.position, s.size));

  it("部材を14本で構成する", () => {
    expect(parts).toHaveLength(14);
  });

  it("部材がすべてモジュールの外寸に収まる", () => {
    for (const { box } of parts) {
      expect(contains(moduleBounds, box)).toBe(true);
    }
  });

  it("部材どうしが重ならない", () => {
    for (const [i, a] of parts.entries()) {
      for (const b of parts.slice(i + 1)) {
        expect(intersects(a.box, b.box), `${a.name} と ${b.name}`).toBe(false);
      }
    }
  });

  it("すのこの上面がそろい、すき間が上限以下になる", () => {
    const slats = moduleParts(module).find((p) => p.name === "天板のすのこ");
    expect(slats).toBeDefined();
    for (const placement of slats?.placements ?? []) {
      expect(placementBox(slats?.length ?? 0, placement).max.y).toBe(FRAME_HEIGHT);
    }
    expect(SLAT_GAP).toBeGreaterThanOrEqual(0);
    expect(SLAT_GAP).toBeLessThanOrEqual(SLAT_MAX_GAP);
  });

  it("ダンボール箱を2区画に2個ずつ、計4個置ける", () => {
    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(slot.max.x - slot.min.x).toBe(STORAGE_BOX.depth);
      expect(slot.max.y - slot.min.y).toBe(STORAGE_BOX.height);
      expect(slot.max.z - slot.min.z).toBe(STORAGE_BOX.width);
    }
  });

  it("箱どうし、箱と部材が重ならない", () => {
    for (const [i, slot] of slots.entries()) {
      for (const other of slots.slice(i + 1)) {
        expect(intersects(slot, other)).toBe(false);
      }
      for (const { name, box } of parts) {
        expect(intersects(slot, box), name).toBe(false);
      }
    }
  });

  it("開口から箱を差し込む通り道に、余裕を含めて部材がない", () => {
    for (const slot of slots) {
      const path = insertionPath(module, slot);
      expect(contains(moduleBounds, path)).toBe(true);
      for (const { name, box } of parts) {
        expect(intersects(path, box), name).toBe(false);
      }
    }
  });
});

describe("フレームの高さ", () => {
  it("上横桟の下に、箱の高さと余裕を足した空間がある", () => {
    expect(STORAGE_CLEAR_HEIGHT).toBe(STORAGE_BOX.height + STORAGE_CLEARANCE);
    expect(POST_HEIGHT - LUMBER.width).toBe(STORAGE_CLEAR_HEIGHT);
    expect(FRAME_HEIGHT).toBe(POST_HEIGHT + LUMBER.thickness);
  });
});
