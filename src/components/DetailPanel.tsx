import React from "react";
import { ParkingSpot } from "../types";
import { formatDuration, formatTime, calculateFee } from "../utils/parkingData";

interface DetailPanelProps {
  spot: ParkingSpot | null;
  isOpen: boolean;
  onClose: () => void;
  onExit: (spotId: string) => void;
  isAnimating: boolean;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  spot,
  isOpen,
  onClose,
  onExit,
  isAnimating,
}) => {
  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "空闲";
      case "occupied":
        return "已占用";
      case "maintenance":
        return "维护中";
      case "vip":
        return "VIP专用";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "available":
        return "status-available";
      case "occupied":
        return "status-occupied";
      case "maintenance":
        return "status-maintenance";
      case "vip":
        return "status-vip";
      default:
        return "";
    }
  };

  const now = Date.now();
  const duration = spot?.entryTime ? now - spot.entryTime : 0;
  const fee = spot?.entryTime ? calculateFee(spot.entryTime) : 0;

  return (
    <div className={`detail-panel ${isOpen ? "open" : ""}`}>
      <div className="detail-header">
        <div className="detail-title">{spot?.id || "车位详情"}</div>
        <button className="detail-close" onClick={onClose}>
          ×
        </button>
      </div>

      {spot && (
        <>
          <div className="detail-row">
            <span className="detail-label">状态</span>
            <span className={`status-badge ${getStatusClass(spot.status)}`}>
              {getStatusText(spot.status)}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">位置</span>
            <span className="detail-value">
              第{spot.row + 1}排 第{spot.col + 1}位
            </span>
          </div>

          {(spot.status === "occupied" || spot.status === "vip") &&
            spot.plateNumber && (
              <>
                <div className="detail-row">
                  <span className="detail-label">车牌号</span>
                  <span className="detail-value">{spot.plateNumber}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">入场时间</span>
                  <span className="detail-value">
                    {formatTime(spot.entryTime!)}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">停车时长</span>
                  <span className="detail-value">
                    {formatDuration(duration)}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">费用预估</span>
                  <span className="detail-value">¥{fee.toFixed(2)}</span>
                </div>
              </>
            )}

          <div className="detail-action">
            {(spot.status === "occupied" || spot.status === "vip") && (
              <button
                className="action-btn"
                onClick={() => onExit(spot.id)}
                disabled={isAnimating}
              >
                {isAnimating ? "离场中..." : "车辆离场"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DetailPanel;
