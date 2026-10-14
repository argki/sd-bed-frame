import { describe, expect, it } from "vitest";
import { KERF, LUMBER } from "./constants";
import { createBoardLayout } from "./cut-layout";
import { FRAME_CUT_PLAN } from "./cut-plan";

describe("createBoardLayout", () => {
  it("各部材をカットロス分だけ離して並べる", () => {
    const board = FRAME_CUT_PLAN.boards[0];
    if (!board) {
      throw new Error("木取りがない");
    }

    const layout = createBoardLayout(board);
    for (const [index, segment] of layout.segments.entries()) {
      expect(segment.end - segment.start).toBe(segment.piece.length);
      expect(segment.kerfAfter).toBe(index < board.cutCount ? KERF : 0);
      const next = layout.segments[index + 1];
      if (next) {
        expect(next.start).toBe(segment.end + segment.kerfAfter);
      }
    }
  });

  it("各材の部材、カットロス、端材の合計が12f材の長さになる", () => {
    for (const board of FRAME_CUT_PLAN.boards) {
      const layout = createBoardLayout(board);
      const pieces = layout.segments.reduce(
        (sum, segment) => sum + segment.piece.length + segment.kerfAfter,
        0,
      );
      expect(pieces + layout.offcutLength).toBe(LUMBER.length);
      expect(layout.offcutLength).toBe(board.remainingLength);
    }
  });
});
