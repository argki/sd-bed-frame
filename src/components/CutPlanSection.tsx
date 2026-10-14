import { KERF, LUMBER } from "../design/constants";
import { createBoardLayout } from "../design/cut-layout";
import { FRAME_CUT_PLAN, type StockBoard } from "../design/cut-plan";

const number = new Intl.NumberFormat("ja-JP");

const PART_COLORS: Readonly<Record<string, string>> = {
  天板のすのこ: "#fbbf24",
  柱: "#fb923c",
  上横桟: "#d97706",
  下横桟: "#a16207",
};

export function CutPlanSection() {
  return (
    <section aria-labelledby="cut-plan-heading">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-amber-700 uppercase">Cut plan</p>
        <h2
          id="cut-plan-heading"
          className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl"
        >
          12f材のカット寸法図
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          左端から順に切り出します。赤い線がカット位置、斜線部分が端材です。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-600">
        {Object.entries(PART_COLORS).map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
            {name}
          </span>
        ))}
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm border border-dashed border-stone-400 bg-stone-100" />
          端材
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {FRAME_CUT_PLAN.boards.map((board, index) => (
          <BoardDiagram key={board.id} board={board} index={index} />
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        材の長さは {number.format(LUMBER.length)} mm、カットロスは1か所 {number.format(KERF)}{" "}
        mmとして計算しています。
      </p>
    </section>
  );
}

function BoardDiagram({ board, index }: { board: StockBoard; index: number }) {
  const layout = createBoardLayout(board);
  const patternId = `offcut-${board.id}`;

  return (
    <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <h3 className="font-bold text-stone-900">12f材 {number.format(index + 1)}</h3>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-stone-100 px-3 py-1 font-semibold text-stone-600">
            {number.format(board.cutCount)}カット
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
            端材 {number.format(layout.offcutLength)} mm
          </span>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-4">
        <svg
          className="min-w-3xl"
          viewBox={`0 0 ${LUMBER.length} 220`}
          role="img"
          aria-label={`12f材${index + 1}の木取り。${board.pieces
            .map((piece) => `${piece.name}${piece.length}ミリ`)
            .join("、")}、端材${layout.offcutLength}ミリ`}
        >
          <defs>
            <pattern
              id={patternId}
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="36" height="36" fill="#f5f5f4" />
              <line x1="0" y1="0" x2="0" y2="36" stroke="#d6d3d1" strokeWidth="12" />
            </pattern>
          </defs>

          <rect
            x="1"
            y="1"
            width={LUMBER.length - 2}
            height="178"
            rx="18"
            fill="#fafaf9"
            stroke="#78716c"
            strokeWidth="2"
          />

          {layout.segments.map((segment) => {
            const center = segment.start + segment.piece.length / 2;
            return (
              <g key={segment.piece.id}>
                <rect
                  x={segment.start}
                  y="2"
                  width={segment.piece.length}
                  height="176"
                  fill={PART_COLORS[segment.piece.name] ?? "#fbbf24"}
                />
                <text
                  x={center}
                  y="79"
                  textAnchor="middle"
                  fontSize="42"
                  fontWeight="700"
                  fill="#292524"
                >
                  {segment.piece.name}
                </text>
                <text
                  x={center}
                  y="132"
                  textAnchor="middle"
                  fontSize="38"
                  fontWeight="600"
                  fill="#44403c"
                >
                  {number.format(segment.piece.length)} mm
                </text>
                {segment.kerfAfter > 0 && (
                  <line
                    x1={segment.end + segment.kerfAfter / 2}
                    x2={segment.end + segment.kerfAfter / 2}
                    y1="0"
                    y2="180"
                    stroke="#dc2626"
                    strokeWidth="8"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}

          {layout.offcutLength > 0 && (
            <g>
              <rect
                x={layout.offcutStart}
                y="2"
                width={layout.offcutLength}
                height="176"
                fill={`url(#${patternId})`}
              />
              <text
                x={layout.offcutStart + layout.offcutLength / 2}
                y="105"
                textAnchor="middle"
                fontSize="38"
                fontWeight="700"
                fill="#57534e"
              >
                端材 {number.format(layout.offcutLength)} mm
              </text>
            </g>
          )}

          <text x="0" y="215" fontSize="34" fill="#78716c">
            0
          </text>
          <text x={LUMBER.length} y="215" textAnchor="end" fontSize="34" fill="#78716c">
            {number.format(LUMBER.length)} mm
          </text>
        </svg>
      </div>
    </article>
  );
}
