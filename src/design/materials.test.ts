import { describe, expect, it } from "vitest";
import { FASTENER, MODULE_BOLT, MODULE_FASTENER } from "./constants";
import { FRAME_JOINTS } from "./joints";
import {
  FASTENER_SUMMARY,
  MODULE_HARDWARE_SUMMARY,
  PART_SUMMARY,
  PROJECT_COST,
  PURCHASE_ITEMS,
  packsToBuy,
  summarizeParts,
} from "./materials";
import { MODULE_JOINTS } from "./module-joints";
import type { Part } from "./types";

describe("summarizeParts", () => {
  it("名前と長さが同じ部材の本数を合計する", () => {
    const parts: Part[] = [
      {
        id: "a",
        name: "側板",
        moduleId: "m1",
        length: 500,
        placements: [
          { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" },
          { position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" },
        ],
      },
      {
        id: "b",
        name: "側板",
        moduleId: "m2",
        length: 500,
        placements: [{ position: { x: 0, y: 0, z: 0 }, lengthAxis: "x", widthAxis: "y" }],
      },
    ];

    expect(summarizeParts(parts)).toEqual([{ name: "側板", length: 500, quantity: 3 }]);
  });
});

describe("表示用の部材集計", () => {
  it("切り出す全部材を集計する", () => {
    expect(PART_SUMMARY.reduce((sum, row) => sum + row.quantity, 0)).toBe(40);
  });

  it("購入する12f材の小計が単価と本数に一致する", () => {
    for (const item of PURCHASE_ITEMS) {
      expect(item.subtotal).toBe(item.unitPrice * item.quantity);
    }
  });

  it("コーススレッドは使用本数を入数で切り上げて買う", () => {
    expect(packsToBuy(0, 15)).toBe(0);
    expect(packsToBuy(15, 15)).toBe(1);
    expect(packsToBuy(16, 15)).toBe(2);

    for (const fastener of FASTENER_SUMMARY) {
      const used = FRAME_JOINTS.filter((joint) => joint.fastenerId === fastener.id).reduce(
        (sum, joint) => sum + joint.positions.length,
        0,
      );
      expect(fastener.used).toBe(used);
      expect(fastener.packCount).toBe(packsToBuy(used, fastener.packSize));
      expect(fastener.packCount * fastener.packSize).toBeGreaterThanOrEqual(used);
      expect(fastener.subtotal).toBe(fastener.packCount * fastener.packPrice);
    }

    expect(FASTENER_SUMMARY.find((item) => item.id === FASTENER.rail.id)?.screwsPerJoint).toBe(0);
    expect(FASTENER_SUMMARY.find((item) => item.id === FASTENER.slat.id)?.screwsPerJoint).toBe(0);
  });

  it("合計に木材、コーススレッド、モジュールの連結金物、カット代を含める", () => {
    expect(PROJECT_COST.totalCost).toBe(
      PROJECT_COST.lumberCost + PROJECT_COST.fastenerCost + PROJECT_COST.cutCost,
    );
    expect(PROJECT_COST.fastenerCost).toBe(
      FASTENER_SUMMARY.reduce((sum, fastener) => sum + fastener.subtotal, 0) +
        MODULE_HARDWARE_SUMMARY.reduce((sum, item) => sum + item.subtotal, 0),
    );
  });

  it("モジュールのボルト、ナット、座金は使用数を入数で切り上げて買う", () => {
    const bolts = [MODULE_FASTENER.acrossThickness, MODULE_FASTENER.acrossWidth];
    let nuts = 0;
    let washers = 0;
    for (const bolt of bolts) {
      const used = MODULE_JOINTS.filter((joint) => joint.boltLength === bolt.length).reduce(
        (sum, joint) => sum + joint.positions.length,
        0,
      );
      const item = MODULE_HARDWARE_SUMMARY.find((row) => row.id === bolt.id);
      expect(item?.used).toBe(used);
      expect(item?.packPrice).toBe(bolt.packPrice);
      expect(item?.packCount).toBe(packsToBuy(used, bolt.packSize));
      nuts += used * bolt.nutsPerBolt;
      washers += used * MODULE_BOLT.washersPerBolt;
    }
    expect(MODULE_HARDWARE_SUMMARY.find((row) => row.id === MODULE_FASTENER.nut.id)?.used).toBe(
      nuts,
    );
    expect(MODULE_HARDWARE_SUMMARY.find((row) => row.id === MODULE_FASTENER.washer.id)?.used).toBe(
      washers,
    );
    for (const item of MODULE_HARDWARE_SUMMARY) {
      expect(PURCHASE_ITEMS.some((purchase) => purchase.name === item.name)).toBe(true);
      expect(item.subtotal).toBe(item.packCount * item.packPrice);
    }
  });
});
