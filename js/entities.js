'use strict';

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor() {
    this.x = 0; this.y = 0;
    this.r = 20;
    this.speed = 150; this.runSpeed = 280;

    this.hp      = 100; this.maxHp      = 100;
    this.water   = 100; this.maxWater   = 100;
    this.hunger  = 100; this.maxHunger  = 100;
    this.stamina = 100; this.maxStamina = 100;

    this.isRunning   = false;
    this.exhausted   = false;
    this.exhaustTimer = 0;

    this.inventory  = [];  // [{itemId, count}]
    this.maxSlots   = 12;
    this.equippedSl = -1;

    this.gathering       = false;
    this.gatherProgress  = 0;
    this.gatherTarget    = null;
    this.gatherTotal     = 0;

    this.atkCooldown = 0;
    this.invincible  = 0;

    this.fx = 0; this.fy = 1;  // facing direction
  }

  get equipped() {
    return (this.equippedSl >= 0 && this.equippedSl < this.inventory.length)
      ? this.inventory[this.equippedSl] : null;
  }
  get damage() {
    const it = this.equipped;
    return (it && ITEMS[it.itemId] && ITEMS[it.itemId].damage) ? ITEMS[it.itemId].damage : 3;
  }
  get gatherBonus() {
    const it = this.equipped;
    return (it && ITEMS[it.itemId] && ITEMS[it.itemId].gatherBonus) ? ITEMS[it.itemId].gatherBonus : 1.0;
  }
  hasAxe() { return this.inventory.some(s => ITEMS[s.itemId] && ITEMS[s.itemId].isAxe); }
  hasTorch() { return this.inventory.some(s => ITEMS[s.itemId] && ITEMS[s.itemId].lightBonus); }

  countItem(id) {
    const s = this.inventory.find(s => s.itemId === id);
    return s ? s.count : 0;
  }
  hasItems(list) { return list.every(([id, n]) => this.countItem(id) >= n); }

  addItem(id, n = 1) {
    const def = ITEMS[id]; if (!def) return false;
    if (def.stackable) {
      const ex = this.inventory.find(s => s.itemId === id);
      if (ex) { ex.count = Math.min(ex.count + n, def.maxStack); return true; }
    }
    if (this.inventory.length >= this.maxSlots) return false;
    this.inventory.push({ itemId: id, count: Math.min(n, def.maxStack || 1) });
    return true;
  }
  removeItem(id, n = 1) {
    const i = this.inventory.findIndex(s => s.itemId === id);
    if (i < 0 || this.inventory[i].count < n) return false;
    this.inventory[i].count -= n;
    if (this.inventory[i].count <= 0) {
      this.inventory.splice(i, 1);
      if (this.equippedSl >= this.inventory.length) this.equippedSl = -1;
    }
    return true;
  }
  useItem(id) {
    const fx = ITEM_USE[id]; if (!fx) return false;
    this.removeItem(id, 1);
    if (fx.water)  this.water  = Math.min(this.maxWater,  this.water  + fx.water);
    if (fx.hunger) this.hunger = Math.min(this.maxHunger, this.hunger + fx.hunger);
    if (fx.hp)     this.hp     = Math.max(0, Math.min(this.maxHp, this.hp + fx.hp));
    return true;
  }

  update(dt, vx, vy, wantsRun) {
    // exhaustion
    if (this.exhausted) {
      this.exhaustTimer -= dt;
      if (this.exhaustTimer <= 0) this.exhausted = false;
    }
    const moving = Math.hypot(vx, vy) > 0.1;
    this.isRunning = wantsRun && moving && !this.exhausted && this.stamina > 0;
    if (this.isRunning) {
      this.stamina -= 45 * dt;
      if (this.stamina <= 0) { this.stamina = 0; this.isRunning = false; this.exhausted = true; this.exhaustTimer = 1.5; }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + (this.exhausted ? 15 : 25) * dt);
    }

    // move
    if (moving && !this.exhausted) {
      const len = Math.hypot(vx, vy);
      const spd = this.isRunning ? this.runSpeed : this.speed;
      this.x += (vx / len) * spd * dt;
      this.y += (vy / len) * spd * dt;
      this.fx = vx / len; this.fy = vy / len;
    }

    if (this.atkCooldown > 0) this.atkCooldown -= dt;
    if (this.invincible > 0)  this.invincible  -= dt;
  }

  takeDamage(n) {
    if (this.invincible > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.invincible = 0.8;
  }

  draw(ctx, cx, cy) {
    const sx = this.x - cx, sy = this.y - cy;
    // shadow
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.r * 0.8, this.r * 0.7, this.r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    // body
    ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, Math.PI * 2);
    const blink = this.invincible > 0 && Math.floor(Date.now() / 80) % 2 === 0;
    ctx.fillStyle = blink ? '#fff' : '#4070ee';
    ctx.fill();
    ctx.strokeStyle = '#a0b0ff'; ctx.lineWidth = 2; ctx.stroke();
    // direction dot
    ctx.beginPath(); ctx.arc(sx + this.fx * (this.r + 6), sy + this.fy * (this.r + 6), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    // emoji
    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧑', sx, sy - 1);
    // hp bar
    const bw = 40, bh = 4;
    ctx.fillStyle = '#333'; ctx.fillRect(sx - bw/2, sy - this.r - 10, bw, bh);
    ctx.fillStyle = `hsl(${this.hp * 1.2},90%,45%)`;
    ctx.fillRect(sx - bw/2, sy - this.r - 10, bw * (this.hp / this.maxHp), bh);
  }
}

