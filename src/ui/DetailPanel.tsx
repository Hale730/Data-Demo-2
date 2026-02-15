import React from "react";
import "./DetailPanel.css";
import { CountryRow } from "../types";

export interface DetailPanelProps {
  country: CountryRow;
  onClose: () => void;
}

const METRICS: { key: keyof CountryRow; label: string }[] = [
  { key: "Ladder score", label: "Happiness" },
  { key: "Log GDP per capita", label: "GDP" },
  { key: "Social support", label: "Social support" },
  { key: "Healthy life expectancy", label: "Life expectancy" },
  { key: "Freedom to make life choices", label: "Freedom" },
  { key: "Generosity", label: "Generosity" },
  { key: "Perceptions of corruption", label: "Corruption" },
  { key: "Dystopia + residual", label: "Dystopia+residual" },
];

function norm(val: number | null, min: number, max: number) {
  if (val == null || isNaN(val)) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ country, onClose }) => {
  // For demo, use static min/max; in real app, pass from parent
  const minmax: Record<string, [number, number]> = {
    "Ladder score": [3.5, 8],
    "Log GDP per capita": [0.5, 2.2],
    "Social support": [0.5, 1.7],
    "Healthy life expectancy": [0.2, 0.8],
    "Freedom to make life choices": [0.2, 0.9],
    "Generosity": [0, 0.6],
    "Perceptions of corruption": [0, 1],
    "Dystopia + residual": [0.5, 3.5],
  };
  return (
    <div className="happiness-detail-panel">
      <h2>{country["Country name"]}</h2>
      <div className="region">{country["Regional indicator"]}</div>
      <div className="score">Happiness: {country["Ladder score"]?.toFixed(3) ?? "–"}</div>
      <div className="metrics">
        {METRICS.map(({ key, label }) => (
          <div key={key} className="metric-bar">
            <span className="metric-label">{label}</span>
            <span className="bar-bg">
              <span
                className="bar"
                style={{
                  width: `${Math.round(norm(country[key] as number | null, ...minmax[key]) * 100)}%`,
                }}
              />
            </span>
            <span className="metric-value">{country[key] ?? "–"}</span>
          </div>
        ))}
      </div>
      <button className="close-btn" onClick={onClose}>Close</button>
    </div>
  );
};
