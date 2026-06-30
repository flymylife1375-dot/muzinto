'use strict';

const AREA_W = 1800, AREA_H = 1400;
const RESOURCE_COUNTS = { base: 8, forest: 22, coast: 18, rocky: 20, cave: 16, deep: 14 };
const ENEMY_COUNTS    = { base: 0, forest:  4, coast:  3, rocky:  4, cave:  4, deep:  6 };

// ============================================================
// VIRTUAL JOYSTICK
// ============================================================
class VirtualJoystick {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.touchId = null;
    this.baseX = 0; this.baseY = 0;
    this.stickX = 0; this.stickY = 0;
    this.dx = 0; this.dy = 0;
    this.radius = 60;

    canvas.addEventListener('touchstart',  e => this._onStart(e),  { passive: false });
    canvas.addEventListener('touchmove',   e => this._onMove(e),   { passive: false });
    canvas.addEventListener('touchend',    e => this._onEnd(e),    { passive: false });
    canvas.addEventListener('touchcancel', e => this._onEnd(e),    { passive: false });
  }

  _isLeft(x) { return x < window.innerWidth * 0.52; }

  _onStart(e) {
    for (const t of e.changedTouches) {
      if (this.touchId === null && this._isLeft(t.clientX)) {
        e.preventDefault();
        this.touchId = t.identifier;
        this.active  = true;
        this.baseX   = t.clientX; this.baseY = t.clientY;
        this.stickX  = t.clientX; this.stickY = t.clientY;
        this.dx = 0; this.dy = 0;
      }
    }
  }
  _onMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.touchId) {
        e.preventDefault();
        const raw_dx = t.clientX - this.baseX;
        const raw_dy = t.clientY - this.baseY;
        const d = Math.hypot(raw_dx, raw_dy);
        const clamped = Math.min(d, this.radius);
        const angle = Math.atan2(raw_dy, raw_dx);
        this.stickX = this.baseX + Math.cos(angle) * clamped;
        this.stickY = this.baseY + Math.sin(angle) * clamped;
        this.dx = Math.cos(angle) * (clamped / this.radius);
        this.dy = Math.sin(angle) * (clamped / this.radius);
      }
    }
  }
  _onEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.touchId) {
        this.touchId = null; this.active = false;
        this.dx = 0; this.dy = 0;
      }
    }
  }

  // Keyboard support — only overrides dx/dy when a key is pressed,
  // or when no touch is active (prevents zeroing out live touch input).
  setFromKeys(keys) {
    let x = 0, y = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp']    || keys['KeyW']) y -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) y += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      this.dx = x / len; this.dy = y / len;
    } else if (!this.active) {
      // Touch is not active → safe to zero out (no touch input to clobber)
      this.dx = 0; this.dy = 0;
    }
    // If touch IS active and no key is pressed, leave dx/dy as-is (touch owns it)
  }

  draw(ctx) {
    const bx = this.active ? this.baseX  : ctx.canvas.width  * 0.16;
    const by = this.active ? this.baseY  : ctx.canvas.height * 0.80;
    const sx = this.active ? this.stickX : bx;
    const sy = this.active ? this.stickY : by;

    ctx.beginPath(); ctx.arc(bx, by, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.fill();
  }
}

// ============================================================
// AREA SCENE
// ============================================================
class AreaScene {
  constructor(areaType) {
    this.type = areaType;
    this.cfg  = AREA_CFG[areaType];
    this.resources = [];
    this.enemies   = [];
    this._generateResources();
    this._generateEnemies();
    // base facilities drawn positions
    this.facilityPositions = [
      { id: 'campfire',        x: AREA_W/2 - 160, y: AREA_H/2     },
      { id: 'water_collector', x: AREA_W/2 - 80,  y: AREA_H/2 - 120 },
      { id: 'bed',             x: AREA_W/2 + 80,  y: AREA_H/2 - 100 },
      { id: 'storage',         x: AREA_W/2 + 170, y: AREA_H/2     },
      { id: 'workbench',       x: AREA_W/2,       y: AREA_H/2 + 130 },
      { id: 'fence',           x: AREA_W/2 - 160, y: AREA_H/2 + 130 },
      { id: 'farm',            x: AREA_W/2 + 160, y: AREA_H/2 + 130 },
      { id: 'raft_dock',       x: AREA_W/2,       y: AREA_H/2 - 150 },
    ];
  }

