import React, { useRef, useState } from "react";
import { CountryRow } from "./types";
import { useCanvasScene, LayoutMode } from "./useCanvasScene";
import { Tooltip } from "./ui/Tooltip";
import { DetailPanel } from "./ui/DetailPanel";
import "./HappinessCirclesView.css";

interface Props {
  countries: CountryRow[];
}

const LAYOUTS: { label: string; mode: LayoutMode }[] = [
  { label: "A→Z", mode: "alpha" },
  { label: "Rank", mode: "score" },
  // { label: "Region", mode: "region" }, // TODO: implement region cluster
];

export const HappinessCirclesView: React.FC<Props> = ({ countries }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("alpha");
  const [motion, setMotion] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useCanvasScene(canvasRef, countries, layoutMode, motion, hoverIdx, focusIdx, setHoverIdx, setFocusIdx);

  // Tooltip data
  let tooltip = null;
  if (hoverIdx !== null && countries[hoverIdx]) {
    const c = countries[hoverIdx];
    tooltip = (
      <Tooltip
        x={window.innerWidth / 2}
        y={window.innerHeight / 2}
        country={c["Country name"]}
        region={c["Regional indicator"]}
        score={c["Ladder score"]}
        gdp={c["Log GDP per capita"]}
        life={c["Healthy life expectancy"]}
        freedom={c["Freedom to make life choices"]}
        visible={true}
      />
    );
  }

  // Detail panel
  let detail = null;
  if (focusIdx !== null && countries[focusIdx]) {
    detail = (
      <DetailPanel
        country={countries[focusIdx]}
        onClose={() => setFocusIdx(null)}
      />
    );
  }

  return (
    <div className="happiness-circles-root">
      <div className="control-bar">
        {LAYOUTS.map(l => (
          <button key={l.mode} className={layoutMode === l.mode ? "active" : ""} onClick={() => setLayoutMode(l.mode)}>{l.label}</button>
        ))}
        <button onClick={() => setMotion(m => !m)}>{motion ? "Motion: On" : "Motion: Off"}</button>
      </div>
      <canvas ref={canvasRef} tabIndex={0} style={{ display: "block", width: "100vw", height: "100vh" }} />
      {tooltip}
      {detail}
    </div>
  );
};
