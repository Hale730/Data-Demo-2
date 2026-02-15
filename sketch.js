

let table;
let circles = [];
let hoverIdx = -1;

function preload() {
  // Correct path to Data/ subfolder
  table = loadTable('/Data/World-happiness-report-2024.csv', 'csv', 'header');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Inter, Arial', 14);
  if (!table) return;
  let minScore = 3.5, maxScore = 8;
  let N = table.getRowCount();
  let gridCols = ceil(sqrt(N * width / height));
  let gridRows = ceil(N / gridCols);
  let cellW = width / gridCols;
  let cellH = height / gridRows;
  for (let i = 0; i < N; i++) {
    let row = table.getRow(i);
    let score = float(row.get('Ladder score'));
    let r = 32 + 48 * norm(score, minScore, maxScore);
    let col = i % gridCols, rowIdx = floor(i / gridCols);
    let x = (col + 0.5) * cellW + random(-10, 10);
    let y = (rowIdx + 0.5) * cellH + random(-10, 10);
    let c = {
      name: row.get('Country name'),
      region: row.get('Regional indicator'),
      score: score,
      gdp: float(row.get('Log GDP per capita')),
      life: float(row.get('Healthy life expectancy')),
      freedom: float(row.get('Freedom to make life choices')),
      x, y, r,
      vx: 0, vy: 0,
      color: lerpColor(color('#ffe066'), color('#3c3b6e'), norm(score, minScore, maxScore)),
      border: 2 + 8 * norm(float(row.get('Social support')), 0.5, 1.7),
      glow: norm(float(row.get('Healthy life expectancy')), 0.2, 0.8),
    };
    circles.push(c);
  }
}

function draw() {
  background(26, 35, 50);
  if (!table || circles.length === 0) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text('Loading data...', width / 2, height / 2);
    return;
  }
  // Animate and resolve collisions
  for (let i = 0; i < circles.length; i++) {
    let c = circles[i];
    for (let j = i + 1; j < circles.length; j++) {
      let d = dist(c.x, c.y, circles[j].x, circles[j].y);
      let minDist = c.r / 2 + circles[j].r / 2 + 6;
      if (d < minDist && d > 0.1) {
        let angle = atan2(c.y - circles[j].y, c.x - circles[j].x);
        let push = (minDist - d) * 0.12;
        c.x += cos(angle) * push;
        c.y += sin(angle) * push;
        circles[j].x -= cos(angle) * push;
        circles[j].y -= sin(angle) * push;
      }
    }
    // Ambient drift
    c.x += sin(frameCount / 60 + i) * 0.2;
    c.y += cos(frameCount / 80 + i) * 0.2;
  }
  // Draw circles
  hoverIdx = -1;
  for (let i = 0; i < circles.length; i++) {
    let c = circles[i];
    let d = dist(mouseX, mouseY, c.x, c.y);
    let isHover = d < c.r / 2;
    if (isHover) hoverIdx = i;
    push();
    // Glow
    if (c.glow > 0.1) {
      noStroke();
      fill(160, 196, 255, 60 * c.glow);
      ellipse(c.x, c.y, c.r * 1.25);
    }
    // Main circle
    stroke(255);
    strokeWeight(c.border);
    fill(c.color);
    ellipse(c.x, c.y, c.r);
    // Label
    noStroke();
    fill(30, 40, 60, 180);
    textAlign(CENTER, CENTER);
    textSize(13 + 4 * norm(c.score, 3.5, 8));
    text(c.name, c.x, c.y, c.r * 0.9, c.r * 0.9);
    pop();
  }
  // Tooltip
  if (hoverIdx !== -1) {
    let c = circles[hoverIdx];
    drawTooltip(c);
    cursor('pointer');
  } else {
    cursor('default');
  }
}

function drawTooltip(c) {
  push();
  let x = constrain(mouseX, 20, width - 220);
  let y = constrain(mouseY, 20, height - 120);
  fill(30, 40, 60, 245);
  stroke(255);
  strokeWeight(2);
  rect(x, y, 200, 90, 12);
  noStroke();
  fill('#ffe066');
  textSize(16);
  textAlign(LEFT, TOP);
  text(c.name, x + 12, y + 8);
  fill('#a0c4ff');
  textSize(13);
  text(c.region, x + 12, y + 32);
  fill(255);
  textSize(13);
  text('Happiness: ' + nf(c.score, 1, 3), x + 12, y + 52);
  text('GDP: ' + (c.gdp ?? '–') + '  Life: ' + (c.life ?? '–'), x + 12, y + 68);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}