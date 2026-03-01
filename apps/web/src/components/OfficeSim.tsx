"use client";

import { useEffect, useMemo, useRef } from "react";
import type { WorkspaceSceneAgent } from "@second-space/shared-types";
import * as THREE from "three";

type SimAgent = WorkspaceSceneAgent;

type RolePalette = {
  shirt: number;
  pants: number;
  hair: number;
  skin: number;
  badge: string;
};

type AgentEntity = {
  id: string;
  group: THREE.Group;
  target: THREE.Vector3;
  state: SimAgent["state"];
  mood: number;
  bobSeed: number;
  ring: THREE.Mesh;
  stateOrb: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
  pickables: THREE.Object3D[];
  torso: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
};

interface OfficeSimProps {
  agents: SimAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

const ROLE_PALETTES: Record<SimAgent["role"], RolePalette> = {
  DIRECTOR: {
    shirt: 0xd1a35c,
    pants: 0x384a8a,
    hair: 0x4b2d1d,
    skin: 0xf3c5a0,
    badge: "#70a8ff"
  },
  MANAGER: {
    shirt: 0x57baab,
    pants: 0x31457d,
    hair: 0x3a2b45,
    skin: 0xe9b48c,
    badge: "#8cda9c"
  },
  SPECIALIST: {
    shirt: 0x5c96e1,
    pants: 0x2f457e,
    hair: 0x2b5966,
    skin: 0xefc19c,
    badge: "#ffd37a"
  }
};

const SIM_WORLD = {
  minX: 60,
  maxX: 560,
  minY: 80,
  maxY: 340,
  width: 31,
  depth: 18.4,
  overlayPaddingX: 8,
  overlayPaddingY: 10
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSimAxis(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

function mapStateColor(state: SimAgent["state"]): number {
  if (state === "BLOCKED") return 0xf26f7d;
  if (state === "WORKING") return 0x64dd8e;
  if (state === "MEETING") return 0xffcf6f;
  if (state === "MOVING") return 0x88c7ff;
  return 0xccd8ef;
}

function mapStateColorCss(state: SimAgent["state"]): string {
  if (state === "BLOCKED") return "#f26f7d";
  if (state === "WORKING") return "#64dd8e";
  if (state === "MEETING") return "#ffcf6f";
  if (state === "MOVING") return "#88c7ff";
  return "#d4ddef";
}

function moodOpacity(mood?: SimAgent["mood"]): number {
  if (mood === "FOCUSED") return 1;
  if (mood === "STRESSED") return 0.76;
  return 0.9;
}

function getAgentCoordinates(agent: SimAgent): { x: number; y: number } {
  return {
    x: agent.simPosition?.x ?? 100,
    y: agent.simPosition?.y ?? 120
  };
}

function mapSimToWorld(x: number, y: number): THREE.Vector3 {
  const normalizedX = normalizeSimAxis(x, SIM_WORLD.minX, SIM_WORLD.maxX);
  const normalizedY = normalizeSimAxis(y, SIM_WORLD.minY, SIM_WORLD.maxY);

  return new THREE.Vector3((normalizedX - 0.5) * SIM_WORLD.width, 0, (normalizedY - 0.5) * SIM_WORLD.depth);
}

function mapSimToOverlay(x: number, y: number): { left: string; top: string } {
  const normalizedX = normalizeSimAxis(x, SIM_WORLD.minX, SIM_WORLD.maxX);
  const normalizedY = normalizeSimAxis(y, SIM_WORLD.minY, SIM_WORLD.maxY);
  const left = SIM_WORLD.overlayPaddingX + normalizedX * (100 - SIM_WORLD.overlayPaddingX * 2);
  const top = SIM_WORLD.overlayPaddingY + normalizedY * (100 - SIM_WORLD.overlayPaddingY * 2);

  return {
    left: `${left}%`,
    top: `${top}%`
  };
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function createMaterial(color: number, options?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.68,
    metalness: 0.04,
    transparent: true,
    ...options
  });
}

function createBox(
  width: number,
  height: number,
  depth: number,
  color: number,
  x: number,
  y: number,
  z: number,
  options?: Partial<THREE.MeshStandardMaterialParameters> & { castShadow?: boolean; receiveShadow?: boolean }
): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const material = createMaterial(color, options);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options?.castShadow ?? true;
  mesh.receiveShadow = options?.receiveShadow ?? true;
  return { mesh, material };
}

function addDesk(group: THREE.Group, x: number, z: number, width = 4.6, depth = 2.05, rotation = 0) {
  const deskTop = createBox(width, 0.22, depth, 0xd89d68, x, 1.68, z, { roughness: 0.56 });
  deskTop.mesh.rotation.y = rotation;
  group.add(deskTop.mesh);

  const legOffsets = [
    [-width / 2 + 0.18, -depth / 2 + 0.18],
    [width / 2 - 0.18, -depth / 2 + 0.18],
    [-width / 2 + 0.18, depth / 2 - 0.18],
    [width / 2 - 0.18, depth / 2 - 0.18]
  ];

  for (const [legX, legZ] of legOffsets) {
    const leg = createBox(0.16, 1.58, 0.16, 0xe7ebef, x + legX, 0.85, z + legZ, { roughness: 0.52 });
    leg.mesh.rotation.y = rotation;
    group.add(leg.mesh);
  }

  const monitorOffsets = [-1.15, 0.2, 1.55];
  for (const offset of monitorOffsets) {
    const screen = createBox(0.72, 0.48, 0.08, 0x121720, x + offset, 2.12, z - 0.18, {
      emissive: 0x2b6ed8,
      emissiveIntensity: 0.16,
      roughness: 0.35
    });
    const frame = createBox(0.82, 0.56, 0.04, 0xf1f4f8, x + offset, 2.1, z - 0.25, { roughness: 0.4 });
    const stand = createBox(0.08, 0.3, 0.08, 0xe7ebef, x + offset, 1.8, z - 0.24, { roughness: 0.45 });
    screen.mesh.rotation.y = rotation;
    frame.mesh.rotation.y = rotation;
    stand.mesh.rotation.y = rotation;
    group.add(frame.mesh);
    group.add(screen.mesh);
    group.add(stand.mesh);
  }

  const chairOffsets = [-1.1, 0.35, 1.8];
  for (const offset of chairOffsets) {
    const seat = createBox(0.72, 0.18, 0.72, 0x515861, x + offset, 1.05, z + 1.02, { roughness: 0.72 });
    const back = createBox(0.72, 0.74, 0.12, 0x5d6570, x + offset, 1.45, z + 1.32, { roughness: 0.7 });
    const stem = createBox(0.1, 0.52, 0.1, 0x313640, x + offset, 0.72, z + 1.04, { roughness: 0.55 });
    seat.mesh.rotation.y = rotation;
    back.mesh.rotation.y = rotation;
    stem.mesh.rotation.y = rotation;
    group.add(seat.mesh);
    group.add(back.mesh);
    group.add(stem.mesh);
  }
}

function addCabinet(group: THREE.Group, x: number, z: number, width = 2.8, depth = 1.2) {
  const body = createBox(width, 1.92, depth, 0xd8c091, x, 0.96, z, { roughness: 0.7 });
  group.add(body.mesh);

  const shelf1 = createBox(width - 0.12, 0.1, depth - 0.12, 0xcbb07a, x, 0.72, z, { roughness: 0.7 });
  const shelf2 = createBox(width - 0.12, 0.1, depth - 0.12, 0xcbb07a, x, 1.3, z, { roughness: 0.7 });
  group.add(shelf1.mesh);
  group.add(shelf2.mesh);

  const drawerLeft = createBox(width * 0.44, 0.82, depth * 0.46, 0xf3f2ef, x - width * 0.22, 0.46, z + depth * 0.18, { roughness: 0.55 });
  const drawerRight = createBox(width * 0.44, 0.82, depth * 0.46, 0xf3f2ef, x + width * 0.22, 0.46, z + depth * 0.18, { roughness: 0.55 });
  group.add(drawerLeft.mesh);
  group.add(drawerRight.mesh);
}

function addPillar(group: THREE.Group, x: number, z: number, width: number, depth: number, height: number, color: number) {
  const pillar = createBox(width, height, depth, color, x, height / 2, z, { roughness: 0.92 });
  group.add(pillar.mesh);
}

function addGlassPanel(group: THREE.Group, x: number, z: number, width: number, height: number, depth: number, rotationY = 0) {
  const panel = createBox(width, height, depth, 0xf4f7fd, x, 2.95, z, {
    opacity: 0.18,
    roughness: 0.14,
    metalness: 0.08
  });
  panel.mesh.rotation.y = rotationY;
  group.add(panel.mesh);

  const frameColor = 0xf7f6f1;
  const horizontalTop = createBox(width + 0.04, 0.05, depth + 0.04, frameColor, x, 4.35, z, { roughness: 0.5 });
  const horizontalBottom = createBox(width + 0.04, 0.05, depth + 0.04, frameColor, x, 1.55, z, { roughness: 0.5 });
  horizontalTop.mesh.rotation.y = rotationY;
  horizontalBottom.mesh.rotation.y = rotationY;
  group.add(horizontalTop.mesh);
  group.add(horizontalBottom.mesh);

  const verticalCount = Math.max(2, Math.round((rotationY === 0 ? width : depth) / 1.15));
  for (let index = 0; index < verticalCount; index += 1) {
    const factor = verticalCount === 1 ? 0.5 : index / (verticalCount - 1);
    const local = (factor - 0.5) * (rotationY === 0 ? width : depth);
    const mullion = createBox(0.05, height, 0.05, frameColor, rotationY === 0 ? x + local : x, 2.95, rotationY === 0 ? z : z + local, {
      roughness: 0.5
    });
    mullion.mesh.rotation.y = rotationY;
    group.add(mullion.mesh);
  }
}

function addMeetingRoom(group: THREE.Group) {
  addPillar(group, -10.4, -5.3, 0.5, 6.8, 3.1, 0xd7cfbf);
  addPillar(group, -4.6, -5.3, 0.5, 6.8, 3.1, 0xd7cfbf);
  addPillar(group, -7.5, -8.3, 6.3, 0.6, 3.1, 0xd8d0c0);
  addPillar(group, -7.6, -2.2, 5.2, 0.34, 3.1, 0xdcd6c8);
  addGlassPanel(group, -7.5, -8.15, 5.8, 2.8, 0.06, 0);
  addGlassPanel(group, -10.16, -5.3, 0.06, 2.8, 6.1, 0);
  addGlassPanel(group, -4.84, -5.3, 0.06, 2.8, 6.1, 0);
  addGlassPanel(group, -7.48, -2.34, 5.1, 2.8, 0.06, 0);

  const table = createBox(2.9, 0.18, 1.3, 0xd2a06a, -7.35, 1.28, -5.3, { roughness: 0.55 });
  group.add(table.mesh);
  const base = createBox(0.28, 1.08, 0.72, 0x84715e, -7.35, 0.7, -5.3, { roughness: 0.7 });
  group.add(base.mesh);

  const chairPositions = [
    [-8.45, -6.05],
    [-6.25, -6.05],
    [-8.45, -4.55],
    [-6.25, -4.55]
  ];
  for (const [chairX, chairZ] of chairPositions) {
    const seat = createBox(0.72, 0.14, 0.72, 0xb88d61, chairX, 0.8, chairZ, { roughness: 0.78 });
    const back = createBox(0.72, 0.7, 0.12, 0xb88d61, chairX, 1.18, chairZ - 0.28, { roughness: 0.78 });
    group.add(seat.mesh);
    group.add(back.mesh);
  }
}

function addBreakArea(group: THREE.Group) {
  const rug = createBox(6.7, 0.04, 4.3, 0xe1d0ad, 8.8, -0.02, -6.85, { roughness: 0.92, receiveShadow: true, castShadow: false });
  group.add(rug.mesh);

  const poufPositions = [
    [7.25, -7.4],
    [10.4, -5.95],
    [11.5, -8.25]
  ];
  for (const [poufX, poufZ] of poufPositions) {
    const poufMaterial = createMaterial(0xdfb25f, { roughness: 0.74 });
    const pouf = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.96, 0.88, 18), poufMaterial);
    pouf.position.set(poufX, 0.42, poufZ);
    pouf.castShadow = true;
    pouf.receiveShadow = true;
    group.add(pouf);
  }
}

