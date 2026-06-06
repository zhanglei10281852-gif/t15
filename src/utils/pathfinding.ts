import { ParkingSpot } from "../types";
import { PARKING_CONFIG } from "./parkingData";

interface PathNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

function heuristic(x1: number, z1: number, x2: number, z2: number): number {
  return Math.abs(x1 - x2) + Math.abs(z1 - z2);
}

export function getNearestAislePoint(
  spotX: number,
  spotZ: number,
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): { x: number; z: number } {
  let minDist = Infinity;
  let nearest = { x: spotX, z: spotZ };

  aislePaths.forEach((path) => {
    const { x1, z1, x2, z2 } = path;

    if (x1 === x2) {
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      const projZ = Math.max(minZ, Math.min(maxZ, spotZ));
      const dist = Math.abs(spotX - x1);
      if (dist < minDist) {
        minDist = dist;
        nearest = { x: x1, z: projZ };
      }
    } else {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const projX = Math.max(minX, Math.min(maxX, spotX));
      const dist = Math.abs(spotZ - z1);
      if (dist < minDist) {
        minDist = dist;
        nearest = { x: projX, z: z1 };
      }
    }
  });

  return nearest;
}

function getAisleIntersections(
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): Array<{ x: number; z: number }> {
  const intersections: Array<{ x: number; z: number }> = [];
  const horizontalPaths = aislePaths.filter((p) => p.z1 === p.z2);
  const verticalPaths = aislePaths.filter((p) => p.x1 === p.x2);

  horizontalPaths.forEach((hPath) => {
    verticalPaths.forEach((vPath) => {
      const x = vPath.x1;
      const z = hPath.z1;

      const hMinX = Math.min(hPath.x1, hPath.x2);
      const hMaxX = Math.max(hPath.x1, hPath.x2);
      const vMinZ = Math.min(vPath.z1, vPath.z2);
      const vMaxZ = Math.max(vPath.z1, vPath.z2);

      if (x >= hMinX && x <= hMaxX && z >= vMinZ && z <= vMaxZ) {
        intersections.push({ x, z });
      }
    });
  });

  return intersections;
}

function getAllPathNodes(
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): Array<{ x: number; z: number }> {
  const nodes: Array<{ x: number; z: number }> = [];

  aislePaths.forEach((path) => {
    nodes.push({ x: path.x1, z: path.z1 });
    nodes.push({ x: path.x2, z: path.z2 });
  });

  const intersections = getAisleIntersections(aislePaths);
  intersections.forEach((inter) => {
    const exists = nodes.some(
      (n) => Math.abs(n.x - inter.x) < 0.1 && Math.abs(n.z - inter.z) < 0.1,
    );
    if (!exists) {
      nodes.push(inter);
    }
  });

  return nodes;
}

function isPointOnPath(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): boolean {
  const tolerance = 0.5;

  if (x1 === x2) {
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    return (
      Math.abs(px - x1) < tolerance &&
      pz >= minZ - tolerance &&
      pz <= maxZ + tolerance
    );
  } else {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return (
      Math.abs(pz - z1) < tolerance &&
      px >= minX - tolerance &&
      px <= maxX + tolerance
    );
  }
}

function getNeighbors(
  node: { x: number; z: number },
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
  allNodes: Array<{ x: number; z: number }>,
): Array<{ x: number; z: number; cost: number }> {
  const neighbors: Array<{ x: number; z: number; cost: number }> = [];

  aislePaths.forEach((path) => {
    const { x1, z1, x2, z2 } = path;

    const onPath = isPointOnPath(node.x, node.z, x1, z1, x2, z2);

    if (onPath) {
      allNodes.forEach((otherNode) => {
        if (otherNode.x === node.x && otherNode.z === node.z) return;

        if (isPointOnPath(otherNode.x, otherNode.z, x1, z1, x2, z2)) {
          const dist = Math.sqrt(
            Math.pow(otherNode.x - node.x, 2) +
              Math.pow(otherNode.z - node.z, 2),
          );

          const exists = neighbors.some(
            (n) =>
              Math.abs(n.x - otherNode.x) < 0.1 &&
              Math.abs(n.z - otherNode.z) < 0.1,
          );

          if (!exists && dist > 0.1) {
            neighbors.push({ x: otherNode.x, z: otherNode.z, cost: dist });
          }
        }
      });
    }
  });

  return neighbors;
}

