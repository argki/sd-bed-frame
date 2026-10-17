import { describe, expect, it } from "vitest";
import { FASTENER } from "./constants";
import { FRAME_MODULES, FRAME_PARTS, moduleParts } from "./frame";
import { placementBox } from "./geometry";
import { FRAME_JOINTS } from "./joints";
import { PROJECT_COST } from "./materials";
import { MODULE_JOINTS } from "./module-joints";
import { DISASSEMBLY_STEPS, PANEL_BATTEN } from "./panel";
import { PRECHANGE_TOTAL } from "./support";
import type { Box3 } from "./types";

const panelNames = new Set<string>(["天板のすのこ", PANEL_BATTEN.name]);

describe("すのこパネル", () => {
  it("解体は、パネル、ボルト、モジュールの順である", () => {
    expect([...DISASSEMBLY_STEPS]).toEqual([
      "パネルを上へ外す",
      "モジュール同士のボルトを外す",
      "モジュールを分ける",
    ]);
  });

  it("モジュールごとに、すのこ5枚とパネル桟2本が一つのパネルになる", () => {
    for (const module of FRAME_MODULES) {
      const parts = moduleParts(module).filter((part) => panelNames.has(part.name));
      const slats = parts.find((part) => part.name === "天板のすのこ");
      const battens = parts.find((part) => part.name === PANEL_BATTEN.name);
      expect(slats?.placements).toHaveLength(5);
      expect(battens?.placements).toHaveLength(PANEL_BATTEN.perModule);
      expect(parts).toHaveLength(2);
    }
  });

  it("パネルのネジはパネルの中だけにあり、上枠へは打たない", () => {
    const panelIds = new Set(
      FRAME_PARTS.filter((part) => panelNames.has(part.name)).map((part) => part.id),
    );
    const panelJoints = FRAME_JOINTS.filter(
      (joint) => panelIds.has(joint.fromPartId) || panelIds.has(joint.intoPartId),
    );
    expect(panelJoints.length).toBeGreaterThan(0);
    for (const joint of panelJoints) {
      expect(panelIds.has(joint.fromPartId)).toBe(true);
      expect(panelIds.has(joint.intoPartId)).toBe(true);
      expect(joint.fastenerId).toBe(FASTENER.slat.id);
    }
  });

  it("パネルを外すと、モジュールのボルトの真上に天板が残らない", () => {
    const slats = worldBoxes("天板のすのこ");
    for (const joint of MODULE_JOINTS) {
      for (const point of joint.positions) {
        const above = slats.some(
          (slat) =>
            point.x >= slat.min.x &&
            point.x <= slat.max.x &&
            point.z >= slat.min.z &&
            point.z <= slat.max.z &&
            point.y < slat.min.y,
        );
        expect(above, joint.id).toBe(true);
      }
    }
  });

  it("概算は検討前の合計以下である", () => {
    expect(PROJECT_COST.totalCost).toBeLessThanOrEqual(PRECHANGE_TOTAL);
  });
});

function worldBoxes(name: string): Box3[] {
  return FRAME_MODULES.flatMap((module) =>
    moduleParts(module)
      .filter((part) => part.name === name)
      .flatMap((part) =>
        part.placements.map((placement) => {
          const local = placementBox(part.length, placement, part.section);
          return {
            min: {
              x: module.origin.x + local.min.x,
              y: module.origin.y + local.min.y,
              z: module.origin.z + local.min.z,
            },
            max: {
              x: module.origin.x + local.max.x,
              y: module.origin.y + local.max.y,
              z: module.origin.z + local.max.z,
            },
          };
        }),
      ),
  );
}