function addBins(group: THREE.Group) {
  const positions = [
    [2.4, -1.1],
    [5.6, 3.2],
    [-0.2, 5.3]
  ];

  for (const [binX, binZ] of positions) {
    const material = createMaterial(0x4e5259, { roughness: 0.42, opacity: 0.34 });
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.74, 20, 1, true), material);
    bin.position.set(binX, 0.36, binZ);
    bin.castShadow = true;
    bin.receiveShadow = true;
    group.add(bin);
  }
}

function addFloorScene(scene: THREE.Scene) {
  const office = new THREE.Group();

  const floor = createBox(33.5, 0.4, 22.5, 0xe4d2b4, 0, -0.22, 0, {
    roughness: 0.96,
    receiveShadow: true,
    castShadow: false
  });
  office.add(floor.mesh);

  const floorInset = createBox(31.2, 0.04, 20.2, 0xe9dbc2, 0, 0.01, 0, {
    roughness: 0.94,
    receiveShadow: true,
    castShadow: false
  });
  office.add(floorInset.mesh);

  for (let row = 0; row < 14; row += 1) {
    const seam = createBox(30.8, 0.015, 0.045, 0xd6c19b, 0, 0.035, -9.4 + row * 1.45, {
      roughness: 1,
      receiveShadow: true,
      castShadow: false,
      opacity: 0.42
    });
    office.add(seam.mesh);
  }

  const dividerWall = createBox(0.46, 4.05, 8.7, 0xd7cfbf, -12.35, 2.02, -3.35, { roughness: 0.92 });
  office.add(dividerWall.mesh);
  const dividerReturn = createBox(5.9, 4.05, 0.46, 0xd7cfbf, -9.55, 2.02, 0.75, { roughness: 0.92 });
  office.add(dividerReturn.mesh);

  const partitionTop = createBox(6.1, 0.32, 0.28, 0xf3f1eb, 7.6, 2.9, 0.2, { roughness: 0.46 });
  office.add(partitionTop.mesh);

  addMeetingRoom(office);
  addBreakArea(office);
  addCabinet(office, -1.75, -0.85, 2.9, 1.26);
  addCabinet(office, -1.75, 4.15, 2.9, 1.26);
  addCabinet(office, 2.85, -0.85, 2.9, 1.26);
  addDesk(office, 10.3, 5.45, 5.5, 2.2, 0);
  addDesk(office, 4.35, 7.6, 5.4, 2.16, 0);
  addDesk(office, 10.95, 10.05, 5.35, 2.2, 0);
  addBins(office);

  const glow = createBox(31.5, 0.03, 20.7, 0xffffff, 0, -0.08, 0, {
    opacity: 0.06,
    roughness: 1,
    receiveShadow: false,
    castShadow: false
  });
  office.add(glow.mesh);

  scene.add(office);
}