  _generateResources() {
    const typeList = this.cfg.resources;
    const total = RESOURCE_COUNTS[this.type] || 10;
    const margin = 80;
    for (let i = 0; i < total; i++) {
      const t = typeList[i % typeList.length];
      let x, y, tries = 0;
      do {
        x = margin + Math.random() * (AREA_W - margin * 2);
        y = margin + Math.random() * (AREA_H - margin * 2);
        // keep resources away from base center
        if (this.type === 'base') {
          const dx = x - AREA_W/2, dy = y - AREA_H/2;
          if (Math.hypot(dx, dy) < 220) { tries++; continue; }
        }
        break;
      } while (tries < 10);
      this.resources.push(new ResourceNode(t, x, y));
    }
  }

  _generateEnemies() {
    const typeList = this.cfg.enemies;
    if (!typeList.length) return;
    const total = ENEMY_COUNTS[this.type] || 0;
    const margin = 100;
    for (let i = 0; i < total; i++) {
      const t = typeList[i % typeList.length];
      const x = margin + Math.random() * (AREA_W - margin * 2);
      const y = margin + Math.random() * (AREA_H - margin * 2);
      this.enemies.push(new Enemy(t, x, y));
    }
  }

  respawnEnemies() {
    // remove fully dead enemies, add replacements
    this.enemies = this.enemies.filter(e => !(e.dead && e.deathAge > 2));
    const typeList = this.cfg.enemies;
    if (!typeList.length) return;
    const maxCount = ENEMY_COUNTS[this.type] || 0;
    const alive = this.enemies.filter(e => !e.dead).length;
    if (alive < Math.ceil(maxCount * 0.5)) {
      const t = typeList[Math.floor(Math.random() * typeList.length)];
      const margin = 200;
      const x = margin + Math.random() * (AREA_W - margin * 2);
      const y = margin + Math.random() * (AREA_H - margin * 2);
      this.enemies.push(new Enemy(t, x, y));
    }
  }

  getNearbyResource(px, py, dist = 70) {
    let best = null, bestD = dist;
    for (const r of this.resources) {
      if (r.depleted) continue;
      const d = Math.hypot(px - r.x, py - r.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  getNearbyEnemy(px, py, dist = 60) {
    let best = null, bestD = dist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(px - e.x, py - e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  getNearbyFacility(px, py, facilities, dist = 90) {
    let best = null, bestD = dist;
    for (const fp of this.facilityPositions) {
      if (!facilities.has(fp.id)) continue;
      const d = Math.hypot(px - fp.x, py - fp.y);
      if (d < bestD) { bestD = d; best = fp; }
    }
    return best;
  }

  update(dt, player, isNight, facilities) {
    for (const r of this.resources) r.update(dt);
    for (const e of this.enemies)   e.update(dt, player, isNight, AREA_W, AREA_H, facilities.has('fence'));
  }

  drawGround(ctx, cx, cy, cw, ch, isNight) {
    ctx.fillStyle = this.cfg.color;
    ctx.fillRect(0, 0, cw, ch);
    // grid pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    const gs = 80;
    const ox = (-cx) % gs, oy = (-cy) % gs;
    for (let gx = ox; gx < cw; gx += gs) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
    }
    for (let gy = oy; gy < ch; gy += gs) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
    }
    // area boundary
    const bx1 = -cx, by1 = -cy;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3;
    ctx.strokeRect(bx1, by1, AREA_W, AREA_H);
    // night overlay
    if (isNight) {
      ctx.fillStyle = 'rgba(0,0,30,0.45)';
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  drawFacilities(ctx, cx, cy, facilities) {
    if (this.type !== 'base') return;
    for (const fp of this.facilityPositions) {
      if (!facilities.has(fp.id)) continue;
      const info = FACILITY_INFO[fp.id];
      const sx = fp.x - cx, sy = fp.y - cy;
      ctx.beginPath(); ctx.arc(sx, sy, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80,60,20,0.7)'; ctx.fill();
      ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.icon, sx, sy - 1);
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'bottom';
      ctx.fillText(info.name, sx, sy + 34);
    }
  }

  drawAll(ctx, cx, cy, cw, ch, isNight, facilities) {
    this.drawGround(ctx, cx, cy, cw, ch, isNight);
    this.drawFacilities(ctx, cx, cy, facilities);
    for (const r of this.resources) r.draw(ctx, cx, cy);
    for (const e of this.enemies)   e.draw(ctx, cx, cy);
  }

  drawNightVignette(ctx, px, py, cx, cy, cw, ch, hasTorch) {
    if (px == null) return;
    const sx = px - cx, sy = py - cy;
    const radius = hasTorch ? 350 : 180;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0,   'rgba(0,0,20,0)');
    grad.addColorStop(0.7, 'rgba(0,0,20,0.3)');
    grad.addColorStop(1.0, 'rgba(0,0,20,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
  }
}
