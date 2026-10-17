import { describe, expect, it } from "vitest";
import {
  LUMBER,
  LUMBER_2X4,
  MATTRESS,
  SLAT_MAX_GAP,
  STORAGE_BOX,
  STORAGE_CLEARANCE,
} from "./constants";
import {
  CROSS_RAIL_LENGTH,
  FRAME_HEIGHT,
  FRAME_MODULES,
  FRAME_PARTS,
  MODULE_SIZE,
  moduleHardware,
  moduleParts,
  moduleStorageSlots,
  RAIL_BOTTOM,
  SLAT_GAP,
  STORAGE_CLEAR_HEIGHT,
} from "./frame";
import { boxFrom, contains, intersects, placementBox } from "./geometry";
import { WOOD_SUPPORT } from "./support";
import type { Box3, FrameModule } from "./types";

const moduleBounds: Box3 = boxFrom(
  { x: 0, y: 0, z: 0 },
  { x: MODULE_SIZE.width, y: FRAME_HEIGHT, z: MODULE_SIZE.length },
);

function partBoxes(module: FrameModule): { name: string; box: Box3 }[] {
  return moduleParts(module).flatMap((part) =>
    part.placements.map((placement) => ({
      name: part.name,
      box: placementBox(part.length, placement, part.section),
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

  it("上枠5本とすのこ5本があり、柱と下横桟はない", () => {
    const names = moduleParts(module).map((part) => part.name);
    expect(names).not.toContain("柱");
    expect(names).not.toContain("下横桟");
    expect(parts.filter((part) => part.name === "上枠")).toHaveLength(5);
    expect(parts.filter((part) => part.name === "天板のすのこ")).toHaveLength(5);
    expect(parts.filter((part) => part.name === "パネル桟")).toHaveLength(2);
    expect(parts.filter((part) => part.name === WOOD_SUPPORT.seat.name)).toHaveLength(2);
  });

  it("すのこは1x4、パネル桟も1x4、上枠と脚と受け材は2x4である", () => {
    for (const part of moduleParts(module)) {
      const slatLike = part.name === "天板のすのこ" || part.name === "パネル桟";
      expect(part.section).toEqual(slatLike ? LUMBER : LUMBER_2X4);
    }
  });

  it("中央の上枠の両端が受け材の上に載る", () => {
    const seats = parts.filter((part) => part.name === WOOD_SUPPORT.seat.name);
    const center = parts.find((part) => {
      if (part.name !== "上枠" || part.box.max.x - part.box.min.x !== CROSS_RAIL_LENGTH) {
        return false;
      }
      const rails = parts.filter(
        (item) => item.name === "上枠" && item.box.max.x - item.box.min.x === CROSS_RAIL_LENGTH,
      );
      return (
        rails.some((other) => other.box.max.z <= part.box.min.z) &&
        rails.some((other) => other.box.min.z >= part.box.max.z)
      );
    });
    expect(center).toBeDefined();
    if (!center) {
      return;
    }
    for (const side of ["min", "max"] as const) {
      const under = seats.filter((seat) => {
        const meets =
          side === "min"
            ? seat.box.min.x <= center.box.min.x && seat.box.max.x > center.box.min.x
            : seat.box.max.x >= center.box.max.x && seat.box.min.x < center.box.max.x;
        return (
          meets && seat.box.max.y === center.box.min.y && overlap(seat.box, center.box, "z") > 0
        );
      });
      expect(under).toHaveLength(1);
    }
    expect(moduleHardware(module)).toHaveLength(0);
  });

  it("上枠、すのこ、受け材がモジュールの外寸に収まる", () => {
    for (const { name, box } of parts) {
      if (name === WOOD_SUPPORT.leg.name) {
        continue;
      }
      expect(contains(moduleBounds, box), name).toBe(true);
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
      for (const item of moduleHardware(module)) {
        expect(intersects(slot, boxFrom(item.position, item.size)), item.name).toBe(false);
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
      for (const item of moduleHardware(module)) {
        expect(intersects(path, boxFrom(item.position, item.size)), item.name).toBe(false);
      }
    }
  });
});

describe("フレームの高さ", () => {
  it("上枠の下に、箱の高さと余裕以上の開口がある", () => {
    expect(STORAGE_CLEAR_HEIGHT).toBe(STORAGE_BOX.height + STORAGE_CLEARANCE);
    expect(RAIL_BOTTOM).toBe(WOOD_SUPPORT.leg.length);
    expect(RAIL_BOTTOM).toBeGreaterThanOrEqual(STORAGE_CLEAR_HEIGHT);
    expect(FRAME_HEIGHT).toBe(RAIL_BOTTOM + LUMBER_2X4.width + LUMBER.thickness);
  });

  it("上枠とすのこは40本、脚は9本、受け材は8個である", () => {
    const count = (name: string) =>
      FRAME_PARTS.filter((part) => part.name === name).reduce(
        (sum, part) => sum + part.placements.length,
        0,
      );
    expect(count("上枠") + count("天板のすのこ")).toBe(40);
    expect(count("パネル桟")).toBe(8);
    expect(count(WOOD_SUPPORT.leg.name)).toBe(WOOD_SUPPORT.leg.count);
    expect(count(WOOD_SUPPORT.seat.name)).toBe(WOOD_SUPPORT.seat.count);
    const names = FRAME_PARTS.map((part) => part.name);
    expect(names).not.toContain("柱");
    expect(names).not.toContain("下横桟");
  });

  it("組み立てた脚はベッドの範囲に収まる", () => {
    const bed = boxFrom(
      { x: 0, y: 0, z: 0 },
      { x: MATTRESS.width, y: FRAME_HEIGHT, z: MATTRESS.length },
    );
    for (const module of FRAME_MODULES) {
      for (const part of moduleParts(module)) {
        if (part.name !== WOOD_SUPPORT.leg.name) {
          continue;
        }
        for (const placement of part.placements) {
          const local = placementBox(part.length, placement, part.section);
          const world = boxFrom(
            {
              x: module.origin.x + local.min.x,
              y: module.origin.y + local.min.y,
              z: module.origin.z + local.min.z,
            },
            {
              x: local.max.x - local.min.x,
              y: local.max.y - local.min.y,
              z: local.max.z - local.min.z,
            },
          );
          expect(contains(bed, world)).toBe(true);
        }
      }
    }
  });
});

function overlap(a: Box3, b: Box3, axis: "x" | "y" | "z"): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}
