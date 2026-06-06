import React from "react";
import { FilterMode, ViewMode } from "../types";

interface ControlPanelProps {
  filterMode: FilterMode;
  viewMode: ViewMode;
  onFilterChange: (mode: FilterMode) => void;
  onViewChange: (mode: ViewMode) => void;
  onFindSpot: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  filterMode,
  viewMode,
  onFilterChange,
  onViewChange,
  onFindSpot,
}) => {
  return (
    <div className="control-panel">
      <button className="control-btn primary" onClick={onFindSpot}>
        🚗 寻找空位
      </button>

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "8px",
          }}
        >
          显示模式
        </div>
        <div className="filter-group">
          <button
            className={`filter-btn ${filterMode === "all" ? "active" : ""}`}
            onClick={() => onFilterChange("all")}
          >
            全部显示
          </button>
          <button
            className={`filter-btn ${filterMode === "available" ? "active" : ""}`}
            onClick={() => onFilterChange("available")}
          >
            只显示空位
          </button>
          <button
            className={`filter-btn ${filterMode === "longTime" ? "active" : ""}`}
            onClick={() => onFilterChange("longTime")}
          >
            长时停车
          </button>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "8px",
          }}
        >
          视角模式
        </div>
        <div className="filter-group">
          <button
            className={`filter-btn ${viewMode === "perspective" ? "active" : ""}`}
            onClick={() => onViewChange("perspective")}
          >
            透视3D
          </button>
          <button
            className={`filter-btn ${viewMode === "top" ? "active" : ""}`}
            onClick={() => onViewChange("top")}
          >
            俯视平面
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
