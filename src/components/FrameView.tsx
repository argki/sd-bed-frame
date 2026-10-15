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
import { FRAME_JOINTS } from "../design/joints";
import { FASTENER_SUMMARY } from "../design/materials";
import { type Axis, type Part, placedSize, type Vec3 } from "../design/types";

const PART_COLORS: Readonly<Record<string, string>> = {
  天板のすのこ: "#e8c27a",
  柱: "#c4843c",
  上横桟: "#a16207",
  下横桟: "#854d0e",
};

const BOX_COLOR = "#d6b48c";
const SCREW_COLORS: Readonly<Record<string, string>> = {
  rail: "#292524",
  slat: "#1e3a8a",
};
/** 画面上で位置が分かる太さ。実際の呼び径ではない。 */
const SCREW_SHAFT_RADIUS = 6;
const SCREW_HEAD_RADIUS = 12;
const SCREW_HEAD_THICKNESS = 5;

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
  const [showScrews, setShowScrews] = useState(true);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<ExplodeMode>("module");
  const parts = useMemo(() => partSolids(), []);
  const boxes = useMemo(() => boxSolids(), []);
  const screws = useMemo(() => screwMarkers(), []);
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
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200">
            <input
              type="checkbox"
              className="accent-amber-700"
              checked={showScrews}
              onChange={(event) => setShowScrews(event.target.checked)}
            />
            ネジを表示
          </label>
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
          {showScrews &&
            screws.map((marker) => (
              <Screw
                key={marker.key}
                marker={marker}
                head={placePoint(marker, centers, amount, mode)}
              />
            ))}
          <OrbitControls target={bedCenter} minDistance={700} maxDistance={6000} />
        </Canvas>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
        {FASTENER_SUMMARY.map((fastener) => (
          <li key={fastener.id} className="flex items-start gap-3">
            <span
              className="mt-1 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: SCREW_COLORS[fastener.id] ?? "#292524" }}
            />
            <span>
              {`${fastener.name} ${fastener.thread} ${number.format(fastener.diameter)}×${number.format(fastener.length)}。${fastener.usage}。1か所${number.format(fastener.screwsPerJoint)}本、使用${number.format(fastener.used)}本。`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-5 text-stone-500">
        表示しているネジの太さは、位置が分かるように実際より太くしています。長さは購入するネジと同じです。
      </p>
    </section>
  );
}

const number = new Intl.NumberFormat("ja-JP");

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

type ScrewMarker = {
  readonly key: string;
  readonly moduleId: string;
  readonly head: Vec3;
  readonly partCenter: Vec3;
  readonly axis: Axis;
  /** ネジが進む向き。1 はその軸の正方向。 */
  readonly inward: 1 | -1;
  readonly length: number;
  readonly color: string;
};

function Screw({ marker, head }: { marker: ScrewMarker; head: [number, number, number] }) {
  const rotation = screwRotation(marker.axis);
  const shaftCenter = move(head, marker.axis, marker.inward * (marker.length / 2));
  const headCenter = move(head, marker.axis, -marker.inward * (SCREW_HEAD_THICKNESS / 2));
  return (
    <group>
      <mesh position={shaftCenter} rotation={rotation} castShadow>
        <cylinderGeometry args={[SCREW_SHAFT_RADIUS, SCREW_SHAFT_RADIUS, marker.length, 10]} />
        <meshStandardMaterial color={marker.color} roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={headCenter} rotation={rotation} castShadow>
        <cylinderGeometry args={[SCREW_HEAD_RADIUS, SCREW_HEAD_RADIUS, SCREW_HEAD_THICKNESS, 12]} />
        <meshStandardMaterial color={marker.color} roughness={0.4} metalness={0.55} />
      </mesh>
    </group>
  );
}

function screwRotation(axis: Axis): [number, number, number] {
  if (axis === "x") {
    return [0, 0, Math.PI / 2];
  }
  if (axis === "z") {
    return [Math.PI / 2, 0, 0];
  }
  return [0, 0, 0];
}

function move(
  point: [number, number, number],
  axis: Axis,
  distance: number,
): [number, number, number] {
  const [x, y, z] = point;
  if (axis === "x") {
    return [x + distance, y, z];
  }
  if (axis === "y") {
    return [x, y + distance, z];
  }
  return [x, y, z + distance];
}

function placePoint(
  marker: ScrewMarker,
  centers: ReadonlyMap<string, Vec3>,
  amount: number,
  mode: ExplodeMode,
): [number, number, number] {
  const moduleCenter = centers.get(marker.moduleId);
  if (!moduleCenter) {
    throw new Error(`モジュール ${marker.moduleId} の中心が見つからない`);
  }
  const exploded = explodedPosition(marker.partCenter, moduleCenter, bedCenterVec, amount, mode);
  return [
    marker.head.x + exploded.x - marker.partCenter.x,
    marker.head.y + exploded.y - marker.partCenter.y,
    marker.head.z + exploded.z - marker.partCenter.z,
  ];
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

function screwMarkers(): ScrewMarker[] {
  const origins = new Map(FRAME_MODULES.map((module) => [module.id, module.origin]));
  const parts = new Map(FRAME_PARTS.map((part) => [part.id, part]));
  const fasteners = new Map(FASTENER_SUMMARY.map((fastener) => [fastener.id, fastener]));

  return FRAME_JOINTS.flatMap((joint) => {
    const origin = origins.get(joint.moduleId);
    const part = parts.get(joint.fromPartId);
    const placement = part?.placements[joint.fromPlacementIndex];
    const fastener = fasteners.get(joint.fastenerId);
    if (!origin || !part || !placement || !fastener) {
      throw new Error(`接合 ${joint.id} の部材が見つからない`);
    }
    const size = placedSize(part.length, placement);
    const partCenter = toVec(center(origin, placement.position, size));
    return joint.positions.map((point, index) => ({
      key: `${joint.id}-${index}`,
      moduleId: joint.moduleId,
      head: {
        x: origin.x + point.x,
        y: origin.y + point.y,
        z: origin.z + point.z,
      },
      partCenter,
      axis: joint.face.axis,
      inward: joint.face.side === "min" ? 1 : -1,
      length: fastener.length,
      color: SCREW_COLORS[fastener.id] ?? "#292524",
    }));
  });
}

function toVec(point: [number, number, number]): Vec3 {
  return { x: point[0], y: point[1], z: point[2] };
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
