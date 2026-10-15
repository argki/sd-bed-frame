import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useState } from "react";
import { CanvasTexture, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { MATTRESS, MODULE_FASTENER } from "../design/constants";
import { FRAME_CUT_PLAN, pieceId, pieceLabel } from "../design/cut-plan";
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
import { FASTENER_SUMMARY, MODULE_HARDWARE_SUMMARY } from "../design/materials";
import { MODULE_JOINTS } from "../design/module-joints";
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
  [MODULE_FASTENER.acrossThickness.id]: "#0f766e",
  [MODULE_FASTENER.acrossWidth.id]: "#b45309",
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
  readonly name: string | null;
  readonly label: string | null;
  readonly position: [number, number, number];
  readonly size: [number, number, number];
  readonly color: string;
};

const bedCenterVec: Vec3 = { x: bedCenter[0], y: bedCenter[1], z: bedCenter[2] };

const PIECE_LABELS = new Map(
  FRAME_CUT_PLAN.boards.flatMap((board) =>
    board.pieces.map((piece) => [piece.id, pieceLabel(piece)] as const),
  ),
);

export function FrameView() {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showScrews, setShowScrews] = useState(true);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<ExplodeMode>("module");
  const parts = useMemo(() => partSolids(), []);
  const boxes = useMemo(() => boxSolids(), []);
  const screws = useMemo(() => screwMarkers(), []);
  const centers = useMemo(() => moduleCenters(), []);
  const nameTextures = useMemo(() => partNameTextures(parts), [parts]);

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
            ネジ・ボルトを表示
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
          {parts.map((solid) => {
            const texture = solid.label ? nameTextures.get(solid.label) : undefined;
            if (!texture) {
              return null;
            }
            return (
              <BoardName
                key={`${solid.key}-name`}
                solid={solid}
                position={place(solid, centers, amount, mode)}
                texture={texture}
              />
            );
          })}
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
        {MODULE_HARDWARE_SUMMARY.filter((item) => SCREW_COLORS[item.id]).map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className="mt-1 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: SCREW_COLORS[item.id] }}
            />
            <span>{`${item.name}。${item.usage}。使用${number.format(item.used)}本。`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-5 text-stone-500">
        表示しているネジとボルトの太さは、位置が分かるように実際より太くしています。長さは取り付ける長さです。
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

/** 印字を面から浮かせる量。部材と一緒に平行移動する。 */
const LABEL_GAP = 1.2;

type LabelPose = {
  readonly offset: readonly [number, number, number];
  readonly quaternion: Quaternion;
  readonly width: number;
  readonly height: number;
};

function BoardName({
  solid,
  position,
  texture,
}: {
  solid: Solid;
  position: [number, number, number];
  texture: CanvasTexture;
}) {
  const image = texture.image;
  const aspect =
    image instanceof HTMLCanvasElement && image.height > 0 ? image.width / image.height : 1;
  const poses = useMemo(() => labelPoses(solid.size, aspect), [solid.size, aspect]);
  return (
    <group>
      {poses.map((pose) => (
        <mesh
          key={pose.offset.join(",")}
          position={[
            position[0] + pose.offset[0],
            position[1] + pose.offset[1],
            position[2] + pose.offset[2],
          ]}
          quaternion={pose.quaternion}
        >
          <planeGeometry args={[pose.width, pose.height]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        </mesh>
      ))}
    </group>
  );
}

function partNameTextures(parts: readonly Solid[]): Map<string, CanvasTexture> {
  const textures = new Map<string, CanvasTexture>();
  for (const solid of parts) {
    if (!solid.label || textures.has(solid.label)) {
      continue;
    }
    textures.set(solid.label, createNameTexture(solid.label, solid.color));
  }
  return textures;
}

function createNameTexture(name: string, wood: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("部材名の描画に失敗した");
  }
  const fontSize = 96;
  const font = `700 ${fontSize}px "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
  ctx.font = font;
  const textWidth = Math.ceil(ctx.measureText(name).width);
  const pad = 20;
  canvas.width = Math.max(textWidth + pad * 2, fontSize);
  canvas.height = fontSize + pad * 2;
  ctx.font = font;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = "round";
  ctx.lineWidth = 16;
  ctx.strokeStyle = isDark(wood) ? "rgba(28, 25, 23, 0.55)" : "rgba(255, 250, 240, 0.9)";
  ctx.fillStyle = isDark(wood) ? "#faf7f2" : "#1c1917";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = canvas.width / 2;
  const y = canvas.height / 2;
  ctx.strokeText(name, x, y);
  ctx.fillText(name, x, y);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function isDark(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 150;
}

/** 厚さ方向の両面の中央に、文字の縦横比を保って載せる。 */
function labelPoses(
  size: readonly [number, number, number],
  aspect: number,
): readonly [LabelPose, LabelPose] {
  const [sx, sy, sz] = size;
  if (sy <= sx && sy <= sz) {
    const alongZ = sz >= sx;
    const [width, height] = fitLabel(alongZ ? sz : sx, alongZ ? sx : sz, aspect);
    const textDir = alongZ ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
    return facePair(new Vector3(0, 1, 0), textDir, sy / 2, width, height);
  }
  if (sz <= sx && sz <= sy) {
    const [width, height] = fitLabel(sx, sy, aspect);
    return facePair(new Vector3(0, 0, 1), new Vector3(1, 0, 0), sz / 2, width, height);
  }
  const alongZ = sz >= sy;
  const [width, height] = fitLabel(alongZ ? sz : sy, alongZ ? sy : sz, aspect);
  const textDir = alongZ ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
  return facePair(new Vector3(1, 0, 0), textDir, sx / 2, width, height);
}

function facePair(
  normal: Vector3,
  textDir: Vector3,
  halfExtent: number,
  width: number,
  height: number,
): readonly [LabelPose, LabelPose] {
  return [
    facePose(normal, textDir, halfExtent, width, height),
    facePose(normal.clone().negate(), textDir.clone().negate(), halfExtent, width, height),
  ];
}

function facePose(
  normal: Vector3,
  textDir: Vector3,
  halfExtent: number,
  width: number,
  height: number,
): LabelPose {
  const direction = normal.clone().normalize();
  const gap = halfExtent + LABEL_GAP;
  return {
    offset: [direction.x * gap, direction.y * gap, direction.z * gap],
    quaternion: planeQuaternion(textDir, direction),
    width,
    height,
  };
}

function fitLabel(along: number, across: number, aspect: number): [number, number] {
  const maxAlong = along * 0.84;
  const maxAcross = across * 0.7;
  let width = maxAcross * aspect;
  let height = maxAcross;
  if (width > maxAlong) {
    width = maxAlong;
    height = width / aspect;
  }
  return [width, height];
}

function planeQuaternion(textDir: Vector3, normal: Vector3): Quaternion {
  const x = textDir.clone().normalize();
  const z = normal.clone().normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  x.crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
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
  /** 2 のときは両端にナットを描く。寸切ボルトには頭がない。 */
  readonly nutCount: 1 | 2;
};

function Screw({ marker, head }: { marker: ScrewMarker; head: [number, number, number] }) {
  const rotation = screwRotation(marker.axis);
  const shaftCenter = move(head, marker.axis, marker.inward * (marker.length / 2));
  const ends = marker.nutCount === 2 ? [0, marker.length] : [-SCREW_HEAD_THICKNESS / 2];
  return (
    <group>
      <mesh position={shaftCenter} rotation={rotation} castShadow>
        <cylinderGeometry args={[SCREW_SHAFT_RADIUS, SCREW_SHAFT_RADIUS, marker.length, 10]} />
        <meshStandardMaterial color={marker.color} roughness={0.4} metalness={0.55} />
      </mesh>
      {ends.map((distance) => (
        <mesh
          key={distance}
          position={move(head, marker.axis, marker.inward * distance)}
          rotation={rotation}
          castShadow
        >
          <cylinderGeometry
            args={[SCREW_HEAD_RADIUS, SCREW_HEAD_RADIUS, SCREW_HEAD_THICKNESS, 12]}
          />
          <meshStandardMaterial color={marker.color} roughness={0.4} metalness={0.55} />
        </mesh>
      ))}
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
    return joint.positions.map(
      (point, index): ScrewMarker => ({
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
        nutCount: 1,
      }),
    );
  }).concat(moduleBoltMarkers(origins, parts));
}

const moduleBoltProducts = [MODULE_FASTENER.acrossThickness, MODULE_FASTENER.acrossWidth];

/** ボルトは、接している2本のうち軸の小さい側の柱に付け、分解してもその柱と一緒に動く。 */
function moduleBoltMarkers(
  origins: ReadonlyMap<string, Vec3>,
  parts: ReadonlyMap<string, Part>,
): ScrewMarker[] {
  return MODULE_JOINTS.flatMap((joint) => {
    const end = joint.ends[0];
    const origin = origins.get(end.moduleId);
    const part = parts.get(end.partId);
    const placement = part?.placements[end.placementIndex];
    const product = moduleBoltProducts.find((item) => item.length === joint.boltLength);
    if (!origin || !part || !placement || !product) {
      throw new Error(`モジュール連結 ${joint.id} の部材が見つからない`);
    }
    const size = placedSize(part.length, placement);
    const partCenter = toVec(center(origin, placement.position, size));
    const entry = origin[joint.axis] + placement.position[joint.axis];
    return joint.positions.map(
      (point, index): ScrewMarker => ({
        key: `${joint.id}-${index}`,
        moduleId: end.moduleId,
        head: { ...point, [joint.axis]: entry },
        partCenter,
        axis: joint.axis,
        inward: 1,
        length: product.length,
        color: SCREW_COLORS[product.id] ?? "#0f766e",
        nutCount: product.nutsPerBolt === 2 ? 2 : 1,
      }),
    );
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
    const label = PIECE_LABELS.get(pieceId(part.id, index));
    if (!label) {
      throw new Error(`部材 ${part.id} の${index + 1}本目の連番が見つからない`);
    }
    return {
      key: pieceId(part.id, index),
      moduleId: part.moduleId,
      name: part.name,
      label,
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
    name: null,
    label: null,
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