function createAgentEntity(agent: SimAgent): AgentEntity {
  const palette = ROLE_PALETTES[agent.role];
  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];
  const pickables: THREE.Object3D[] = [];

  const torso = createBox(1.2, 1.25, 0.62, palette.shirt, 0, 1.24, 0);
  const leftArm = createBox(0.26, 1.02, 0.26, palette.skin, -0.77, 1.2, 0);
  const rightArm = createBox(0.26, 1.02, 0.26, palette.skin, 0.77, 1.2, 0);
  const leftLeg = createBox(0.4, 1.05, 0.4, palette.pants, -0.28, 0.35, 0);
  const rightLeg = createBox(0.4, 1.05, 0.4, palette.pants, 0.28, 0.35, 0);
  const head = createBox(0.92, 0.92, 0.92, palette.skin, 0, 2.07, 0);
  const hair = createBox(0.94, 0.24, 0.94, palette.hair, 0, 2.5, 0, { castShadow: false });

  const eyeMaterial = createMaterial(0x122648, { roughness: 0.35, metalness: 0 });
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMaterial);
  const rightEyeMaterial = eyeMaterial.clone();
  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), rightEyeMaterial);
  leftEye.position.set(-0.16, 2.12, 0.47);
  rightEye.position.set(0.16, 2.12, 0.47);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 10, 52), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;

  const orbColor = mapStateColor(agent.state);
  const orbMaterial = createMaterial(orbColor, { emissive: orbColor, emissiveIntensity: 0.36, roughness: 0.35 });
  const stateOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), orbMaterial);
  stateOrb.position.set(0, 3.02, 0);

  const parts = [torso, leftArm, rightArm, leftLeg, rightLeg, head, hair];
  for (const part of parts) {
    part.mesh.userData.agentId = agent.id;
    group.add(part.mesh);
    materials.push(part.material);
    pickables.push(part.mesh);
  }

  leftEye.userData.agentId = agent.id;
  rightEye.userData.agentId = agent.id;
  group.add(leftEye);
  group.add(rightEye);
  group.add(ring);
  group.add(stateOrb);

  materials.push(eyeMaterial, rightEyeMaterial, ringMaterial as unknown as THREE.MeshStandardMaterial, orbMaterial);

  const coordinates = getAgentCoordinates(agent);
  group.position.copy(mapSimToWorld(coordinates.x, coordinates.y));
  group.scale.setScalar(0.58);

  return {
    id: agent.id,
    group,
    target: mapSimToWorld(coordinates.x, coordinates.y),
    state: agent.state,
    mood: moodOpacity(agent.mood),
    bobSeed: Math.random() * Math.PI * 2,
    ring,
    stateOrb,
    materials,
    pickables,
    torso: torso.mesh,
    head: head.mesh,
    leftArm: leftArm.mesh,
    rightArm: rightArm.mesh,
    leftLeg: leftLeg.mesh,
    rightLeg: rightLeg.mesh
  };
}

