import { KERF, LUMBER, PRICE } from "./constants";
import { FRAME_PARTS } from "./frame";
import type { Part } from "./types";

export type CutPiece = {
  readonly id: string;
  readonly partId: string;
  readonly name: string;
  /** 同じ名前の部材の中での番号。1から始まる。 */
  readonly serial: number;
  readonly moduleId: string;
  readonly length: number;
};

export type StockBoard = {
  readonly id: string;
  readonly pieces: readonly CutPiece[];
  /** 部材とカットロスが占める長さ。 */
  readonly usedLength: number;
  readonly remainingLength: number;
  readonly cutCount: number;
};

export type CostSummary = {
  readonly materialCost: number;
  readonly cutCost: number;
  readonly totalCost: number;
};

export type CutPlan = {
  readonly boards: readonly StockBoard[];
  readonly boardCount: number;
  readonly pieceCount: number;
  readonly cutCount: number;
  readonly cost: CostSummary;
};

export const FRAME_CUT_PLAN = createCutPlan(FRAME_PARTS);

/**
 * First Fit Decreasing で木取りする。
 * 部材を長い順に並べ、先に作った材から、収まる最初の材へ入れる。
 */
export function createCutPlan(
  parts: readonly Part[],
  stockLength: number = LUMBER.length,
  kerf: number = KERF,
): CutPlan {
  validateInputs(parts, stockLength, kerf);
  const pieces = expandParts(parts).sort(
    (a, b) => b.length - a.length || a.partId.localeCompare(b.partId) || a.id.localeCompare(b.id),
  );
  const boardPieces: CutPiece[][] = [];

  for (const piece of pieces) {
    const board = boardPieces.find((candidate) => canFit([...candidate, piece], stockLength, kerf));
    if (board) {
      board.push(piece);
    } else {
      boardPieces.push([piece]);
    }
  }

  const boards = numberInDiagramOrder(
    boardPieces.map((board, index) =>
      summarizeBoard(`board-${index + 1}`, board, stockLength, kerf),
    ),
  );
  const cutCount = boards.reduce((sum, board) => sum + board.cutCount, 0);
  const materialCost = boards.length * PRICE.lumber;
  const cutCost = cutCount * PRICE.cut;

  return {
    boards,
    boardCount: boards.length,
    pieceCount: pieces.length,
    cutCount,
    cost: {
      materialCost,
      cutCost,
      totalCost: materialCost + cutCost,
    },
  };
}

/** カット寸法図と3Dで同じ表記にするための、名前と連番。 */
export function pieceLabel(piece: Pick<CutPiece, "name" | "serial">): string {
  return `${piece.name} ${piece.serial}`;
}

export function pieceId(partId: string, placementIndex: number): string {
  return `${partId}-${placementIndex + 1}`;
}

export function expandParts(parts: readonly Part[]): CutPiece[] {
  return parts.flatMap((part) =>
    part.placements.map((_, index) => ({
      id: pieceId(part.id, index),
      partId: part.id,
      name: part.name,
      serial: 0,
      moduleId: part.moduleId,
      length: part.length,
    })),
  );
}

/** カット寸法図の先頭の材から、各材の左端から順に、名前ごとに1から番号を付ける。 */
function numberInDiagramOrder(boards: readonly StockBoard[]): StockBoard[] {
  const nextSerial = new Map<string, number>();
  return boards.map((board) => ({
    ...board,
    pieces: board.pieces.map((piece) => {
      const serial = (nextSerial.get(piece.name) ?? 0) + 1;
      nextSerial.set(piece.name, serial);
      return { ...piece, serial };
    }),
  }));
}

function canFit(pieces: readonly CutPiece[], stockLength: number, kerf: number): boolean {
  const pieceLength = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const exactLength = pieceLength + Math.max(0, pieces.length - 1) * kerf;
  const lengthWithOffcut = pieceLength + pieces.length * kerf;
  return exactLength === stockLength || lengthWithOffcut <= stockLength;
}

function summarizeBoard(
  id: string,
  pieces: readonly CutPiece[],
  stockLength: number,
  kerf: number,
): StockBoard {
  const pieceLength = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const exactLength = pieceLength + Math.max(0, pieces.length - 1) * kerf;
  const usesFactoryEnd = exactLength === stockLength;
  const cutCount = pieces.length - (usesFactoryEnd ? 1 : 0);
  const usedLength = pieceLength + cutCount * kerf;
  return {
    id,
    pieces,
    usedLength,
    remainingLength: stockLength - usedLength,
    cutCount,
  };
}

function validateInputs(parts: readonly Part[], stockLength: number, kerf: number): void {
  if (!Number.isFinite(stockLength) || stockLength <= 0) {
    throw new Error("材の長さは0より大きい有限の数にする");
  }
  if (!Number.isFinite(kerf) || kerf < 0) {
    throw new Error("カットロスは0以上の有限の数にする");
  }
  for (const part of parts) {
    if (!Number.isFinite(part.length) || part.length <= 0) {
      throw new Error(`部材 ${part.id} の長さは0より大きい有限の数にする`);
    }
    if (part.length > stockLength) {
      throw new Error(`部材 ${part.id}（${part.length}mm）は材（${stockLength}mm）より長い`);
    }
  }
}
