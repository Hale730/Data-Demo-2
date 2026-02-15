import React from "react";
import "./Tooltip.css";

export interface TooltipProps {
  x: number;
  y: number;
  country: string;
  region: string;
  score: number | null;
  gdp: number | null;
  life: number | null;
  freedom: number | null;
  visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  x, y, country, region, score, gdp, life, freedom, visible
}) => {
  return (
    <div
      className="happiness-tooltip"
      style={{
        left: x,
        top: y,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
        transition: "opacity 0.18s, transform 0.18s",
        transform: visible ? "translateY(0px) scale(1.04)" : "translateY(10px) scale(0.98)",
      }}
    >
      <div className="tt-country">{country}</div>
      <div className="tt-score">Happiness: {score?.toFixed(3) ?? "–"}</div>
      <div className="tt-region">{region}</div>
      <div className="tt-metrics">
        GDP: {gdp ?? "–"} | Life: {life ?? "–"} | Freedom: {freedom ?? "–"}
      </div>
    </div>
  );
};
