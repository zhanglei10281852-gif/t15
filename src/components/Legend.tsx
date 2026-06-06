import React from "react";

const Legend: React.FC = () => {
  return (
    <div className="legend">
      <div className="legend-title">图例说明</div>
      <div className="legend-item">
        <div className="legend-color legend-available"></div>
        <span>空闲车位</span>
      </div>
      <div className="legend-item">
        <div className="legend-color legend-occupied"></div>
        <span>已占用</span>
      </div>
      <div className="legend-item">
        <div className="legend-color legend-maintenance"></div>
        <span>维护中</span>
      </div>
      <div className="legend-item">
        <div className="legend-color legend-vip"></div>
        <span>VIP专用</span>
      </div>
    </div>
  );
};

export default Legend;
