import { KERF, LUMBER } from "./constants";
import type { CutPiece, StockBoard } from "./cut-plan";

export type CutSegment = {
  readonly piece: CutPiece;
  readonly start: number;
  readonly end: number;
  readonly kerfAfter: number;
};

export type BoardLayout = {
  readonly segments: readonly CutSegment[];
  readonly offcutStart: number;
  readonly offcutLength: number;
};

export function createBoardLayout(
  board: StockBoard,
  stockLength: number = LUMBER.length,
  kerf: number = KERF,
): BoardLayout {
  let cursor = 0;
  const segments = board.pieces.map((piece, index) => {
    const start = cursor;
    const end = start + piece.length;
    const kerfAfter = index < board.cutCount ? kerf : 0;
    cursor = end + kerfAfter;
    return { piece, start, end, kerfAfter };
  });

  if (cursor !== board.usedLength) {
    throw new Error(`木取りの使用長 ${board.usedLength}mm と図の使用長 ${cursor}mm が一致しない`);
  }

  return {
    segments,
    offcutStart: cursor,
    offcutLength: stockLength - cursor,
  };
}
