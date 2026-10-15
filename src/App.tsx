import type { ReactNode } from "react";
import { CutPlanSection } from "./components/CutPlanSection";
import { FrameView } from "./components/FrameView";
import { MATTRESS, PRICE, STORAGE_BOX } from "./design/constants";
import { FRAME_CUT_PLAN } from "./design/cut-plan";
import { FRAME_HEIGHT, FRAME_MODULES } from "./design/frame";
import { FASTENER_SUMMARY, PART_SUMMARY, PROJECT_COST, PURCHASE_ITEMS } from "./design/materials";

const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export function App() {
  return (
    <>
      <header className="border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
          <div className="grid size-9 grid-cols-2 gap-1" aria-hidden="true">
            <span className="rounded-sm bg-amber-400" />
            <span className="rounded-sm bg-amber-600" />
            <span className="rounded-sm bg-amber-600" />
            <span className="rounded-sm bg-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">
              DIY Design
            </p>
            <p className="font-semibold">セミダブル収納ベッドフレーム</p>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-stone-200 bg-stone-100">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1.35fr_0.65fr] lg:py-16">
            <div>
              <p className="mb-3 text-sm font-bold tracking-widest text-amber-700 uppercase">
                Material &amp; Cost
              </p>
              <h1 className="max-w-3xl text-4xl leading-tight font-black tracking-tight text-stone-950 sm:text-5xl">
                必要な木材と費用
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
                ダンボール箱を収納できる4分割式ベースを、1x4材で作る設計です。
                部材の寸法から12f材の木取りと費用を計算しています。
              </p>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <Spec
                  term="マットレス"
                  value={`${number.format(MATTRESS.width)} × ${number.format(MATTRESS.length)} mm`}
                />
                <Spec
                  term="収納箱"
                  value={`${number.format(STORAGE_BOX.width)} × ${number.format(STORAGE_BOX.depth)} × ${number.format(STORAGE_BOX.height)} mm`}
                />
                <Spec term="完成高さ" value={`${number.format(FRAME_HEIGHT)} mm`} />
                <Spec term="分割数" value={`${number.format(FRAME_MODULES.length)}台`} />
              </dl>
            </div>

            <div className="rounded-2xl bg-stone-950 p-6 text-stone-50 shadow-xl shadow-stone-300/60">
              <p className="text-sm font-medium text-stone-400">概算合計</p>
              <p className="mt-2 text-4xl font-black tracking-tight text-amber-400">
                {yen.format(PROJECT_COST.totalCost)}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-stone-800 pt-5">
                <CostItem label="木材" value={yen.format(PROJECT_COST.lumberCost)} />
                <CostItem label="ネジ" value={yen.format(PROJECT_COST.fastenerCost)} />
                <CostItem label="カット代" value={yen.format(PROJECT_COST.cutCost)} />
              </div>
              <p className="mt-5 text-xs leading-5 text-stone-400">{priceNote()}</p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 lg:py-16">
          <FrameView />

          <section aria-labelledby="purchase-heading">
            <SectionHeading
              id="purchase-heading"
              eyebrow="Purchase"
              title="購入するもの"
              description={`12f材を${number.format(FRAME_CUT_PLAN.boardCount)}本購入し、${number.format(FRAME_CUT_PLAN.pieceCount)}点の部材を切り出します。コーススレッドは使用本数を入数で切り上げて袋で数えます。`}
            />
            <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead className="bg-stone-100 text-xs tracking-wider text-stone-500 uppercase">
                    <tr>
                      <TableHead>材料</TableHead>
                      <TableHead>寸法</TableHead>
                      <TableHead align="right">数量</TableHead>
                      <TableHead align="right">単価</TableHead>
                      <TableHead align="right">小計</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {PURCHASE_ITEMS.map((item) => (
                      <tr key={item.name} className="border-t border-stone-200">
                        <TableCell strong>{item.name}</TableCell>
                        <TableCell>{item.dimensions}</TableCell>
                        <TableCell align="right">
                          {number.format(item.quantity)}
                          {item.unit}
                        </TableCell>
                        <TableCell align="right">{yen.format(item.unitPrice)}</TableCell>
                        <TableCell align="right" strong>
                          {yen.format(item.subtotal)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section aria-labelledby="parts-heading">
            <SectionHeading
              id="parts-heading"
              eyebrow="Parts"
              title="切り出す部材"
              description="4台のモジュールに使う部材を、用途と長さごとにまとめています。"
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PART_SUMMARY.map((part) => (
                <article
                  key={`${part.name}-${part.length}`}
                  className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-stone-600">{part.name}</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <p className="text-2xl font-black tracking-tight text-stone-950">
                      {number.format(part.length)}
                      <span className="ml-1 text-sm font-medium text-stone-500">mm</span>
                    </p>
                    <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                      {number.format(part.quantity)}本
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <CutPlanSection />

          <section
            aria-labelledby="cost-heading"
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <SectionHeading
              id="cost-heading"
              eyebrow="Breakdown"
              title="費用の内訳"
              description="塗料などの副資材は含みません。"
            />
            <dl className="mt-7 divide-y divide-stone-200">
              {PURCHASE_ITEMS.map((item) => (
                <BreakdownRow
                  key={item.name}
                  label={`${item.name} ${number.format(item.quantity)}${item.unit}`}
                  value={item.subtotal}
                />
              ))}
              <BreakdownRow
                label={`カット ${number.format(FRAME_CUT_PLAN.cutCount)}回`}
                value={PROJECT_COST.cutCost}
              />
              <div className="flex items-center justify-between gap-4 pt-5 text-lg font-black">
                <dt>合計</dt>
                <dd className="text-2xl text-amber-700">{yen.format(PROJECT_COST.totalCost)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{term}</dt>
      <dd className="mt-1 font-bold text-stone-900">{value}</dd>
    </div>
  );
}

function priceNote(): string {
  const screws = FASTENER_SUMMARY.map(
    (fastener) =>
      `${fastener.name} ${fastener.thread} ${number.format(fastener.diameter)}×${number.format(fastener.length)} を1袋 ${yen.format(fastener.packPrice)}`,
  ).join("、");
  return `1x4 12f材を1本 ${yen.format(PRICE.lumber)}、1カット ${yen.format(PRICE.cut)}、${screws}として計算`;
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.18em] text-amber-700 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th scope="col" className={`px-5 py-3 font-bold ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
  strong = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-stone-700 ${align === "right" ? "text-right tabular-nums" : ""} ${strong ? "font-bold text-stone-950" : ""}`}
    >
      {children}
    </td>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
      <dt className="text-sm font-medium text-stone-600">{label}</dt>
      <dd className="font-bold text-stone-950 tabular-nums">{yen.format(value)}</dd>
    </div>
  );
}
