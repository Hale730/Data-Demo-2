// sketch.js (overwrite the whole file)
(() => {
  /** =========================
   *  CONFIG
   *  ========================= */
  const CSV_PATHS = [
    "./Data/World-happiness-report-2024.csv",
    "./Data/world-happiness-report-2024.csv",
    "./World-happiness-report-2024.csv",
    "./data.csv",
  ];

  const COL = {
    name: "Country name",
    region: "Regional indicator",
    ladder: "Ladder score",
    gdp: "Log GDP per capita",
    support: "Social support",
    life: "Healthy life expectancy",
    freedom: "Freedom to make life choices",
    generosity: "Generosity",
    corruption: "Perceptions of corruption",
    dystopia: "Dystopia + residual",
  };

  const METRICS = [
    COL.ladder, COL.gdp, COL.support, COL.life,
    COL.freedom, COL.generosity, COL.corruption, COL.dystopia
  ];

  /** =========================
   *  SMALL UTILS
   *  ========================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hsl(h, s, l) {
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  }

  function formatNum(v) {
    if (v == null || Number.isNaN(v)) return "—";
    if (!Number.isFinite(v)) return "—";
    return (+v).toFixed(3);
  }

  function splitCSVLine(line) {
    // minimal CSV with quotes support
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.replace(/^"|"$/g, ""));
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        const raw = (cols[j] ?? "").trim();
        if (raw === "") obj[key] = null;
        else {
          const num = Number(raw);
          obj[key] = Number.isFinite(num) ? num : raw;
        }
      }
      rows.push(obj);
    }
    return rows;
  }

  async function fetchFirst(paths) {
    let lastErr = null;
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.text();
      } catch (e) {
        lastErr = e;
      }
    }
    throw (lastErr ?? new Error("Failed to load CSV."));
  }

  /** =========================
   *  DATASTORE
   *  ========================= */
  class DataStore {
    constructor() {
      this.ranges = {};
    }

    computeRanges(rows) {
      const mm = {};
      for (const k of METRICS) mm[k] = { min: Infinity, max: -Infinity };

      for (const r of rows) {
        for (const k of METRICS) {
          const v = r[k];
          if (typeof v === "number" && Number.isFinite(v)) {
            mm[k].min = Math.min(mm[k].min, v);
            mm[k].max = Math.max(mm[k].max, v);
          }
        }
      }

      for (const k of METRICS) {
        if (!Number.isFinite(mm[k].min)) mm[k] = { min: 0, max: 1 };
        if (mm[k].max === mm[k].min) mm[k].max = mm[k].min + 1;
      }

      this.ranges = mm;
    }

    norm(v, key) {
      if (v == null || !Number.isFinite(v)) return 0;
      const r = this.ranges[key];
      return clamp((v - r.min) / (r.max - r.min), 0, 1);
    }

    toNodes(rows) {
      // Clean rows and build node objects
      const cleaned = rows
        .filter(r => typeof r[COL.name] === "string" && r[COL.name].trim().length > 0)
        .map((r, i) => {
          const name = r[COL.name].trim();
          const region = (r[COL.region] ?? "Unknown").toString().trim() || "Unknown";

          const seed = hash32(name);
          const hue = (seed % 360);
          const hue2 = ((seed / 11) % 360);

          // New visual encoding:
          // size ~ ladder, brightness ~ freedom, stroke ~ support
          const ladderT = this.norm(r[COL.ladder], COL.ladder);
          const freedomT = this.norm(r[COL.freedom], COL.freedom);
          const supportT = this.norm(r[COL.support], COL.support);

          const base = lerp(7, 18, ladderT);

          return {
            id: i,
            name,
            region,

            ladder: r[COL.ladder],
            gdp: r[COL.gdp],
            support: r[COL.support],
            life: r[COL.life],
            freedom: r[COL.freedom],
            generosity: r[COL.generosity],
            corruption: r[COL.corruption],
            dystopia: r[COL.dystopia],

            // style
            hue,
            hue2,
            size0: base,
            glow0: lerp(0, 18, freedomT),
            stroke0: lerp(1.0, 4.5, supportT),

            // sim
            x: 0, y: 0, vx: 0, vy: 0,
            tx: 0, ty: 0,
            w: base, h: base, // will animate
          };
        });

      return cleaned;
    }
  }

  /** =========================
   *  UI
   *  ========================= */
  class UI {
    constructor(root) {
      this.root = root;

      this.canvas = document.createElement("canvas");
      this.canvas.id = "viz";

      this.hud = document.createElement("div");
      this.hud.id = "hud";
      this.hud.innerHTML = `
        <div class="hud-row">
          <div class="hud-title">World Happiness • Scatter</div>
          <button class="btn" data-action="reset">Reset</button>
        </div>

        <div class="hud-row">
          <label class="label">Search</label>
          <input class="input" data-role="search" placeholder="Type a country, press Enter" />
        </div>

        <div class="hud-row">
          <label class="label">Compare</label>
          <select class="select" data-role="pickA"></select>
          <span class="vs">vs</span>
          <select class="select" data-role="pickB"></select>
          <button class="btn" data-action="clearCompare">Clear</button>
        </div>

        <div class="hud-row small">
          <span class="chip">X: GDP</span>
          <span class="chip">Y: Ladder</span>
          <span class="chip">Size: Ladder</span>
          <span class="chip">Glow: Freedom</span>
          <span class="chip">Stroke: Support</span>
        </div>
      `;

      this.info = document.createElement("div");
      this.info.id = "info";
      this.info.innerHTML = `
        <div class="info-title">Hover a country</div>
        <div class="info-sub">Or use search / compare.</div>
        <div class="info-body"></div>
      `;

      this.cross = document.createElement("div");
      this.cross.id = "crosshair";

      root.appendChild(this.canvas);
      root.appendChild(this.cross);
      root.appendChild(this.hud);
      root.appendChild(this.info);

      this.search = this.hud.querySelector('[data-role="search"]');
      this.pickA = this.hud.querySelector('[data-role="pickA"]');
      this.pickB = this.hud.querySelector('[data-role="pickB"]');

      this._onReset = () => {};
      this._onSearch = () => {};
      this._onCompare = () => {};
      this._onClearCompare = () => {};

      this.hud.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "reset") this._onReset();
        if (action === "clearCompare") this._onClearCompare();
      });

      this.search.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const q = this.search.value.trim();
        if (q) this._onSearch(q);
      });

      const onSel = () => this._onCompare(this.pickA.value, this.pickB.value);
      this.pickA.addEventListener("change", onSel);
      this.pickB.addEventListener("change", onSel);
    }

    onReset(fn) { this._onReset = fn; }
    onSearch(fn) { this._onSearch = fn; }
    onCompare(fn) { this._onCompare = fn; }
    onClearCompare(fn) { this._onClearCompare = fn; }

    populateSelects(nodes) {
      const opts = nodes
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(n => `<option value="${n.id}">${n.name}</option>`)
        .join("");

      this.pickA.innerHTML = `<option value="">—</option>${opts}`;
      this.pickB.innerHTML = `<option value="">—</option>${opts}`;
    }

    setInfo(node, extraHtml = "") {
      const title = this.info.querySelector(".info-title");
      const sub = this.info.querySelector(".info-sub");
      const body = this.info.querySelector(".info-body");

      if (!node) {
        title.textContent = "Hover a country";
        sub.textContent = "Or use search / compare.";
        body.innerHTML = "";
        return;
      }

      title.textContent = node.name;
      sub.textContent = `${node.region} • Ladder ${formatNum(node.ladder)}`;
      body.innerHTML = `
        <div class="kv"><span>GDP</span><span>${formatNum(node.gdp)}</span></div>
        <div class="kv"><span>Support</span><span>${formatNum(node.support)}</span></div>
        <div class="kv"><span>Life</span><span>${formatNum(node.life)}</span></div>
        <div class="kv"><span>Freedom</span><span>${formatNum(node.freedom)}</span></div>
        <div class="kv"><span>Generosity</span><span>${formatNum(node.generosity)}</span></div>
        <div class="kv"><span>Corruption</span><span>${formatNum(node.corruption)}</span></div>
        ${extraHtml}
      `;
    }

    setCrosshair(x, y, on) {
      if (!on) {
        this.cross.style.opacity = "0";
        return;
      }
      this.cross.style.opacity = "1";
      this.cross.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    showCompare(a, b, deltas) {
      if (!a || !b) return;

      const row = (label, da) => {
        const dir = da > 0 ? "pos" : (da < 0 ? "neg" : "");
        return `<div class="delta ${dir}">
          <span>${label}</span>
          <span>${da > 0 ? "+" : ""}${da.toFixed(3)}</span>
        </div>`;
      };

      const extra = `
        <div class="divider"></div>
        <div class="compare-title">Compare</div>
        <div class="compare-sub">${a.name} vs ${b.name}</div>
        ${row("Ladder", deltas.ladder)}
        ${row("GDP", deltas.gdp)}
        ${row("Support", deltas.support)}
        ${row("Life", deltas.life)}
        ${row("Freedom", deltas.freedom)}
      `;

      // Keep info panel showing currently hovered node; compare is additive if hover exists.
      // If nothing hovered, show A as the base.
      this.setInfo(a, extra);
    }
  }

  /** =========================
   *  VIZ
   *  ========================= */
  class Viz {
    constructor(ui, store) {
      this.ui = ui;
      this.store = store;

      this.canvas = ui.canvas;
      this.ctx = this.canvas.getContext("2d", { alpha: true });

      this.W = 0;
      this.H = 0;
      this.DPR = 1;

      this.nodes = [];
      this.hovered = null;

      this.mouse = { x: -1, y: -1, inside: false };

      // camera / focus
      this.focusId = null;
      this.focusT = 0;

      // axis padding
      this.pad = 80;

      // binding
      this._raf = null;
      this._t0 = performance.now();

      this.attachEvents();
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    attachEvents() {
      this.canvas.addEventListener("mousemove", (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left;
        this.mouse.y = e.clientY - r.top;
        this.mouse.inside = true;
      });

      this.canvas.addEventListener("mouseleave", () => {
        this.mouse.inside = false;
        this.hovered = null;
        this.ui.setCrosshair(0, 0, false);
        this.ui.setInfo(null);
      });

      this.canvas.addEventListener("click", () => {
        if (this.hovered) this.focusOn(this.hovered.id);
        else this.clearFocus();
      });

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.clearFocus();
      });
    }

    resize() {
      this.DPR = window.devicePixelRatio || 1;
      this.W = window.innerWidth;
      this.H = window.innerHeight;

      this.canvas.width = Math.floor(this.W * this.DPR);
      this.canvas.height = Math.floor(this.H * this.DPR);
      this.canvas.style.width = `${this.W}px`;
      this.canvas.style.height = `${this.H}px`;

      this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

      this.retargetScatter();
      // start positioned
      if (this.nodes.length) {
        for (const n of this.nodes) {
          if (!Number.isFinite(n.x)) { n.x = n.tx; n.y = n.ty; }
        }
      }
    }

    setNodes(nodes) {
      this.nodes = nodes;
      this.retargetScatter();
      // initialize positions at targets
      for (const n of this.nodes) {
        n.x = n.tx;
        n.y = n.ty;
        n.vx = 0;
        n.vy = 0;
      }
    }

    retargetScatter() {
      if (!this.nodes.length) return;
      const p = this.pad;

      for (const n of this.nodes) {
        const xT = this.store.norm(n.gdp, COL.gdp);
        const yT = this.store.norm(n.ladder, COL.ladder);
        n.tx = p + xT * (this.W - p * 2);
        n.ty = p + (1 - yT) * (this.H - p * 2);
      }
    }

    focusOn(id) {
      this.focusId = id;
      this.focusT = 0;
    }

    clearFocus() {
      this.focusId = null;
      this.focusT = 0;
    }

    findByName(query) {
      const q = query.toLowerCase();
      let best = null;
      let bestScore = Infinity;

      for (const n of this.nodes) {
        const name = n.name.toLowerCase();
        const idx = name.indexOf(q);
        if (idx >= 0) {
          // earlier match wins; shorter distance wins
          const score = idx + (name.length - q.length) * 0.02;
          if (score < bestScore) {
            bestScore = score;
            best = n;
          }
        }
      }
      return best;
    }

    // Hover: simple nearest search within radius (no spatial hash; different signature)
    pickHover(mx, my) {
      let best = null;
      let bestD = Infinity;

      for (const n of this.nodes) {
        const dx = mx - n.x;
        const dy = my - n.y;
        const d = Math.hypot(dx, dy);
        const r = Math.max(8, n.w);
        if (d <= r + 4 && d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    }

    tick(dt, t) {
      const k = 0.10;
      const damp = 0.84;

      // focus interpolation
      if (this.focusId != null) this.focusT = clamp(this.focusT + dt * 1.6, 0, 1);
      else this.focusT = clamp(this.focusT - dt * 1.8, 0, 1);

      const ft = this.focusT * this.focusT * (3 - 2 * this.focusT);
      const cx = this.W * 0.5;
      const cy = this.H * 0.5;

      // update physics (scatter anchors + slight breathing)
      for (const n of this.nodes) {
        let tx = n.tx;
        let ty = n.ty;

        if (this.focusId === n.id) {
          tx = lerp(n.tx, cx, ft);
          ty = lerp(n.ty, cy, ft);
        }

        const breathe = (this.focusId == null)
          ? (Math.sin(t * 0.7 + (n.hue * 0.05)) * 0.8)
          : 0;

        const dx = (tx + breathe) - n.x;
        const dy = (ty - breathe) - n.y;

        n.vx = (n.vx + dx * k) * damp;
        n.vy = (n.vy + dy * k) * damp;

        n.x += n.vx;
        n.y += n.vy;

        const targetSize = (this.focusId === n.id)
          ? Math.max(n.size0 * 2.4, 40)
          : n.size0;

        // animate marker size separately (different from radius-only circles)
        n.w = lerp(n.w, targetSize, 0.14);
        n.h = n.w;
      }

      // gentle separation to reduce overlap (pairwise but limited)
      if (this.focusId == null) {
        const N = this.nodes.length;
        for (let i = 0; i < N; i++) {
          const a = this.nodes[i];
          for (let j = i + 1; j < N; j++) {
            const b = this.nodes[j];

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy) || 0.0001;

            const minDist = (a.w + b.w) * 0.42;
            if (dist < minDist) {
              const push = (minDist - dist) * 0.08;
              const ux = dx / dist;
              const uy = dy / dist;
              a.x += ux * push; a.y += uy * push;
              b.x -= ux * push; b.y -= uy * push;
            }
          }
        }
      }

      // hover
      if (this.mouse.inside && this.focusId == null) {
        const h = this.pickHover(this.mouse.x, this.mouse.y);
        this.hovered = h;
        if (h) {
          this.ui.setCrosshair(h.x, h.y, true);
          this.ui.setInfo(h);
        } else {
          this.ui.setCrosshair(0, 0, false);
          this.ui.setInfo(null);
        }
      } else if (this.focusId != null) {
        const n = this.nodes.find(x => x.id === this.focusId);
        this.ui.setCrosshair(n?.x ?? 0, n?.y ?? 0, !!n);
      }
    }

    drawAxes() {
      const ctx = this.ctx;
      const p = this.pad;

      ctx.save();
      ctx.globalAlpha = 0.9;

      // axis lines
      ctx.beginPath();
      ctx.moveTo(p, p);
      ctx.lineTo(p, this.H - p);
      ctx.lineTo(this.W - p, this.H - p);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ticks
      const tickN = 6;
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.65)";

      for (let i = 0; i <= tickN; i++) {
        const t = i / tickN;

        // X tick (GDP)
        const x = p + t * (this.W - p * 2);
        const y0 = this.H - p;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + 6);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.stroke();

        // label: min..max
        const r = this.store.ranges[COL.gdp];
        const v = lerp(r.min, r.max, t);
        ctx.fillText(v.toFixed(2), x - 12, y0 + 22);
      }

      for (let i = 0; i <= tickN; i++) {
        const t = i / tickN;

        // Y tick (Ladder) - invert
        const y = p + t * (this.H - p * 2);
        const x0 = p;
        ctx.beginPath();
        ctx.moveTo(x0 - 6, y);
        ctx.lineTo(x0, y);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.stroke();

        const r = this.store.ranges[COL.ladder];
        const v = lerp(r.max, r.min, t); // inverted
        ctx.fillText(v.toFixed(2), x0 - 44, y + 4);
      }

      // labels
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText("GDP (log) →", this.W - this.pad - 80, this.H - this.pad + 46);
      ctx.save();
      ctx.translate(this.pad - 56, this.pad + 120);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Ladder score →", 0, 0);
      ctx.restore();

      ctx.restore();
    }

    drawNode(n) {
      const ctx = this.ctx;

      const isFocus = (this.focusId === n.id);
      const isHover = (this.hovered?.id === n.id);

      // Visual encoding:
      // brightness from freedom, outline from support, subtle tint by region hash
      const freedomT = this.store.norm(n.freedom, COL.freedom);
      const supportT = this.store.norm(n.support, COL.support);
      const corruptionT = this.store.norm(n.corruption, COL.corruption);

      const fill = hsl(n.hue, 70, lerp(40, 62, freedomT));
      const fill2 = hsl(n.hue2, 70, lerp(32, 52, freedomT));

      // corruption -> reduce alpha
      const alpha = lerp(0.92, 0.45, corruptionT) * (this.focusId != null && !isFocus ? 0.15 : 1);

      const w = n.w;
      const r = Math.max(6, w * 0.35);

      // shadow / glow
      ctx.save();
      ctx.globalAlpha = alpha;

      const glow = n.glow0 * (isHover ? 1.15 : 1) * (isFocus ? 1.25 : 1);

      ctx.shadowColor = "rgba(0,0,0,0.60)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      // body gradient
      const g = ctx.createLinearGradient(n.x - w, n.y - w, n.x + w, n.y + w);
      g.addColorStop(0, fill);
      g.addColorStop(1, fill2);

      // outer glow (no ring; different signature)
      if (glow > 0.5) {
        ctx.shadowColor = "rgba(255,255,255,0.12)";
        ctx.shadowBlur = 10 + glow;
      }

      // rounded square
      this.roundRect(n.x - w * 0.5, n.y - w * 0.5, w, w, r);
      ctx.fillStyle = g;
      ctx.fill();

      // outline based on support
      ctx.shadowBlur = 0;
      ctx.lineWidth = n.stroke0;
      ctx.strokeStyle = `rgba(255,255,255,${lerp(0.10, 0.42, supportT)})`;
      ctx.stroke();

      // focus highlight
      if (isFocus) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(255,255,255,0.80)";
        ctx.stroke();
      }

      // hover micro-label
      if (isHover) {
        ctx.globalAlpha = 0.9;
        ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(n.name, n.x + w * 0.6, n.y - w * 0.55);
      }

      ctx.restore();
    }

    roundRect(x, y, w, h, r) {
      const ctx = this.ctx;
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    render(timeMs) {
      const now = timeMs;
      const dt = Math.min(0.05, (now - this._t0) / 1000);
      this._t0 = now;

      const t = now / 1000;

      // clear
      this.ctx.clearRect(0, 0, this.W, this.H);

      // axes first
      this.drawAxes();

      // update
      this.tick(dt, t);

      // draw nodes
      for (const n of this.nodes) this.drawNode(n);

      this._raf = requestAnimationFrame((tm) => this.render(tm));
    }

    start() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._t0 = performance.now();
      this._raf = requestAnimationFrame((tm) => this.render(tm));
    }
  }

  /** =========================
   *  MAIN
   *  ========================= */
  async function main() {
    const root = document.body;
    const ui = new UI(root);

    const store = new DataStore();
    const viz = new Viz(ui, store);

    ui.onReset(() => viz.clearFocus());

    ui.onSearch((q) => {
      const n = viz.findByName(q);
      if (!n) return;
      viz.focusOn(n.id);
      ui.search.blur();
      // also set compare A if empty
      if (!ui.pickA.value) ui.pickA.value = String(n.id);
    });

    ui.onCompare((aId, bId) => {
      const a = viz.nodes.find(n => String(n.id) === String(aId));
      const b = viz.nodes.find(n => String(n.id) === String(bId));
      if (!a || !b) return;

      const deltas = {
        ladder: (a.ladder ?? 0) - (b.ladder ?? 0),
        gdp: (a.gdp ?? 0) - (b.gdp ?? 0),
        support: (a.support ?? 0) - (b.support ?? 0),
        life: (a.life ?? 0) - (b.life ?? 0),
        freedom: (a.freedom ?? 0) - (b.freedom ?? 0),
      };

      viz.focusOn(a.id);
      ui.showCompare(a, b, deltas);
    });

    ui.onClearCompare(() => {
      ui.pickA.value = "";
      ui.pickB.value = "";
      // restore hover-driven info
      ui.setInfo(viz.hovered);
    });

    try {
      const csvText = await fetchFirst(CSV_PATHS);
      const rows = parseCSV(csvText);

      store.computeRanges(rows);
      const nodes = store.toNodes(rows);

      ui.populateSelects(nodes);
      viz.setNodes(nodes);
      viz.start();
    } catch (err) {
      console.error(err);
      ui.setInfo({
        name: "Error",
        region: "Could not load CSV",
        ladder: null, gdp: null, support: null, life: null,
        freedom: null, generosity: null, corruption: null
      }, `<div class="divider"></div><div class="err">${String(err)}</div>`);
    }
  }

  main();
})();