// ============================================================
// ENEMY
// ============================================================
class Enemy {
  constructor(type, x, y) {
    this.type = type;
    const d = ENEMY_DEF[type];
    this.name = d.name; this.icon = d.icon; this.col = d.col;
    this.maxHp = d.maxHp; this.hp = d.maxHp;
    this.dmg = d.dmg; this.baseSpd = d.spd;
    this.alertBase = d.alert; this.atkR = d.atkR;
    this.atkCdBase = d.atkCd; this.drops = d.drops;
    this.x = x; this.y = y; this.r = 20;
    this.state = 'patrol';
    this.patrolTgt = { x, y }; this.patrolTimer = 0;
    this.atkTimer = 0;
    this.dead = false; this.deathAge = 0;
  }

  update(dt, player, isNight, areaW, areaH, fenceBuilt) {
    if (this.dead) { this.deathAge += dt; return; }
    const nightSpd = isNight ? 1.5 : 1.0;
    const nightAlert = isNight ? 1.8 : 1.0;
    const fenceMult = fenceBuilt ? 0.7 : 1.0;
    const spd = this.baseSpd * nightSpd;
    const alert = this.alertBase * nightAlert * fenceMult;

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.state === 'patrol') {
      if (dist < alert) this.state = 'chase';
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolTgt = { x: 60 + Math.random() * (areaW - 120), y: 60 + Math.random() * (areaH - 120) };
        this.patrolTimer = 3 + Math.random() * 4;
      }
      const pdx = this.patrolTgt.x - this.x, pdy = this.patrolTgt.y - this.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd > 10) { this.x += (pdx / pd) * spd * 0.4 * dt; this.y += (pdy / pd) * spd * 0.4 * dt; }
    } else if (this.state === 'chase') {
      if (dist > alert * 2.5) { this.state = 'patrol'; return; }
      if (dist < this.atkR)  { this.state = 'attack'; return; }
      if (dist > 1) { this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt; }
    } else if (this.state === 'attack') {
      if (dist > this.atkR * 1.6) { this.state = 'chase'; return; }
      this.atkTimer -= dt;
      if (this.atkTimer <= 0) { player.takeDamage(this.dmg); this.atkTimer = this.atkCdBase; }
      if (dist > this.atkR * 0.7 && dist > 1) {
        this.x += (dx / dist) * spd * 0.4 * dt; this.y += (dy / dist) * spd * 0.4 * dt;
      }
    }
    this.x = Math.max(this.r, Math.min(areaW - this.r, this.x));
    this.y = Math.max(this.r, Math.min(areaH - this.r, this.y));
  }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  rollDrops() {
    const out = [];
    for (const d of this.drops) {
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) out.push({ id: d.id, n });
    }
    return out;
  }

  draw(ctx, cx, cy) {
    const sx = this.x - cx, sy = this.y - cy;
    if (this.dead) {
      if (this.deathAge < 1.5) {
        ctx.globalAlpha = 1 - this.deathAge / 1.5;
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💀', sx, sy);
        ctx.globalAlpha = 1;
      }
      return;
    }
    ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.col; ctx.fill();
    if (this.state === 'chase' || this.state === 'attack') {
      ctx.strokeStyle = '#ff2020'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, sx, sy - 1);
    // hp bar
    const bw = 36, bh = 3;
    ctx.fillStyle = '#500'; ctx.fillRect(sx - bw/2, sy - this.r - 7, bw, bh);
    ctx.fillStyle = '#e00'; ctx.fillRect(sx - bw/2, sy - this.r - 7, bw * (this.hp / this.maxHp), bh);
  }
}

// ============================================================
// RESOURCE NODE (in area scene)
// ============================================================
class ResourceNode {
  constructor(type, x, y) {
    this.type = type;
    const d = RES_NODE[type];
    this.label = d.label; this.icon = d.icon; this.col = d.col;
    this.r = d.r; this.drops = d.drops;
    this.gatherTime = d.gatherTime; this.respawnTime = d.respawn;
    this.x = x; this.y = y;
    this.depleted = false;
    this.respawnTimer = 0;
  }

  update(dt) {
    if (this.depleted) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.depleted = false;
    }
  }

  harvest(gatherBonus) {
    const out = [];
    for (const d of this.drops) {
      let n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      n = Math.round(n * gatherBonus);
      if (n > 0) out.push({ id: d.id, n });
    }
    this.depleted = true;
    this.respawnTimer = this.respawnTime;
    return out;
  }

  draw(ctx, cx, cy) {
    const sx = this.x - cx, sy = this.y - cy;
    const alpha = this.depleted ? 0.35 : 1.0;
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(sx, sy, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.depleted ? '#555' : this.col; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    const fs = Math.max(10, Math.min(18, this.r * 0.9));
    ctx.font = `${fs}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.depleted ? '○' : this.icon, sx, sy - 1);
    ctx.globalAlpha = 1;
  }
}
