import { LUMBER, PRICE } from "./constants";
import { FRAME_CUT_PLAN } from "./cut-plan";
import { FRAME_PARTS } from "./frame";
import type { Part } from "./types";

export type PartSummary = {
  readonly name: string;
  readonly length: number;
  readonly quantity: number;
};

export type PurchaseItem = {
  readonly name: string;
  readonly dimensions: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly subtotal: number;
};

export const PART_SUMMARY = summarizeParts(FRAME_PARTS);

export const PURCHASE_ITEMS: readonly PurchaseItem[] = [
  {
    name: "1x4材 12f",
    dimensions: `${LUMBER.thickness} × ${LUMBER.width} × ${LUMBER.length} mm`,
    quantity: FRAME_CUT_PLAN.boardCount,
    unitPrice: PRICE.lumber,
    subtotal: FRAME_CUT_PLAN.cost.materialCost,
  },
];

export function summarizeParts(parts: readonly Part[]): PartSummary[] {
  const rows = new Map<string, PartSummary>();

  for (const part of parts) {
    const key = `${part.name}:${part.length}`;
    const current = rows.get(key);
    rows.set(key, {
      name: part.name,
      length: part.length,
      quantity: (current?.quantity ?? 0) + part.placements.length,
    });
  }

  return [...rows.values()];
}
