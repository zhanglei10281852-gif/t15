import React from "react";
import { ParkingStats } from "../types";

interface StatsPanelProps {
  stats: ParkingStats;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const ringCircumference = 2 * Math.PI * 25;
  const offset = ringCircumference * (1 - stats.occupancyRate / 100);

  return (
    <div className="stats-panel">
      <div className="stat-item stat-total">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">总车位</div>
      </div>

      <div className="stat-item stat-occupied">
        <div className="stat-value">{stats.occupied}</div>
        <div className="stat-label">已占用</div>
      </div>

      <div className="stat-item stat-available">
        <div className="stat-value">{stats.available}</div>
        <div className="stat-label">空闲</div>
      </div>

      <div className="stat-item stat-maintenance">
        <div className="stat-value">{stats.maintenance}</div>
        <div className="stat-label">维护中</div>
      </div>

      <div className="stat-item">
        <div className="stat-ring">
          <svg viewBox="0 0 60 60">
            <circle className="ring-bg" cx="30" cy="30" r="25" />
            <circle
              className="ring-progress"
              cx="30"
              cy="30"
              r="25"
              strokeDasharray={ringCircumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="stat-ring-text">
            {stats.occupancyRate.toFixed(0)}%
          </div>
        </div>
        <div className="stat-label">占用率</div>
      </div>

      <div className="stat-item">
        <div className="stat-value">{stats.todayEntries}</div>
        <div className="stat-label">今日进场</div>
      </div>

      <div className="stat-item">
        <div className="stat-value">¥{stats.todayRevenue.toFixed(0)}</div>
        <div className="stat-label">今日收入</div>
      </div>
    </div>
  );
};

export default StatsPanel;
