'use strict';

// ============================================================
// WORLD MAP
// ============================================================
class WorldMap {
  constructor() {
    this.revealed = Array.from({ length: 5 }, () => Array(5).fill(false));
    this.revealed[BASE_ROW][BASE_COL] = true;

    // pre-cache area scenes per grid cell
    this.scenes = Array.from({ length: 5 }, () => Array(5).fill(null));
    this._getOrCreateScene(BASE_COL, BASE_ROW);

    this.playerCol = BASE_COL;
    this.playerRow = BASE_ROW;

    // travel in progress
    this.traveling = false;
    this.travelProgress = 0; // 0→1
    this.travelDuration = 0; // real seconds
    this.travelFromCol = BASE_COL; this.travelFromRow = BASE_ROW;
    this.travelToCol   = BASE_COL; this.travelToRow   = BASE_ROW;
  }

  _getOrCreateScene(col, row) {
    if (!this.scenes[row][col]) {
      const type = WORLD_GRID[row][col];
      if (!type) return null;
      this.scenes[row][col] = new AreaScene(type);
    }
    return this.scenes[row][col];
  }

  get currentScene() { return this.scenes[this.playerRow][this.playerCol]; }
  get currentType()  { return WORLD_GRID[this.playerRow][this.playerCol]; }

  reveal(col, row) {
    if (row >= 0 && row < 5 && col >= 0 && col < 5) {
      this.revealed[row][col] = true;
    }
  }

  isAdjacent(c1, r1, c2, r2) {
    return Math.abs(c1 - c2) <= 1 && Math.abs(r1 - r2) <= 1;
  }

  travelTimeSec(c1, r1, c2, r2) {
    // 10 game minutes per cell distance, 1 game hour = 37.5 real sec → 10 game min = 6.25 real sec
    const d = Math.max(Math.abs(c1-c2), Math.abs(r1-r2));
    return d * 6.25;
  }

  startTravel(col, row) {
    if (this.traveling) return false;
    if (!WORLD_GRID[row][col]) return false;
    this.travelFromCol = this.playerCol; this.travelFromRow = this.playerRow;
    this.travelToCol   = col;            this.travelToRow   = row;
    this.travelDuration  = this.travelTimeSec(this.playerCol, this.playerRow, col, row);
    this.travelProgress  = 0;
    this.traveling = true;
    this._getOrCreateScene(col, row);
    return true;
  }

  updateTravel(dt) {
    if (!this.traveling) return false;
    this.travelProgress += dt / this.travelDuration;
    if (this.travelProgress >= 1) {
      this.travelProgress = 1;
      this.traveling = false;
      this.playerCol = this.travelToCol;
      this.playerRow = this.travelToRow;
      this.reveal(this.playerCol, this.playerRow);
      return true; // arrived
    }
    return false;
  }

  // Draw the world map panel centered on canvas
  draw(ctx, cw, ch, gameTime, day) {
    // dim background
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillRect(0, 0, cw, ch);

    const cellSize = Math.min(Math.floor(Math.min(cw, ch) * 0.12), 72);
    const cols = 5, rows = 5;
    const totalW = cols * cellSize + (cols - 1) * 4;
    const totalH = rows * cellSize + (rows - 1) * 4;
    const ox = Math.floor((cw - totalW) / 2);
    const oy = Math.floor((ch - totalH) / 2) + 20;

    // Title
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`島の地図  Day ${day}`, cw / 2, oy - 28);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = WORLD_GRID[r][c];
        const x = ox + c * (cellSize + 4);
        const y = oy + r * (cellSize + 4);
        const rev = this.revealed[r][c];
        const isPlayer = (c === this.playerCol && r === this.playerRow);
        const isTarget = this.traveling && (c === this.travelToCol && r === this.travelToRow);

        // cell bg
        if (!type) {
          ctx.fillStyle = '#1a3050';
        } else if (rev) {
          ctx.fillStyle = AREA_CFG[type].color;
        } else {
          ctx.fillStyle = '#2a2a2a';
        }
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 5);
        ctx.fill();

        // border
        if (isPlayer) {
          ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 3;
        } else if (isTarget) {
          ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
        }
        ctx.stroke();

        // content
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!type) {
          ctx.font = `${Math.floor(cellSize * 0.35)}px serif`;
          ctx.fillText('🌊', x + cellSize / 2, y + cellSize / 2);
        } else if (rev) {
          ctx.font = `${Math.floor(cellSize * 0.38)}px serif`;
          ctx.fillText(AREA_CFG[type].icon, x + cellSize / 2, y + cellSize / 2 - 6);
          ctx.font = `${Math.max(8, Math.floor(cellSize * 0.15))}px sans-serif`;
          ctx.fillStyle = '#ddd';
          ctx.fillText(AREA_CFG[type].name, x + cellSize / 2, y + cellSize - 10);
        } else {
          ctx.font = `${Math.floor(cellSize * 0.35)}px serif`;
          ctx.fillText('🌫️', x + cellSize / 2, y + cellSize / 2 - 4);
          ctx.font = `${Math.max(8, Math.floor(cellSize * 0.14))}px sans-serif`;
          ctx.fillStyle = '#888';
          ctx.fillText('???', x + cellSize / 2, y + cellSize - 10);
        }

        // player icon
        if (isPlayer) {
          ctx.font = `${Math.floor(cellSize * 0.32)}px serif`;
          ctx.fillText('📍', x + cellSize / 2, y + 14);
        }
        if (isTarget) {
          ctx.font = `${Math.floor(cellSize * 0.28)}px serif`;
          ctx.fillText('🎯', x + cellSize / 2, y + 13);
        }
      }
    }

    // travel progress bar
    if (this.traveling) {
      const barW = Math.min(300, cw * 0.7);
      const barX = (cw - barW) / 2;
      const barY = oy + totalH + 18;
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, 18, 9); ctx.fill();
      ctx.fillStyle = '#4090ff';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * this.travelProgress, 18, 9); ctx.fill();
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const dest = WORLD_GRID[this.travelToRow][this.travelToCol];
      ctx.fillText(`移動中 → ${dest ? AREA_CFG[dest].name : '?'}`, cw / 2, barY + 9);
    }

    // legend & close hint
    const footY = oy + totalH + (this.traveling ? 50 : 22);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.traveling ? '' : 'タップで移動先を選択 | ✕ボタンで閉じる', cw / 2, footY);

    // Danger legend
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#888';
    ctx.fillText('📍現在地  ⚠️危険度: 低(白)〜高(赤)  🌫️未探索', cw / 2, footY + 18);
  }

  getCellAt(mx, my, cw, ch) {
    const cellSize = Math.min(Math.floor(Math.min(cw, ch) * 0.12), 72);
    const totalW = 5 * cellSize + 4 * 4;
    const totalH = 5 * cellSize + 4 * 4;
    const ox = Math.floor((cw - totalW) / 2);
    const oy = Math.floor((ch - totalH) / 2) + 20;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const x = ox + c * (cellSize + 4);
        const y = oy + r * (cellSize + 4);
        if (mx >= x && mx <= x + cellSize && my >= y && my <= y + cellSize) {
          return { col: c, row: r };
        }
      }
    }
    return null;
  }
}
