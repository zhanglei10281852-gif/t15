import { ParkingSpot, ParkingStatus, ParkingStats } from "../types";

export const PARKING_CONFIG = {
  rows: 6,
  cols: 15,
  spotWidth: 3,
  spotDepth: 6,
  aisleWidth: 6,
  pillarInterval: 5,
  totalSpots: 90,
};

export function getParkingLayout(): { width: number; depth: number } {
  const { rows, cols, spotWidth, spotDepth, aisleWidth } = PARKING_CONFIG;
  const width = cols * spotWidth + (Math.floor(rows / 2) + 1) * aisleWidth;
  const depth = rows * spotDepth + (rows - 1) * aisleWidth;

  const actualDepth = 3 * (2 * spotDepth + aisleWidth);
  const actualWidth = cols * spotWidth;

  return { width: actualWidth, depth: actualDepth };
}

export function generateParkingSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  const { rows, cols, spotWidth, spotDepth, aisleWidth } = PARKING_CONFIG;

  const groupDepth = 2 * spotDepth + aisleWidth;
  const groups = rows / 2;

  for (let group = 0; group < groups; group++) {
    for (let rowInGroup = 0; rowInGroup < 2; rowInGroup++) {
      const row = group * 2 + rowInGroup;

      for (let col = 0; col < cols; col++) {
        const spotId = `B1-${String(row * cols + col + 1).padStart(3, "0")}`;

        const groupStartZ = group * groupDepth;
        let z: number;

        if (rowInGroup === 0) {
          z = groupStartZ + spotDepth / 2;
        } else {
          z = groupStartZ + spotDepth + aisleWidth + spotDepth / 2;
        }

        const x = col * spotWidth + spotWidth / 2 - (cols * spotWidth) / 2;

        spots.push({
          id: spotId,
          row,
          col,
          x,
          z,
          status: "available",
        });
      }
    }
  }

  return spots;
}

export function initializeRandomStatus(spots: ParkingSpot[]): ParkingSpot[] {
  const result = [...spots];

  const vipIndices = [7, 82];
  vipIndices.forEach((i) => {
    if (result[i]) {
      result[i] = { ...result[i], status: "vip" };
    }
  });

  const maintenanceIndices = [23, 45, 67];
  maintenanceIndices.forEach((i) => {
    if (result[i]) {
      result[i] = { ...result[i], status: "maintenance" };
    }
  });

  const availableIndices: number[] = [];
  result.forEach((spot, index) => {
    if (spot.status === "available") {
      availableIndices.push(index);
    }
  });

  const occupiedCount = 55;
  const shuffled = [...availableIndices].sort(() => Math.random() - 0.5);
  const occupiedIndices = shuffled.slice(0, occupiedCount);

  const plates = generatePlateNumbers(occupiedCount);

  const now = Date.now();

  occupiedIndices.forEach((spotIndex, i) => {
    const spot = result[spotIndex];
    const entryTime = now - Math.random() * 8 * 60 * 60 * 1000;

    result[spotIndex] = {
      ...spot,
      status: "occupied",
      plateNumber: plates[i],
      entryTime,
    };
  });

  return result;
}

function generatePlateNumbers(count: number): string[] {
  const provinces = [
    "京",
    "沪",
    "粤",
    "浙",
    "苏",
    "川",
    "鄂",
    "湘",
    "鲁",
    "豫",
  ];
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const plates: string[] = [];

  for (let i = 0; i < count; i++) {
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const cityLetter = letters[Math.floor(Math.random() * letters.length)];
    let digits = "";
    for (let j = 0; j < 5; j++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    plates.push(`${province}${cityLetter}${digits}`);
  }

  return plates;
}

export function calculateStats(spots: ParkingSpot[]): ParkingStats {
  let occupied = 0;
  let available = 0;
  let maintenance = 0;
  let vip = 0;

  const now = Date.now();
  let todayRevenue = 0;
  let todayEntries = 0;

  spots.forEach((spot) => {
    switch (spot.status) {
      case "occupied":
        occupied++;
        if (spot.entryTime) {
          const durationMs = now - spot.entryTime;
          const durationMinutes = durationMs / (1000 * 60);
          const periods = Math.ceil(durationMinutes / 15);
          todayRevenue += periods * 2;
          todayEntries++;
        }
        break;
      case "available":
        available++;
        break;
      case "maintenance":
        maintenance++;
        break;
      case "vip":
        vip++;
        break;
    }
  });

  const total = spots.length;
  const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

  return {
    total,
    occupied,
    available,
    maintenance,
    vip,
    occupancyRate,
    todayEntries,
    todayRevenue,
  };
}

export function getEntryPosition(): { x: number; z: number } {
  const { cols, spotWidth, spotDepth, aisleWidth } = PARKING_CONFIG;
  const groupDepth = 2 * spotDepth + aisleWidth;
  return {
    x: (-cols * spotWidth) / 2 - 4,
    z: groupDepth * 1.5 + 2,
  };
}

export function getExitPosition(): { x: number; z: number } {
  const { cols, spotWidth, spotDepth, aisleWidth } = PARKING_CONFIG;
  const groupDepth = 2 * spotDepth + aisleWidth;
  return {
    x: (cols * spotWidth) / 2 + 4,
    z: groupDepth * 1.5 + 2,
  };
}

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function calculateFee(entryTime: number): number {
  const now = Date.now();
  const durationMs = now - entryTime;
  const durationMinutes = durationMs / (1000 * 60);
  const periods = Math.ceil(durationMinutes / 15);
  return periods * 2;
}

export function getAislePaths(): Array<{
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}> {
  const { rows, cols, spotWidth, spotDepth, aisleWidth } = PARKING_CONFIG;
  const paths: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];

  const halfWidth = (cols * spotWidth) / 2;
  const groupDepth = 2 * spotDepth + aisleWidth;
  const groups = rows / 2;

  for (let group = 0; group < groups - 1; group++) {
    const z = (group + 1) * groupDepth - spotDepth - aisleWidth / 2;
    paths.push({
      x1: -halfWidth,
      z1: z,
      x2: halfWidth,
      z2: z,
    });
  }

  const bottomZ = -2;
  const topZ = groups * groupDepth - 2 * spotDepth - aisleWidth + 2;

  paths.push({
    x1: -halfWidth,
    z1: bottomZ,
    x2: halfWidth,
    z2: bottomZ,
  });

  paths.push({
    x1: -halfWidth,
    z1: topZ,
    x2: halfWidth,
    z2: topZ,
  });

  const leftX = -halfWidth - aisleWidth / 2 + 1;
  const rightX = halfWidth + aisleWidth / 2 - 1;

  paths.push({
    x1: leftX,
    z1: bottomZ,
    x2: leftX,
    z2: topZ,
  });

  paths.push({
    x1: rightX,
    z1: bottomZ,
    x2: rightX,
    z2: topZ,
  });

  return paths;
}
