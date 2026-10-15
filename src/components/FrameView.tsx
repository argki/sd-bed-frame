import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useState } from "react";
import { MATTRESS } from "../design/constants";
import { type ExplodeMode, explodedPosition } from "../design/explode";
import {
  FRAME_HEIGHT,
  FRAME_MODULES,
  FRAME_PARTS,
  MODULE_SIZE,
  STORAGE_SLOTS,
  type StorageSlot,
} from "../design/frame";
import { type Part, placedSize, type Vec3 } from "../design/types";

const PART_COLORS: Readonly<Record<string, string>> = {
  天板のすのこ: "#e8c27a",
  柱: "#c4843c",
  上横桟: "#a16207",
  下横桟: "#854d0e",
};

const BOX_COLOR = "#d6b48c";

const bedCenter: [number, number, number] = [
  MATTRESS.width / 2,
  FRAME_HEIGHT / 2,
  MATTRESS.length / 2,
];

type Solid = {
  readonly key: string;
  readonly moduleId: string;
  readonly position: [number, number, number];
  readonly size: [number, number, number];
  readonly color: string;
};

const bedCenterVec: Vec3 = { x: bedCenter[0], y: bedCenter[1], z: bedCenter[2] };

export function FrameView() {
  const [showBoxes, setShowBoxes] = useState(true);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<ExplodeMode>("module");
  const parts = useMemo(() => partSolids(), []);
  const boxes = useMemo(() => boxSolids(), []);
  const centers = useMemo(() => moduleCenters(), []);

  return (
    <section aria-labelledby="frame-view-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-amber-700 uppercase">Preview</p>
          <h2
            id="frame-view-heading"
            className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl"
          >
            組み立て済みの完成イメージ
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            ドラッグで回転、スクロールで拡大縮小できます。スライダーで分解の度合いを変えます。
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200">
          <input
            type="checkbox"
            className="accent-amber-700"
            checked={showBoxes}
            onChange={(event) => setShowBoxes(event.target.checked)}
          />
          ダンボール箱を表示
        </label>
      </div>

      <div className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="grid gap-2 text-sm font-semibold text-stone-700">
          <span className="flex items-center justify-between gap-3">
            分解
            <span className="tabular-nums text-stone-500">{Math.round(amount * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={amount}
            aria-valuetext={amount === 0 ? "組み立て済み" : amount === 1 ? "分解" : undefined}
            onChange={(event) => setAmount(event.target.valueAsNumber)}
            className="accent-amber-700"
          />
        </label>
        <div className="flex rounded-full bg-stone-100 p-1 text-sm font-bold">
          <ExplodeModeButton
            pressed={mode === "module"}
            onClick={() => setMode("module")}
            label="モジュール"
          />
          <ExplodeModeButton
            pressed={mode === "part"}
            onClick={() => setMode("part")}
            label="部材"
          />
        </div>
      </div>

      <div className="mt-6 h-[32rem] overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 shadow-sm">
        <Canvas shadows camera={{ fov: 38, near: 10, far: 20000 }} gl={{ antialias: true }}>
          <FrameCamera />
          <color attach="background" args={["#e7e5e4"]} />
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[1800, 2400, 1200]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-1800}
            shadow-camera-right={1800}
            shadow-camera-top={1800}
            shadow-camera-bottom={-1800}
            shadow-camera-near={100}
            shadow-camera-far={7000}
          />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[bedCenter[0], -2, bedCenter[2]]}
            receiveShadow
          >
            <planeGeometry args={[6000, 6000]} />
            <meshStandardMaterial color="#f5f5f4" />
          </mesh>
          {parts.map((solid) => (
            <Board key={solid.key} solid={solid} position={place(solid, centers, amount, mode)} />
          ))}
          {showBoxes &&
            boxes.map((solid) => (
              <Board key={solid.key} solid={solid} position={place(solid, centers, amount, mode)} />
            ))}
          <OrbitControls target={bedCenter} minDistance={700} maxDistance={6000} />
        </Canvas>
      </div>
    </section>
  );
}

function FrameCamera() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  useLayoutEffect(() => {
    // 画面が狭いほどカメラを引き、最初からベッド全体が入るようにする。
    const distance = Math.max(2400, 3_400_000 / Math.max(width, 280));
    camera.position.set(
      bedCenter[0] + distance * 0.72,
      distance * 0.5,
      bedCenter[2] + distance * 0.82,
    );
    camera.lookAt(bedCenter[0], bedCenter[1], bedCenter[2]);
    camera.updateProjectionMatrix();
  }, [camera, width]);
  return null;
}

function ExplodeModeButton({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-4 py-2 ${pressed ? "bg-stone-950 text-white" : "text-stone-600"}`}
    >
      {label}
    </button>
  );
}

function place(
  solid: Solid,
  centers: ReadonlyMap<string, Vec3>,
  amount: number,
  mode: ExplodeMode,
): [number, number, number] {
  const moduleCenter = centers.get(solid.moduleId);
  if (!moduleCenter) {
    throw new Error(`モジュール ${solid.moduleId} の中心が見つからない`);
  }
  const position = explodedPosition(
    { x: solid.position[0], y: solid.position[1], z: solid.position[2] },
    moduleCenter,
    bedCenterVec,
    amount,
    mode,
  );
  return [position.x, position.y, position.z];
}

function Board({ solid, position }: { solid: Solid; position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={solid.size} />
      <meshStandardMaterial color={solid.color} roughness={0.82} metalness={0.02} />
    </mesh>
  );
}

function partSolids(): Solid[] {
  const origins = new Map(FRAME_MODULES.map((module) => [module.id, module.origin]));
  return FRAME_PARTS.flatMap((part) =>
    placementsOf(part, origins, PART_COLORS[part.name] ?? "#e8c27a"),
  );
}

function boxSolids(): Solid[] {
  const origins = new Map(FRAME_MODULES.map((module) => [module.id, module.origin]));
  return STORAGE_SLOTS.map((slot, index) => solidFrom(slot, origins, `box-${index}`, BOX_COLOR));
}

function placementsOf(part: Part, origins: ReadonlyMap<string, Vec3>, color: string): Solid[] {
  return part.placements.map((placement, index) => {
    const origin = origins.get(part.moduleId);
    if (!origin) {
      throw new Error(`モジュール ${part.moduleId} が見つからない`);
    }
    const size = placedSize(part.length, placement);
    return {
      key: `${part.id}-${index}`,
      moduleId: part.moduleId,
      position: center(origin, placement.position, size),
      size: [size.x, size.y, size.z],
      color,
    };
  });
}

function solidFrom(
  slot: StorageSlot,
  origins: ReadonlyMap<string, Vec3>,
  key: string,
  color: string,
): Solid {
  const origin = origins.get(slot.moduleId);
  if (!origin) {
    throw new Error(`モジュール ${slot.moduleId} が見つからない`);
  }
  return {
    key,
    moduleId: slot.moduleId,
    position: center(origin, slot.position, slot.size),
    size: [slot.size.x, slot.size.y, slot.size.z],
    color,
  };
}

function moduleCenters(): Map<string, Vec3> {
  return new Map(
    FRAME_MODULES.map((module) => [
      module.id,
      {
        x: module.origin.x + MODULE_SIZE.width / 2,
        y: FRAME_HEIGHT / 2,
        z: module.origin.z + MODULE_SIZE.length / 2,
      },
    ]),
  );
}

function center(origin: Vec3, position: Vec3, size: Vec3): [number, number, number] {
  return [
    origin.x + position.x + size.x / 2,
    origin.y + position.y + size.y / 2,
    origin.z + position.z + size.z / 2,
  ];
}
