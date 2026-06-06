import React, { useEffect, useRef, useState, useCallback } from "react";
import { ParkingScene } from "./components/ParkingScene";
import StatsPanel from "./components/StatsPanel";
import DetailPanel from "./components/DetailPanel";
import ControlPanel from "./components/ControlPanel";
import Tooltip from "./components/Tooltip";
import Legend from "./components/Legend";
import { ParkingSpot, ParkingStats, FilterMode, ViewMode } from "./types";
import {
  generateParkingSpots,
  initializeRandomStatus,
  calculateStats,
} from "./utils/parkingData";

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ParkingScene | null>(null);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [stats, setStats] = useState<ParkingStats>({
    total: 90,
    occupied: 0,
    available: 90,
    maintenance: 0,
    vip: 0,
    occupancyRate: 0,
    todayEntries: 0,
    todayRevenue: 0,
  });
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [hoveredSpot, setHoveredSpot] = useState<ParkingSpot | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("perspective");
  const [isExiting, setIsExiting] = useState(false);

  const generatePlateNumber = () => {
    const provinces = ["京", "沪", "粤", "浙", "苏", "川"];
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const cityLetter = letters[Math.floor(Math.random() * letters.length)];
    let digits = "";
    for (let j = 0; j < 5; j++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    return `${province}${cityLetter}${digits}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ParkingScene(containerRef.current);
    sceneRef.current = scene;

    const initialSpots = generateParkingSpots();
    const initializedSpots = initializeRandomStatus(initialSpots);

    scene.createParkingSpots(initializedSpots);
    setSpots(initializedSpots);
    setStats(calculateStats(initializedSpots));

    scene.setOnSpotHover((spot, x, y) => {
      setHoveredSpot(spot);
      setTooltipPos({ x, y });
    });

    scene.setOnSpotClick((spot) => {
      setSelectedSpot(spot);
      setIsDetailOpen(true);
    });

    return () => {
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    const statsInterval = setInterval(() => {
      if (sceneRef.current) {
        const currentSpots = sceneRef.current.getSpots();
        setStats(calculateStats(currentSpots));
        setSpots([...currentSpots]);
      }
    }, 1000);

    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    const simulateInterval = setInterval(() => {
      if (sceneRef.current) {
        simulateVehicleChanges();
      }
    }, 3000);

    return () => clearInterval(simulateInterval);
  }, []);

  const MIN_PARKING_DURATION = 30 * 1000;

  const simulateVehicleChanges = useCallback(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const currentSpots = scene.getSpots();
    const now = Date.now();

    const numChanges = Math.floor(Math.random() * 2) + 1;

    for (let i = 0; i < numChanges; i++) {
      const type = Math.random();

      if (type < 0.5) {
        const availableSpots = currentSpots.filter(
          (s) => s.status === "available" && !scene.isAnimating(s.id),
        );

        if (availableSpots.length > 0) {
          const randomSpot =
            availableSpots[Math.floor(Math.random() * availableSpots.length)];

          const plateNumber = generatePlateNumber();
          const entryTime = now;

          randomSpot.status = "occupied";
          randomSpot.plateNumber = plateNumber;
          randomSpot.entryTime = entryTime;

          scene.animateVehicleEntry(randomSpot.id);
        }
      } else {
        const occupiedSpots = currentSpots.filter((s) => {
          if (s.status !== "occupied" && s.status !== "vip") return false;
          if (scene.isAnimating(s.id)) return false;
          if (!s.entryTime) return false;
          const parkingDuration = now - s.entryTime;
          return parkingDuration >= MIN_PARKING_DURATION;
        });

        if (occupiedSpots.length > 0) {
          const randomSpot =
            occupiedSpots[Math.floor(Math.random() * occupiedSpots.length)];

          scene.animateVehicleExit(randomSpot.id);
        }
      }
    }
  }, []);

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    if (sceneRef.current) {
      sceneRef.current.setFilterMode(mode);
    }
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (sceneRef.current) {
      sceneRef.current.setViewMode(mode);
    }
  };

  const handleFindSpot = () => {
    if (sceneRef.current) {
      const spot = sceneRef.current.findAndNavigateToNearestSpot();
      if (spot) {
        setSelectedSpot(spot);
        setIsDetailOpen(true);
      }
    }
  };

  const handleExit = (spotId: string) => {
    if (!sceneRef.current || isExiting) return;

    setIsExiting(true);

    sceneRef.current.animateVehicleExit(spotId, () => {
      setIsExiting(false);
      setIsDetailOpen(false);
      setSelectedSpot(null);
    });
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
  };

  const selectedSpotData = selectedSpot
    ? spots.find((s) => s.id === selectedSpot.id) || selectedSpot
    : null;

  const isAnimating = selectedSpot
    ? sceneRef.current?.isAnimating(selectedSpot.id) || false
    : false;

  return (
    <div className="app-container">
      <div ref={containerRef} className="canvas-container" />

      <StatsPanel stats={stats} />

      <ControlPanel
        filterMode={filterMode}
        viewMode={viewMode}
        onFilterChange={handleFilterChange}
        onViewChange={handleViewChange}
        onFindSpot={handleFindSpot}
      />

      <DetailPanel
        spot={selectedSpotData}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onExit={handleExit}
        isAnimating={isExiting || isAnimating}
      />

      <Tooltip spot={hoveredSpot} x={tooltipPos.x} y={tooltipPos.y} />

      <Legend />
    </div>
  );
};

export default App;
