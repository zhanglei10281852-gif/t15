export type ParkingStatus = 'available' | 'occupied' | 'maintenance' | 'vip';

export interface ParkingSpot {
  id: string;
  row: number;
  col: number;
  x: number;
  z: number;
  status: ParkingStatus;
  plateNumber?: string;
  entryTime?: number;
  vehicle?: THREE.Group;
}

export interface ParkingStats {
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
  vip: number;
  occupancyRate: number;
  todayEntries: number;
  todayRevenue: number;
}

export type FilterMode = 'all' | 'available' | 'longTime';
export type ViewMode = 'perspective' | 'top';