function simplifyPath(
  path: Array<{ x: number; z: number }>,
): Array<{ x: number; z: number }> {
  if (path.length <= 2) return path;

  const result: Array<{ x: number; z: number }> = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.x - prev.x;
    const dz1 = curr.z - prev.z;
    const dx2 = next.x - curr.x;
    const dz2 = next.z - curr.z;

    const cross = dx1 * dz2 - dz1 * dx2;

    if (Math.abs(cross) > 0.01) {
      result.push(curr);
    }
  }

  result.push(path[path.length - 1]);

  return result;
}

export function findPathAlongAisles(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): Array<{ x: number; z: number }> {
  const startAisle = getNearestAislePoint(startX, startZ, aislePaths);
  const endAisle = getNearestAislePoint(endX, endZ, aislePaths);

  const allNodes = getAllPathNodes(aislePaths);
  allNodes.push(startAisle);
  allNodes.push(endAisle);

  const openList: PathNode[] = [];
  const closedSet = new Set<string>();

  const start: PathNode = {
    x: startAisle.x,
    z: startAisle.z,
    g: 0,
    h: heuristic(startAisle.x, startAisle.z, endAisle.x, endAisle.z),
    f: heuristic(startAisle.x, startAisle.z, endAisle.x, endAisle.z),
    parent: null,
  };

  openList.push(start);

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;

    const key = `${current.x.toFixed(2)},${current.z.toFixed(2)}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    if (
      Math.abs(current.x - endAisle.x) < 1 &&
      Math.abs(current.z - endAisle.z) < 1
    ) {
      const path: Array<{ x: number; z: number }> = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, z: node.z });
        node = node.parent;
      }

      if (
        Math.abs(startX - startAisle.x) > 0.1 ||
        Math.abs(startZ - startAisle.z) > 0.1
      ) {
        path.unshift({ x: startX, z: startZ });
      }

      if (
        Math.abs(endX - endAisle.x) > 0.1 ||
        Math.abs(endZ - endAisle.z) > 0.1
      ) {
        path.push({ x: endX, z: endZ });
      }

      return simplifyPath(path);
    }

    const neighbors = getNeighbors(
      { x: current.x, z: current.z },
      aislePaths,
      allNodes,
    );

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x.toFixed(2)},${neighbor.z.toFixed(2)}`;
      if (closedSet.has(neighborKey)) continue;

      const g = current.g + neighbor.cost;
      const h = heuristic(neighbor.x, neighbor.z, endAisle.x, endAisle.z);
      const f = g + h;

      const existingIndex = openList.findIndex(
        (n) =>
          Math.abs(n.x - neighbor.x) < 0.1 && Math.abs(n.z - neighbor.z) < 0.1,
      );

      if (existingIndex === -1 || g < openList[existingIndex].g) {
        const newNode: PathNode = {
          x: neighbor.x,
          z: neighbor.z,
          g,
          h,
          f,
          parent: current,
        };

        if (existingIndex !== -1) {
          openList[existingIndex] = newNode;
        } else {
          openList.push(newNode);
        }
      }
    }
  }

  return [
    { x: startX, z: startZ },
    { x: endX, z: endZ },
  ];
}

export function findPathToSpot(
  startX: number,
  startZ: number,
  targetSpot: ParkingSpot,
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): Array<{ x: number; z: number }> {
  return findPathAlongAisles(
    startX,
    startZ,
    targetSpot.x,
    targetSpot.z,
    aislePaths,
  );
}

export function findNearestAvailableSpot(
  spots: ParkingSpot[],
  entryX: number,
  entryZ: number,
  aislePaths: Array<{ x1: number; z1: number; x2: number; z2: number }>,
): ParkingSpot | null {
  const availableSpots = spots.filter((s) => s.status === "available");

  if (availableSpots.length === 0) return null;

  let nearestSpot: ParkingSpot | null = null;
  let minDistance = Infinity;

  availableSpots.forEach((spot) => {
    const path = findPathToSpot(entryX, entryZ, spot, aislePaths);
    let dist = 0;
    for (let i = 0; i < path.length - 1; i++) {
      dist += Math.sqrt(
        Math.pow(path[i + 1].x - path[i].x, 2) +
          Math.pow(path[i + 1].z - path[i].z, 2),
      );
    }

    if (dist < minDistance) {
      minDistance = dist;
      nearestSpot = spot;
    }
  });

  return nearestSpot;
}
