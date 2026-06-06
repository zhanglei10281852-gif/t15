import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import TWEEN from "@tweenjs/tween.js";
import { ParkingSpot, FilterMode, ViewMode } from "../types";
import {
  PARKING_CONFIG,
  getParkingLayout,
  getEntryPosition,
  getExitPosition,
  getAislePaths,
} from "../utils/parkingData";
import {
  findPathToSpot,
  findPathAlongAisles,
  findNearestAvailableSpot,
} from "../utils/pathfinding";

const VEHICLE_COLORS = [0xff3333, 0xffffff, 0x222222, 0x3366ff, 0xc0c0c0];

export class ParkingScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private spotMeshes: Map<string, THREE.Mesh> = new Map();
  private spotLabels: Map<string, THREE.Sprite> = new Map();
  private vehicleMeshes: Map<string, THREE.Group> = new Map();
  private highlightMeshes: Map<string, THREE.LineSegments> = new Map();
  private maintenanceMarks: Map<string, THREE.Group> = new Map();
  private navPath: THREE.Line | null = null;
  private animatingVehicles: Set<string> = new Set();

  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private hoveredSpotId: string | null = null;

  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private viewMode: ViewMode = "perspective";

  private aislePaths: any[] = [];
  private entryPos: { x: number; z: number };
  private exitPos: { x: number; z: number };

  private onSpotHover:
    | ((spot: ParkingSpot | null, x: number, y: number) => void)
    | null = null;
  private onSpotClick: ((spot: ParkingSpot) => void) | null = null;

  private spots: ParkingSpot[] = [];
  private filterMode: FilterMode = "all";
  private animationId: number = 0;
  private clock: THREE.Clock;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);

    const { width, depth } = getParkingLayout();
    this.aislePaths = getAislePaths();
    this.entryPos = getEntryPosition();
    this.exitPos = getExitPosition();

    this.perspectiveCamera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.perspectiveCamera.position.set(0, 40, 35);
    this.perspectiveCamera.lookAt(0, 0, 10);

    const aspect = container.clientWidth / container.clientHeight;
    const viewSize = 50;
    this.orthographicCamera = new THREE.OrthographicCamera(
      -viewSize * aspect,
      viewSize * aspect,
      viewSize,
      -viewSize,
      0.1,
      1000,
    );
    this.orthographicCamera.position.set(0, 60, 0.1);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.camera = this.perspectiveCamera;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 0, 10);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLights();
    this.createGround();
    this.createPillars();
    this.createEntranceExit();

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("click", this.onClick);

    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(20, 40, 20);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.camera.left = -50;
    mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50;
    mainLight.shadow.camera.bottom = -50;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-20, 30, -20);
    this.scene.add(fillLight);

    const ceilingLights = this.createCeilingLights();
    this.scene.add(ceilingLights);
  }

  private createCeilingLights(): THREE.Group {
    const group = new THREE.Group();
    const { cols } = PARKING_CONFIG;
    const halfWidth = (cols * 3) / 2;

    for (let i = 0; i < 5; i++) {
      const light = new THREE.PointLight(0xffffff, 0.3, 30);
      light.position.set(-halfWidth + (i * cols * 3) / 4, 10, 8);
      group.add(light);
    }

    return group;
  }

  private createGround(): void {
    const { width, depth } = getParkingLayout();

    const groundGeometry = new THREE.PlaneGeometry(width + 20, depth + 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a4a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private createPillars(): void {
    const { rows, cols, spotWidth, spotDepth, aisleWidth, pillarInterval } =
      PARKING_CONFIG;
    const groupDepth = 2 * spotDepth + aisleWidth;
    const groups = rows / 2;
    const halfWidth = (cols * spotWidth) / 2;

    const pillarGeometry = new THREE.CylinderGeometry(0.4, 0.4, 8, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5a6a,
      roughness: 0.6,
      metalness: 0.3,
    });

    for (let group = 0; group < groups + 1; group++) {
      const z = group * groupDepth - spotDepth / 2 - aisleWidth / 2;

      for (let col = 0; col <= cols; col += pillarInterval) {
        const x = -halfWidth + col * spotWidth;

        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(x, 4, z);
        pillar.castShadow = true;
        this.scene.add(pillar);
      }
    }
  }

  private createEntranceExit(): void {
    const entryPos = getEntryPosition();
    const exitPos = getExitPosition();

    const rampGeometry = new THREE.PlaneGeometry(10, 8);
    const entryMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const entryRamp = new THREE.Mesh(rampGeometry, entryMaterial);
    entryRamp.rotation.x = -Math.PI / 2;
    entryRamp.position.set(entryPos.x, 0.01, entryPos.z);
    this.scene.add(entryRamp);

    const exitMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const exitRamp = new THREE.Mesh(rampGeometry, exitMaterial);
    exitRamp.rotation.x = -Math.PI / 2;
    exitRamp.position.set(exitPos.x, 0.01, exitPos.z);
    this.scene.add(exitRamp);

    const entryArrow = this.createArrow(0x00ff00);
    entryArrow.position.set(entryPos.x + 2, 0.1, entryPos.z);
    entryArrow.rotation.y = Math.PI / 2;
    this.scene.add(entryArrow);

    const exitArrow = this.createArrow(0xff0000);
    exitArrow.position.set(exitPos.x - 2, 0.1, exitPos.z);
    exitArrow.rotation.y = -Math.PI / 2;
    this.scene.add(exitArrow);

    const entryLabel = this.createTextSprite("入口", 0x00ff00);
    entryLabel.position.set(entryPos.x, 2, entryPos.z + 4);
    this.scene.add(entryLabel);

    const exitLabel = this.createTextSprite("出口", 0xff0000);
    exitLabel.position.set(exitPos.x, 2, exitPos.z + 4);
    this.scene.add(exitLabel);
  }

  private createArrow(color: number): THREE.Group {
    const group = new THREE.Group();

    const shaftGeometry = new THREE.BoxGeometry(0.3, 0.1, 2);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    const shaft = new THREE.Mesh(shaftGeometry, material);
    shaft.position.z = -1;
    group.add(shaft);

    const headGeometry = new THREE.ConeGeometry(0.5, 1, 4);
    const head = new THREE.Mesh(headGeometry, material);
    head.rotation.x = Math.PI / 2;
    head.position.z = -2;
    group.add(head);

    return group;
  }

  private createTextSprite(
    text: string,
    color: number,
    fontSize: number = 32,
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 128;

    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 2, 1);

    return sprite;
  }

  public createParkingSpots(spots: ParkingSpot[]): void {
    this.spots = spots;

    const { spotWidth, spotDepth } = PARKING_CONFIG;

    spots.forEach((spot) => {
      const spotGeometry = new THREE.PlaneGeometry(
        spotWidth - 0.2,
        spotDepth - 0.2,
      );
      const spotMaterial = new THREE.MeshStandardMaterial({
        color: this.getSpotColor(spot.status),
        transparent: true,
        opacity: this.getSpotOpacity(spot.status),
      });
      const spotMesh = new THREE.Mesh(spotGeometry, spotMaterial);
      spotMesh.rotation.x = -Math.PI / 2;
      spotMesh.position.set(spot.x, 0.02, spot.z);
      spotMesh.userData = { spotId: spot.id, type: "parkingSpot" };
      this.scene.add(spotMesh);
      this.spotMeshes.set(spot.id, spotMesh);

      const lineGeometry = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(spotWidth - 0.2, 0.01, spotDepth - 0.2),
      );
      const lineColor = this.getSpotBorderColor(spot.status);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: lineColor,
        linewidth: 2,
      });
      const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      lineSegments.position.set(spot.x, 0.03, spot.z);
      this.scene.add(lineSegments);
      this.highlightMeshes.set(spot.id, lineSegments);

      const label = this.createTextSprite(spot.id, 0xffffff, 24);
      label.position.set(spot.x, 0.5, spot.z + spotDepth / 2 - 0.5);
      label.scale.set(2, 1, 1);
      this.scene.add(label);
      this.spotLabels.set(spot.id, label);

      if (spot.status === "maintenance") {
        const xMark = this.createXMark();
        xMark.position.set(spot.x, 0.05, spot.z);
        xMark.rotation.x = -Math.PI / 2;
        this.scene.add(xMark);
        this.maintenanceMarks.set(spot.id, xMark);
      }

      if (spot.status === "occupied" || spot.status === "vip") {
        const vehicle = this.createVehicle();
        vehicle.position.set(spot.x, 0.5, spot.z);
        this.scene.add(vehicle);
        this.vehicleMeshes.set(spot.id, vehicle);
      }
    });
  }

  private getSpotColor(status: string): number {
    switch (status) {
      case "available":
        return 0x51cf66;
      case "occupied":
        return 0x3a3a4a;
      case "maintenance":
        return 0xffd43b;
      case "vip":
        return 0x3a3a4a;
      default:
        return 0x3a3a4a;
    }
  }

  private getSpotOpacity(status: string): number {
    switch (status) {
      case "available":
        return 0.3;
      case "maintenance":
        return 0.3;
      default:
        return 0.0;
    }
  }

  private getSpotBorderColor(status: string): number {
    switch (status) {
      case "available":
        return 0x51cf66;
      case "occupied":
        return 0x666666;
      case "maintenance":
        return 0xffd43b;
      case "vip":
        return 0xffd700;
      default:
        return 0x666666;
    }
  }

  private createXMark(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({
      color: 0xffd43b,
      linewidth: 3,
    });

    const size = 1.5;
    const points1 = [
      new THREE.Vector3(-size / 2, -size / 2, 0),
      new THREE.Vector3(size / 2, size / 2, 0),
    ];
    const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
    const line1 = new THREE.Line(geometry1, material);
    group.add(line1);

    const points2 = [
      new THREE.Vector3(size / 2, -size / 2, 0),
      new THREE.Vector3(-size / 2, size / 2, 0),
    ];
    const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
    const line2 = new THREE.Line(geometry2, material);
    group.add(line2);

    return group;
  }

  private createVehicle(): THREE.Group {
    const group = new THREE.Group();

    const colorIndex = Math.floor(Math.random() * VEHICLE_COLORS.length);
    const color = VEHICLE_COLORS[colorIndex];

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.6,
      roughness: 0.3,
    });

    const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    const topGeometry = new THREE.BoxGeometry(1.6, 0.5, 2);
    const top = new THREE.Mesh(topGeometry, bodyMaterial);
    top.position.set(0, 1.05, -0.3);
    top.castShadow = true;
    group.add(top);

    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
    });

    const wheelPositions = [
      { x: -0.9, z: -1.2 },
      { x: 0.9, z: -1.2 },
      { x: -0.9, z: 1.2 },
      { x: 0.9, z: 1.2 },
    ];

    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.3, pos.z);
      wheel.castShadow = true;
      group.add(wheel);
    });

    return group;
  }

  public updateSpotStatus(
    spotId: string,
    status: string,
    plateNumber?: string,
    entryTime?: number,
  ): void {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) return;

    spot.status = status as any;
    if (plateNumber) spot.plateNumber = plateNumber;
    if (entryTime) spot.entryTime = entryTime;

    const spotMesh = this.spotMeshes.get(spotId);
    if (spotMesh) {
      (spotMesh.material as THREE.MeshStandardMaterial).color.setHex(
        this.getSpotColor(status),
      );
      (spotMesh.material as THREE.MeshStandardMaterial).opacity =
        this.getSpotOpacity(status);
    }

    const highlightMesh = this.highlightMeshes.get(spotId);
    if (highlightMesh) {
      (highlightMesh.material as THREE.LineBasicMaterial).color.setHex(
        this.getSpotBorderColor(status),
      );
    }

    if (status === "occupied" || status === "vip") {
      if (!this.vehicleMeshes.has(spotId)) {
        const vehicle = this.createVehicle();
        vehicle.position.set(spot.x, 0.5, spot.z);
        this.scene.add(vehicle);
        this.vehicleMeshes.set(spotId, vehicle);
      }
    } else {
      const vehicle = this.vehicleMeshes.get(spotId);
      if (vehicle) {
        this.scene.remove(vehicle);
        this.vehicleMeshes.delete(spotId);
      }
    }

    if (status === "maintenance") {
      if (!this.maintenanceMarks.has(spotId)) {
        const xMark = this.createXMark();
        xMark.position.set(spot.x, 0.05, spot.z);
        xMark.rotation.x = -Math.PI / 2;
        this.scene.add(xMark);
        this.maintenanceMarks.set(spotId, xMark);
      }
    } else {
      const xMark = this.maintenanceMarks.get(spotId);
      if (xMark) {
        this.scene.remove(xMark);
        this.maintenanceMarks.delete(spotId);
      }
    }

    this.applyFilter(this.filterMode);
  }

  public setFilterMode(mode: FilterMode): void {
    this.filterMode = mode;
    this.applyFilter(mode);
  }

  private applyFilter(mode: FilterMode): void {
    const now = Date.now();
    const longTimeThreshold = 4 * 60 * 60 * 1000;

    this.spots.forEach((spot) => {
      const spotMesh = this.spotMeshes.get(spot.id);
      const vehicle = this.vehicleMeshes.get(spot.id);
      const highlight = this.highlightMeshes.get(spot.id);
      const label = this.spotLabels.get(spot.id);
      const xMark = this.maintenanceMarks.get(spot.id);

      let visible = true;
      let vehicleVisible = true;
      let borderColor = this.getSpotBorderColor(spot.status);

      switch (mode) {
        case "all":
          visible = true;
          vehicleVisible = spot.status === "occupied" || spot.status === "vip";
          break;
        case "available":
          visible = spot.status === "available";
          vehicleVisible = false;

          if (spot.status === "available" && spotMesh) {
            const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.5;
            (spotMesh.material as THREE.MeshStandardMaterial).opacity = pulse;
          }
          break;
        case "longTime":
          visible = true;
          vehicleVisible = spot.status === "occupied" || spot.status === "vip";

          if (spot.status === "occupied" && spot.entryTime) {
            const duration = now - spot.entryTime;
            if (duration > longTimeThreshold) {
              borderColor = 0xff0000;
            }
          }
          break;
      }

      if (spotMesh) spotMesh.visible = visible;
      if (highlight) {
        highlight.visible = visible;
        (highlight.material as THREE.LineBasicMaterial).color.setHex(
          borderColor,
        );
      }
      if (label) label.visible = visible;
      if (vehicle) vehicle.visible = vehicleVisible && visible;
      if (xMark) xMark.visible = visible;
    });
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;

    if (mode === "top") {
      this.camera = this.orthographicCamera;
    } else {
      this.camera = this.perspectiveCamera;
    }

    this.controls.object = this.camera;
    this.controls.update();
  }

  public showNavigationPath(
    spotId: string,
  ): Array<{ x: number; z: number }> | null {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) return null;

    this.clearNavigationPath();

    const path = findPathToSpot(
      this.entryPos.x,
      this.entryPos.z,
      spot,
      this.aislePaths,
    );

    if (path.length < 2) return null;

    const points = path.map((p) => new THREE.Vector3(p.x, 0.1, p.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color: 0x00ff00,
      linewidth: 3,
      dashSize: 1,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.8,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.scene.add(line);
    this.navPath = line;

    this.addArrowsAlongPath(path);

    return path;
  }

  private addArrowsAlongPath(path: Array<{ x: number; z: number }>): void {
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];

      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const numArrows = Math.floor(length / 4);

      for (let j = 1; j <= numArrows; j++) {
        const t = j / (numArrows + 1);
        const x = start.x + dx * t;
        const z = start.z + dz * t;

        const arrow = this.createArrow(0x00ff00);
        arrow.position.set(x, 0.2, z);
        arrow.rotation.y = Math.atan2(dx, dz);
        arrow.scale.set(0.5, 0.5, 0.5);
        (arrow as any).isPathArrow = true;
        this.scene.add(arrow);
      }
    }
  }

  public clearNavigationPath(): void {
    if (this.navPath) {
      this.scene.remove(this.navPath);
      this.navPath = null;
    }

    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if ((obj as any).isPathArrow) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => this.scene.remove(obj));
  }

  public findAndNavigateToNearestSpot(): ParkingSpot | null {
    const nearestSpot = findNearestAvailableSpot(
      this.spots,
      this.entryPos.x,
      this.entryPos.z,
      this.aislePaths,
    );

    if (nearestSpot) {
      this.showNavigationPath(nearestSpot.id);
    }

    return nearestSpot;
  }

  public animateVehicleEntry(spotId: string, onComplete?: () => void): void {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot || this.animatingVehicles.has(spotId)) return;

    this.animatingVehicles.add(spotId);

    const path = findPathToSpot(
      this.entryPos.x,
      this.entryPos.z,
      spot,
      this.aislePaths,
    );

    const vehicle = this.createVehicle();
    vehicle.position.set(path[0].x, 0.5, path[0].z);
    this.scene.add(vehicle);

    const totalDistance = this.calculatePathLength(path);
    const speed = 8;
    const duration = (totalDistance / speed) * 1000;

    let currentDistance = 0;
    const startTime = Date.now();

    const animateStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const targetDistance = progress * totalDistance;

      let accDistance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const segStart = path[i];
        const segEnd = path[i + 1];
        const segLength = Math.sqrt(
          Math.pow(segEnd.x - segStart.x, 2) +
            Math.pow(segEnd.z - segStart.z, 2),
        );

        if (accDistance + segLength >= targetDistance) {
          const t = (targetDistance - accDistance) / segLength;
          const x = segStart.x + (segEnd.x - segStart.x) * t;
          const z = segStart.z + (segEnd.z - segStart.z) * t;

          vehicle.position.x = x;
          vehicle.position.z = z;

          const angle = Math.atan2(
            segEnd.x - segStart.x,
            segEnd.z - segStart.z,
          );
          vehicle.rotation.y = angle;

          break;
        }
        accDistance += segLength;
      }

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      } else {
        vehicle.position.set(spot.x, 0.5, spot.z);
        vehicle.rotation.y = 0;

        this.vehicleMeshes.set(spotId, vehicle);
        this.animatingVehicles.delete(spotId);

        this.updateSpotStatus(
          spotId,
          "occupied",
          spot.plateNumber,
          spot.entryTime,
        );

        if (onComplete) onComplete();
      }
    };

    animateStep();
  }

  public animateVehicleExit(spotId: string, onComplete?: () => void): void {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot || this.animatingVehicles.has(spotId)) return;

    const vehicle = this.vehicleMeshes.get(spotId);
    if (!vehicle) return;

    this.animatingVehicles.add(spotId);
    this.vehicleMeshes.delete(spotId);

    const path = findPathAlongAisles(
      spot.x,
      spot.z,
      this.exitPos.x,
      this.exitPos.z,
      this.aislePaths,
    );

    if (path.length < 2) {
      this.scene.remove(vehicle);
      this.animatingVehicles.delete(spotId);
      this.updateSpotStatus(spotId, "available");
      if (onComplete) onComplete();
      return;
    }

    const totalDistance = this.calculatePathLength(path);
    const speed = 8;
    const duration = (totalDistance / speed) * 1000;

    const startTime = Date.now();

    const animateStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const targetDistance = progress * totalDistance;

      let accDistance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const segStart = path[i];
        const segEnd = path[i + 1];
        const segLength = Math.sqrt(
          Math.pow(segEnd.x - segStart.x, 2) +
            Math.pow(segEnd.z - segStart.z, 2),
        );

        if (accDistance + segLength >= targetDistance) {
          const t = (targetDistance - accDistance) / segLength;
          const x = segStart.x + (segEnd.x - segStart.x) * t;
          const z = segStart.z + (segEnd.z - segStart.z) * t;

          vehicle.position.x = x;
          vehicle.position.z = z;

          const angle = Math.atan2(
            segEnd.x - segStart.x,
            segEnd.z - segStart.z,
          );
          vehicle.rotation.y = angle;

          break;
        }
        accDistance += segLength;
      }

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      } else {
        this.scene.remove(vehicle);
        this.animatingVehicles.delete(spotId);
        this.updateSpotStatus(spotId, "available");

        if (onComplete) onComplete();
      }
    };

    animateStep();
  }

  private calculatePathLength(path: Array<{ x: number; z: number }>): number {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
      length += Math.sqrt(
        Math.pow(path[i + 1].x - path[i].x, 2) +
          Math.pow(path[i + 1].z - path[i].z, 2),
      );
    }
    return length;
  }

  public setOnSpotHover(
    callback: (spot: ParkingSpot | null, x: number, y: number) => void,
  ): void {
    this.onSpotHover = callback;
  }

  public setOnSpotClick(callback: (spot: ParkingSpot) => void): void {
    this.onSpotClick = callback;
  }

  private onMouseMove = (event: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const spotMeshes = Array.from(this.spotMeshes.values());
    const intersects = this.raycaster.intersectObjects(spotMeshes);

    if (intersects.length > 0) {
      const spotId = intersects[0].object.userData.spotId;
      const spot = this.spots.find((s) => s.id === spotId);

      if (spot && spotId !== this.hoveredSpotId) {
        this.hoveredSpotId = spotId;

        const highlight = this.highlightMeshes.get(spotId);
        if (highlight) {
          (highlight.material as THREE.LineBasicMaterial).color.setHex(
            0xffffff,
          );
          highlight.scale.set(1.1, 1, 1.1);
        }

        if (this.onSpotHover) {
          this.onSpotHover(spot, event.clientX, event.clientY);
        }
      } else if (spot && this.onSpotHover) {
        this.onSpotHover(spot, event.clientX, event.clientY);
      }
    } else if (this.hoveredSpotId) {
      const highlight = this.highlightMeshes.get(this.hoveredSpotId);
      const spot = this.spots.find((s) => s.id === this.hoveredSpotId);
      if (highlight && spot) {
        (highlight.material as THREE.LineBasicMaterial).color.setHex(
          this.getSpotBorderColor(spot.status),
        );
        highlight.scale.set(1, 1, 1);
      }

      this.hoveredSpotId = null;
      if (this.onSpotHover) {
        this.onSpotHover(null, 0, 0);
      }
    }
  };

  private onClick = (event: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const spotMeshes = Array.from(this.spotMeshes.values());
    const intersects = this.raycaster.intersectObjects(spotMeshes);

    if (intersects.length > 0) {
      const spotId = intersects[0].object.userData.spotId;
      const spot = this.spots.find((s) => s.id === spotId);

      if (spot && this.onSpotClick) {
        this.onSpotClick(spot);
      }
    }
  };

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();

    const aspect = width / height;
    const viewSize = 50;
    this.orthographicCamera.left = -viewSize * aspect;
    this.orthographicCamera.right = viewSize * aspect;
    this.orthographicCamera.top = viewSize;
    this.orthographicCamera.bottom = -viewSize;
    this.orthographicCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    TWEEN.update();

    this.controls.update();

    if (this.filterMode === "available") {
      this.applyFilter("available");
    }

    if (this.navPath) {
      const material = this.navPath.material as any;
      if (material.dashOffset !== undefined) {
        material.dashOffset -= delta * 2;
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    cancelAnimationFrame(this.animationId);

    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.removeEventListener("click", this.onClick);

    this.controls.dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public getSpots(): ParkingSpot[] {
    return this.spots;
  }

  public isAnimating(spotId: string): boolean {
    return this.animatingVehicles.has(spotId);
  }
}