export default function OfficeSim({ agents, selectedAgentId, onSelectAgent }: OfficeSimProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const entitiesRef = useRef<Map<string, AgentEntity>>(new Map());
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const selectedAgentRef = useRef<string | null>(selectedAgentId);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  const statusPill = useMemo(() => {
    const meetingCount = agents.filter((agent) => agent.state === "MEETING").length;
    const blockedCount = agents.filter((agent) => agent.state === "BLOCKED").length;
    const movingCount = agents.filter((agent) => agent.state === "MOVING").length;

    if (meetingCount > 0) {
      return {
        title: "Internal Team",
        subtitle: `${meetingCount} in meeting${blockedCount > 0 ? ` • ${blockedCount} blocked` : ""}`
      };
    }

    if (movingCount > 0) {
      return {
        title: "Agent Floor",
        subtitle: `${movingCount} moving across the workspace`
      };
    }

    return {
      title: "Agent Workspace",
      subtitle: `${agents.length} agents online`
    };
  }, [agents]);

  useEffect(() => {
    selectedAgentRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    if (!hostRef.current || rendererRef.current) {
      return;
    }

    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0xf6efe3, 0.0125);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
    camera.position.set(19.5, 20.5, 18.5);
    camera.lookAt(2.2, 1.15, 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 500);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.imageRendering = "pixelated";
    renderer.domElement.className = "office-sim-canvas";

    const hemiLight = new THREE.HemisphereLight(0xfff6ea, 0xc4b18d, 1.28);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff1dd, 1.4);
    sun.position.set(13, 24, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.58);
    fill.position.set(-16, 14, 12);
    scene.add(fill);

    const rim = new THREE.PointLight(0xf1c8ff, 0.9, 42);
    rim.position.set(12, 8, -7);
    scene.add(rim);

    addFloorScene(scene);

    const handlePointerDown = (event: PointerEvent) => {
      if (!rendererRef.current || !cameraRef.current || !hostRef.current) {
        return;
      }

      const bounds = hostRef.current.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycasterRef.current.setFromCamera(pointerRef.current, cameraRef.current);
      const hits = raycasterRef.current.intersectObjects(pickablesRef.current, false);
      const hitAgentId = hits[0]?.object?.userData?.agentId;

      if (typeof hitAgentId === "string") {
        onSelectAgent(hitAgentId);
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(() => {
      if (!hostRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }

      const width = Math.max(320, hostRef.current.clientWidth);
      const height = Math.max(260, hostRef.current.clientHeight);

      rendererRef.current.setSize(width, height, false);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    });

    resizeObserver.observe(host);
    host.appendChild(renderer.domElement);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        return;
      }

      const elapsed = clockRef.current.getElapsedTime();

      for (const entity of entitiesRef.current.values()) {
        const deltaX = entity.target.x - entity.group.position.x;
        const deltaZ = entity.target.z - entity.group.position.z;

        entity.group.position.x += deltaX * 0.12;
        entity.group.position.z += deltaZ * 0.12;

        const walking = entity.state === "MOVING";
        const working = entity.state === "WORKING";
        const meeting = entity.state === "MEETING";
        const walkBob = walking ? Math.sin(elapsed * 8 + entity.bobSeed) * 0.14 : 0;
        const workMotion = working ? Math.sin(elapsed * 3 + entity.bobSeed) * 0.04 : 0;
        const meetingMotion = meeting ? Math.sin(elapsed * 2 + entity.bobSeed) * 0.03 : 0;
        const desiredY = walkBob + workMotion + meetingMotion;
        const walkPhase = elapsed * 11 + entity.bobSeed;
        const walkStride = walking ? Math.sin(walkPhase) * 0.55 : 0;
        const walkArmStride = walking ? Math.sin(walkPhase + Math.PI) * 0.42 : 0;
        const workArmMotion = working ? Math.sin(elapsed * 5.8 + entity.bobSeed) * 0.08 : 0;
        const meetingArmMotion = meeting ? Math.sin(elapsed * 2.4 + entity.bobSeed) * 0.05 : 0;
        const idleArmMotion = !walking && !working && !meeting ? Math.sin(elapsed * 1.5 + entity.bobSeed) * 0.02 : 0;
        const armTarget = walkArmStride + workArmMotion + meetingArmMotion + idleArmMotion;
        const torsoTarget = walking ? 0.12 : working ? 0.05 : 0;
        const headTarget = walking ? -0.08 : meeting ? 0.05 : 0;
        const facing = Math.atan2(deltaX, deltaZ || 0.0001);
        const sway = walking ? Math.sin(elapsed * 7 + entity.bobSeed) * 0.05 : meeting ? Math.sin(elapsed * 1.5 + entity.bobSeed) * 0.08 : 0;

        entity.group.position.y += (desiredY - entity.group.position.y) * 0.22;
        entity.group.rotation.y += ((walking ? facing : 0.2) + sway - entity.group.rotation.y) * 0.16;
        entity.leftLeg.rotation.x += (walkStride - entity.leftLeg.rotation.x) * 0.34;
        entity.rightLeg.rotation.x += (-walkStride - entity.rightLeg.rotation.x) * 0.34;
        entity.leftArm.rotation.x += (armTarget - entity.leftArm.rotation.x) * 0.34;
        entity.rightArm.rotation.x += (-armTarget - entity.rightArm.rotation.x) * 0.34;
        entity.torso.rotation.x += (torsoTarget - entity.torso.rotation.x) * 0.22;
        entity.head.rotation.x += (headTarget - entity.head.rotation.x) * 0.24;

        entity.ring.visible = selectedAgentRef.current === entity.id;
        entity.ring.rotation.z += 0.015;
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      entitiesRef.current.clear();
      pickablesRef.current = [];

      scene.traverse((object) => {
        const maybeMesh = object as THREE.Mesh;
        if (maybeMesh.geometry) {
          maybeMesh.geometry.dispose();
        }

        const material = maybeMesh.material;
        if (Array.isArray(material)) {
          for (const value of material) {
            value.dispose();
          }
        } else if (material) {
          material.dispose();
        }
      });

      renderer.dispose();
      host.removeChild(renderer.domElement);

      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, [onSelectAgent]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const entityMap = entitiesRef.current;
    const incomingIds = new Set(agents.map((agent) => agent.id));

    for (const agent of agents) {
      let entity = entityMap.get(agent.id);

      if (!entity) {
        entity = createAgentEntity(agent);
        entityMap.set(agent.id, entity);
        scene.add(entity.group);
      }

      const coordinates = getAgentCoordinates(agent);
      entity.target.copy(mapSimToWorld(coordinates.x, coordinates.y));
      entity.state = agent.state;
      entity.mood = moodOpacity(agent.mood);

      const selected = selectedAgentId === agent.id;
      entity.ring.visible = selected;

      const orbMaterial = entity.stateOrb.material as THREE.MeshStandardMaterial;
      const statusColor = mapStateColor(agent.state);
      orbMaterial.color.setHex(statusColor);
      orbMaterial.emissive.setHex(statusColor);

      for (const material of entity.materials) {
        material.opacity = entity.mood;
      }

      if (agent.state === "BLOCKED") {
        for (const pickable of entity.pickables) {
          const material = (pickable as THREE.Mesh).material as THREE.MeshStandardMaterial;
          material.emissive.setHex(0x39161b);
          material.emissiveIntensity = 0.12;
        }
      } else {
        for (const pickable of entity.pickables) {
          const material = (pickable as THREE.Mesh).material as THREE.MeshStandardMaterial;
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      }
    }

    for (const [id, entity] of entityMap) {
      if (incomingIds.has(id)) {
        continue;
      }

      scene.remove(entity.group);
      entityMap.delete(id);
    }

    pickablesRef.current = Array.from(entityMap.values()).flatMap((entity) => entity.pickables);
  }, [agents, selectedAgentId]);

  return (
    <div className="office-sim-root" ref={hostRef}>
      <div className="office-sim-overlay office-sim-overlay-top">
        <div className="office-sim-backdrop-pill office-sim-room-pill">Workspace Floor</div>
        <div className="office-sim-backdrop-pill office-sim-status-pill">
          <span className="office-sim-status-icon" aria-hidden="true">
            ✦
          </span>
          <div>
            <strong>{statusPill.title}</strong>
            <span>{statusPill.subtitle}</span>
          </div>
        </div>
      </div>

      <div className="office-sim-overlay office-sim-room-labels" aria-hidden="true">
        <span className="office-room-chip" style={{ left: "19%", top: "22%" }}>
          Meeting Room
        </span>
        <span className="office-room-chip" style={{ left: "77%", top: "18%" }}>
          Lounge
        </span>
        <span className="office-room-chip" style={{ left: "72%", top: "68%" }}>
          Focus Pods
        </span>
      </div>

      <div className="office-sim-overlay office-sim-agent-layer">
        {agents.map((agent) => {
          const coordinates = getAgentCoordinates(agent);
          const badgeStyle = mapSimToOverlay(coordinates.x, coordinates.y);
          const palette = ROLE_PALETTES[agent.role];
          return (
            <button
              className={`office-agent-marker ${selectedAgentId === agent.id ? "selected" : ""}`}
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              style={badgeStyle}
              type="button"
            >
              <span className="office-agent-avatar" style={{ background: `linear-gradient(145deg, ${palette.badge}, #ffffff)` }}>
                {firstName(agent.name).slice(0, 1)}
              </span>
              <span className="office-agent-meta">
                <strong>{firstName(agent.name)}</strong>
                <span>
                  <i style={{ backgroundColor: mapStateColorCss(agent.state) }} />
                  {agent.state.toLowerCase()}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
