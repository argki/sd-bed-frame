import { KERF, LUMBER, LUMBER_STOCKS, PRICE } from "./constants";
import { FRAME_PARTS } from "./frame";
import type { Part } from "./types";

type LumberStock = (typeof LUMBER_STOCKS)[number];

export type CutPiece = {
  readonly id: string;
  readonly partId: string;
  readonly name: string;
  /** 同じ名前の部材の中での番号。1から始まる。 */
  readonly serial: number;
  readonly moduleId: string;
  readonly length: number;
  readonly stockId: string;
};

export type StockBoard = {
  readonly id: string;
  readonly stockId: string;
  readonly stockName: string;
  /** この材種の定尺の長さ。 */
  readonly stockLength: number;
  readonly pieces: readonly CutPiece[];
  /** 部材とカットロスが占める長さ。 */
  readonly usedLength: number;
  readonly remainingLength: number;
  readonly cutCount: number;
};

/** 1つの材種に分けた木取りと、その材の材料費。 */
export type StockCut = {
  readonly id: string;
  readonly name: string;
  readonly thickness: number;
  readonly width: number;
  readonly stockLength: number;
  readonly unitPrice: number;
  readonly boards: readonly StockBoard[];
  readonly boardCount: number;
  readonly cutCount: number;
  readonly materialCost: number;
};

export type CostSummary = {
  readonly materialCost: number;
  readonly cutCost: number;
  readonly totalCost: number;
};

export type CutPlan = {
  readonly stocks: readonly StockCut[];
  readonly boards: readonly StockBoard[];
  readonly boardCount: number;
  readonly pieceCount: number;
  readonly cutCount: number;
  readonly cost: CostSummary;
};

export const FRAME_CUT_PLAN = createCutPlan(FRAME_PARTS);

/**
 * 材種ごとに First Fit Decreasing で木取りする。
 * 断面が違う部材は、同じ1本に入れない。
 * 部材を長い順に並べ、その材種の先の材から、収まる最初の材へ入れる。
 * stockLength を渡したときは、材種ごとの定尺の代わりにその長さを使う。
 */
export function createCutPlan(
  parts: readonly Part[],
  stockLength?: number,
  kerf: number = KERF,
): CutPlan {
  validateInputs(parts, stockLength, kerf);
  const pieces = expandParts(parts);
  const packed = LUMBER_STOCKS.flatMap((stock) => {
    const group = pieces.filter((piece) => piece.stockId === stock.id);
    if (group.length === 0) {
      return [];
    }
    return packStock(stock, group, stockLength ?? stock.length, kerf);
  });
  const boards = numberInDiagramOrder(packed);
  const stocks = LUMBER_STOCKS.flatMap((stock) => {
    const stockBoards = boards.filter((board) => board.stockId === stock.id);
    if (stockBoards.length === 0) {
      return [];
    }
    const cutCount = stockBoards.reduce((sum, board) => sum + board.cutCount, 0);
    const materialCost = stockBoards.length * stock.unitPrice;
    return [
      {
        id: stock.id,
        name: stock.name,
        thickness: stock.thickness,
        width: stock.width,
        stockLength: stockBoards[0]?.stockLength ?? stock.length,
        unitPrice: stock.unitPrice,
        boards: stockBoards,
        boardCount: stockBoards.length,
        cutCount,
        materialCost,
      },
    ];
  });
  const cutCount = stocks.reduce((sum, stock) => sum + stock.cutCount, 0);
  const materialCost = stocks.reduce((sum, stock) => sum + stock.materialCost, 0);
  const cutCost = cutCount * PRICE.cut;

  return {
    stocks,
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
      stockId: stockOf(part).id,
    })),
  );
}

function packStock(
  stock: LumberStock,
  pieces: readonly CutPiece[],
  stockLength: number,
  kerf: number,
): StockBoard[] {
  const sorted = [...pieces].sort(
    (a, b) => b.length - a.length || a.partId.localeCompare(b.partId) || a.id.localeCompare(b.id),
  );
  const boardPieces: CutPiece[][] = [];
  for (const piece of sorted) {
    const board = boardPieces.find((candidate) => canFit([...candidate, piece], stockLength, kerf));
    if (board) {
      board.push(piece);
    } else {
      boardPieces.push([piece]);
    }
  }
  return boardPieces.map((board, index) =>
    summarizeBoard(`${stock.id}-${index + 1}`, stock, board, stockLength, kerf),
  );
}

function stockOf(part: Part): LumberStock {
  const thickness = part.section?.thickness ?? LUMBER.thickness;
  const width = part.section?.width ?? LUMBER.width;
  const stock = LUMBER_STOCKS.find((item) => item.thickness === thickness && item.width === width);
  if (!stock) {
    throw new Error(`部材 ${part.id} の断面 ${thickness}×${width}mm の材種がない`);
  }
  return stock;
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
  stock: LumberStock,
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
    stockId: stock.id,
    stockName: stock.name,
    stockLength,
    pieces,
    usedLength,
    remainingLength: stockLength - usedLength,
    cutCount,
  };
}

function validateInputs(
  parts: readonly Part[],
  stockLength: number | undefined,
  kerf: number,
): void {
  if (stockLength !== undefined && (!Number.isFinite(stockLength) || stockLength <= 0)) {
    throw new Error("材の長さは0より大きい有限の数にする");
  }
  if (!Number.isFinite(kerf) || kerf < 0) {
    throw new Error("カットロスは0以上の有限の数にする");
  }
  for (const part of parts) {
    if (!Number.isFinite(part.length) || part.length <= 0) {
      throw new Error(`部材 ${part.id} の長さは0より大きい有限の数にする`);
    }
    const limit = stockLength ?? stockOf(part).length;
    if (part.length > limit) {
      throw new Error(`部材 ${part.id}（${part.length}mm）は材（${limit}mm）より長い`);
    }
  }
}
