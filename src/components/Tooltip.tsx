import React from 'react';
import { ParkingSpot } from '../types';
import { formatDuration } from '../utils/parkingData';

interface TooltipProps {
  spot: ParkingSpot | null;
  x: number;
  y: number;
}

const Tooltip: React.FC<TooltipProps> = ({ spot, x, y }) => {
  if (!spot) return null;

  const now = Date.now();
  const duration = spot.entryTime ? now - spot.entryTime : 0;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '空闲';
      case 'occupied': return '已占用';
      case 'maintenance': return '维护中';
      case 'vip': return 'VIP专用';
      default: return status;
    }
  };

  return (
    <div
      className="tooltip"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="tooltip-title">{spot.id}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">状态:</span>
        <span className="tooltip-value">{getStatusText(spot.status)}</span>
      </div>
      {spot.plateNumber && (
        <div className="tooltip-row">
          <span className="tooltip-label">车牌:</span>
          <span className="tooltip-value">{spot.plateNumber}</span>
        </div>
      )}
      {spot.entryTime && (
        <div className="tooltip-row">
          <span className="tooltip-label">时长:</span>
          <span className="tooltip-value">{formatDuration(duration)}</span>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
