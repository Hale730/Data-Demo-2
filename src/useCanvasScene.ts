import { useRef, useEffect } from "react";
import { CountryRow } from "./types";
import { flagPalette, fallbackPalette } from "./palette";

export type LayoutMode = "alpha" | "score" | "region";

export interface CircleNode {
  idx: number;
  country: CountryRow;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  r: number;
  baseR: number;
  colorStops: string[];
  opacity: number;
  border: number;
  glow: number;
  anchorX: number;
  anchorY: number;
  region: string;
  hover: boolean;
  selected: boolean;
  driftSeed: number;
}

export function useCanvasScene(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  countries: CountryRow[],
  layoutMode: LayoutMode,
  motion: boolean,
  hoverIdx: number | null,
  focusIdx: number | null,
  setHoverIdx: (i: number | null) => void,
  setFocusIdx: (i: number | null) => void
) {
  const nodesRef = useRef<CircleNode[]>([]);
  const gridRef = useRef<{ cols: number; rows: number; cellW: number; cellH: number }>({ cols: 1, rows: 1, cellW: 1, cellH: 1 });

  // Layout and node setup
  useEffect(() => {
    // Sort and layout
    let sorted = [...countries];
    if (layoutMode === "alpha") sorted.sort((a, b) => a["Country name"].localeCompare(b["Country name"]));
    if (layoutMode === "score") sorted.sort((a, b) => (b["Ladder score"] ?? 0) - (a["Ladder score"] ?? 0));
    // TODO: region cluster layout
    const N = sorted.length;
    const width = window.innerWidth, height = window.innerHeight;
    let cols = Math.ceil(Math.sqrt(N * width / height));
    let rows = Math.ceil(N / cols);
    let cellW = width / cols, cellH = height / rows;
    gridRef.current = { cols, rows, cellW, cellH };
    // Min/max for metrics
    const minmax: Record<string, [number, number]> = {
      "Ladder score": [3.5, 8],
      "Perceptions of corruption": [0, 1],
      "Social support": [0.5, 1.7],
      "Healthy life expectancy": [0.2, 0.8],
    };
    // Build nodes
    nodesRef.current = sorted.map((country, i) => {
      const ladder = country["Ladder score"];
      const corruption = country["Perceptions of corruption"];
      const support = country["Social support"];
      const glow = country["Healthy life expectancy"];
      const r = 32 + 48 * norm(ladder, ...minmax["Ladder score"]);
      const opacity = 0.45 + 0.55 * (1 - norm(corruption, ...minmax["Perceptions of corruption"]));
      const border = 2 + 8 * norm(support, ...minmax["Social support"]);
      const glowNorm = norm(glow, ...minmax["Healthy life expectancy"]);
      const colorStops = flagPalette[country["Country name"]] || fallbackPalette(country["Country name"]);
      let col = i % cols, row = Math.floor(i / cols);
      let x = (col + 0.5) * cellW, y = (row + 0.5) * cellH;
      return {
        idx: i, country, x, y, tx: x, ty: y, vx: 0, vy: 0, r, baseR: r, colorStops, opacity, border, glow: glowNorm,
        anchorX: x, anchorY: y, region: country["Regional indicator"], hover: false, selected: false, driftSeed: i * 0.7,
      };
    });
  }, [countries, layoutMode]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let width = window.innerWidth, height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    let running = true;
    function animate() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width * dpr, height * dpr);
      // Background
      let grad = ctx.createLinearGradient(0, 0, width * dpr, height * dpr);
      grad.addColorStop(0, "#1a2332");
      grad.addColorStop(1, "#223a5f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width * dpr, height * dpr);

      // Animate nodes
      let nodes = nodesRef.current;
      // Focus mode
      let focus = typeof focusIdx === "number" ? nodes[focusIdx] : null;
      // Layout targets
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        // Target: focus mode
        if (focus && focus.idx === n.idx) {
          n.tx = width / 2;
          n.ty = height / 2;
        } else if (focus) {
          n.tx = n.anchorX;
          n.ty = n.anchorY;
        }
        // Animate position
        n.x += (n.tx - n.x) * 0.18;
        n.y += (n.ty - n.y) * 0.18;
        // Animate radius
        let targetR = n.baseR * (focus && focus.idx === n.idx ? 2.1 : hoverIdx === n.idx ? 1.08 : 1);
        n.r += (targetR - n.r) * 0.18;
      }
      // Ambient motion
      if (motion) {
        for (let n of nodes) {
          let drift = Math.sin(Date.now() / 1200 + n.driftSeed) * 8;
          let drift2 = Math.cos(Date.now() / 900 + n.driftSeed) * 6;
          n.x += drift * 0.04;
          n.y += drift2 * 0.04;
        }
      }
      // Collision separation (spatial grid)
      const gridSize = 120;
      const buckets: Record<string, number[]> = {};
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        let gx = Math.floor(n.x / gridSize), gy = Math.floor(n.y / gridSize);
        let key = gx + "," + gy;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(i);
      }
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        let gx = Math.floor(n.x / gridSize), gy = Math.floor(n.y / gridSize);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          let key = (gx + dx) + "," + (gy + dy);
          for (let j of buckets[key] || []) {
            if (i === j) continue;
            let m = nodes[j];
            let minDist = n.r + m.r + 6;
            let dx = n.x - m.x, dy = n.y - m.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist && dist > 0.1) {
              let push = (minDist - dist) * 0.12;
              n.x += (dx / dist) * push;
              n.y += (dy / dist) * push;
            }
          }
        }
      }
      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        // Fade others in focus mode
        let fade = focus && focus.idx !== n.idx ? 0.18 : n.opacity;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 18;
        // Circle gradient
        let grad = ctx.createRadialGradient(n.x * dpr, n.y * dpr, n.r * dpr * 0.2, n.x * dpr, n.y * dpr, n.r * dpr);
        grad.addColorStop(0, n.colorStops[0]);
        grad.addColorStop(0.7, n.colorStops[1] || n.colorStops[0]);
        grad.addColorStop(1, n.colorStops[2] || n.colorStops[1] || n.colorStops[0]);
        ctx.beginPath();
        ctx.arc(n.x * dpr, n.y * dpr, n.r * dpr, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        // Border (social support)
        ctx.lineWidth = n.border * dpr;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        // Glow (life expectancy)
        if (n.glow > 0.1) {
          ctx.save();
          ctx.shadowColor = n.colorStops[1] || n.colorStops[0];
          ctx.shadowBlur = n.glow * n.r * dpr * 1.2;
          ctx.globalAlpha = 0.18 * n.glow;
          ctx.beginPath();
          ctx.arc(n.x * dpr, n.y * dpr, n.r * dpr * 0.92, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fillStyle = n.colorStops[1] || n.colorStops[0];
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      // Dimming overlay in focus mode
      if (focus) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = "#1a2332";
        ctx.fillRect(0, 0, width * dpr, height * dpr);
        ctx.restore();
      }
      if (running) requestAnimationFrame(animate);
    }
    animate();
    return () => {
      running = false;
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, layoutMode, motion, hoverIdx, focusIdx, countries]);

  // Hit testing
  useEffect(() => {
    const canvas = canvasRef.current!;
    function getIdxFromEvent(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left);
      const my = (e.clientY - rect.top);
      let nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];
        let r = n.r * (n.selected ? 2.1 : n.hover ? 1.08 : 1);
        if ((mx - n.x) ** 2 + (my - n.y) ** 2 < r ** 2) return i;
      }
      return null;
    }
    function onMove(e: MouseEvent) {
      const idx = getIdxFromEvent(e);
      document.body.style.cursor = idx !== null ? "pointer" : "default";
      setHoverIdx(idx);
    }
    function onClick(e: MouseEvent) {
      const idx = getIdxFromEvent(e);
      setFocusIdx(idx === focusIdx ? null : idx);
    }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", () => setHoverIdx(null));
    canvas.addEventListener("mousedown", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", () => setHoverIdx(null));
      canvas.removeEventListener("mousedown", onClick);
    };
  }, [canvasRef, setHoverIdx, setFocusIdx, focusIdx]);

  // ESC to close focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFocusIdx]);

  return { nodesRef, gridRef };
}

function norm(val: number | null, min: number, max: number) {
  if (val == null || isNaN(val)) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
