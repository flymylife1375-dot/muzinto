'use strict';

// ============================================================
// GAME  (main controller)
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // ---- State ----
    this.state    = 'title';   // title | playing | gameover | win
    this.sub      = 'area';    // area | worldmap | inventory | crafting | building | sleeping | confirm
    this.mode     = 'NORMAL';  // NORMAL | HARDCORE

    // ---- Game entities ----
    this.player   = null;
    this.world    = null;

    // ---- Time ----
    this.gameHour  = 8.0;      // current game hour (0-24)
    this.day       = 1;
    this.realMs    = 0;        // total real ms elapsed in game
    this.MS_PER_GH = 37500;    // 37.5 real seconds = 1 game hour

    // ---- Base facilities ----
    this.facilities   = new Set();
    this.exploredTypes = new Set(['base']);

    // ---- Tutorial ----
    this.tutStep = 0;          // 0=show, -1=done
    this.tutPages = [
      '🏝️ 無人島サバイバルへようこそ!\nジョイスティック(左下)で移動します。',
      '🌿 資源に近づいて[採取]ボタンを押すと採集できます。\n木の棒や石、繊維を集めよう!',
      '💧 水分と空腹度が0になるとHPが減り始めます。\nこまめに飲食して生き延びよう!',
      '🔨 [クラフト]ボタンでアイテムを作れます。\nまずはロープと松明を作ってみましょう。',
      '🗺️ [地図]ボタンで島全体を見渡せます。\n新しいエリアへ移動して探索しましょう!',
      '🎯 最終目標: いかだを完成させて次の島へ渡ること。\nがんばって生き残ろう! [OK]で開始',
    ];

    // ---- Notifications ----
    this.notifs = [];   // [{text, timer, color}]

    // ---- Sleep ----
    this.sleepProgress = 0;
    this.sleepTotal    = 0;

    // ---- UI state ----
    this.craftFilter  = 'all'; // all | field | campfire | workbench | facility | ship
    this.inventoryMsg = '';
    this.pendingTravelCell = null;  // {col, row}

    // ---- Score ----
    this.highScore = parseInt(localStorage.getItem('muzinto_hs') || '0');

    // ---- Input ----
    this.joystick = null;
    this.keys     = {};
    this._buttons = [];   // [{x,y,w,h,id,label}]
    this._touches = {};   // trackable right-side touches
    this._rightTouchId = null;
    this._setupInput();

    // ---- Misc ----
    this.gatherHoldTimer = 0;
    this.atkHoldTimer    = 0;
    this.farmTimer = 0;    // passive food from farm
    this.waterTimer = 0;   // passive water from water_collector

    this._last = null;
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  // ============================================================
  // INPUT
  // ============================================================
  _setupInput() {
    this.joystick = new VirtualJoystick(this.canvas);

    window.addEventListener('keydown', e => { this.keys[e.code] = true;  this._onKey(e.code, true); });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    // Tap handling — in area sub-state, joystick owns the left half;
    // in all other states/sub-states (menus, worldmap, title, etc.) process everywhere.
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const areaOnly = this.state === 'playing' && this.sub === 'area';
        if (!areaOnly || t.clientX >= window.innerWidth * 0.52) {
          this._handleTap(t.clientX, t.clientY);
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('click', e => {
      this._handleTap(e.clientX, e.clientY);
    });
  }

  _onKey(code, down) {
    if (!down) return;
    if (code === 'KeyE') this._pressBtn('gather');
    if (code === 'KeyF') this._pressBtn('attack');
    if (code === 'KeyI') this._pressBtn('inventory');
    if (code === 'KeyC') this._pressBtn('craft');
    if (code === 'KeyM') this._pressBtn('map');
    if (code === 'KeyB') this._pressBtn('build');
    if (code === 'Space') this._pressBtn('sleep');
    if (code === 'Escape') this._pressBtn('close');
    if (code === 'Enter') this._pressBtn('confirm_yes');
  }

  _handleTap(mx, my) {
    // Tutorial: any tap advances it
    if (this.state === 'playing' && this.tutStep >= 0) {
      this.tutStep++;
      if (this.tutStep >= this.tutPages.length) this.tutStep = -1;
      return;
    }

    // Check buttons
    for (const btn of this._buttons) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        this._pressBtn(btn.id, btn.data);
        return;
      }
    }

    // World map cell tap
    if (this.state === 'playing' && this.sub === 'worldmap') {
      const cell = this.world.getCellAt(mx, my, this.W, this.H);
      if (cell && WORLD_GRID[cell.row][cell.col]) {
        if (cell.col === this.world.playerCol && cell.row === this.world.playerRow) return;
        if (!this.world.traveling) {
          this.pendingTravelCell = cell;
          this.sub = 'confirm';
        }
      }
    }
  }

  _pressBtn(id, data) {
    if (this.state === 'title') {
      if (id === 'normal')   this._startGame('NORMAL');
      if (id === 'hardcore') this._startGame('HARDCORE');
      return;
    }
    if (this.state === 'gameover' || this.state === 'win') {
      if (id === 'restart') { this.state = 'title'; }
      return;
    }
    if (this.state !== 'playing') return;

    // Tutorial
    if (this.tutStep >= 0) {
      this.tutStep++;
      if (this.tutStep >= this.tutPages.length) this.tutStep = -1;
      return;
    }

    switch (id) {
      case 'map':
        this.sub = (this.sub === 'worldmap') ? 'area' : 'worldmap';
        break;
      case 'inventory':
        this.sub = (this.sub === 'inventory') ? 'area' : 'inventory';
        break;
      case 'craft':
        this.sub = (this.sub === 'crafting') ? 'area' : 'crafting';
        this.craftFilter = 'all';
        break;
      case 'build':
        this.sub = (this.sub === 'building') ? 'area' : 'building';
        this.craftFilter = 'facility';
        break;
      case 'close':
        this.sub = 'area';
        break;
      case 'gather':
        this._tryGather();
        break;
      case 'attack':
        this._tryAttack();
        break;
      case 'sleep':
        this._trySleep();
        break;
      case 'equip':
        if (data !== undefined) {
          this.player.equippedSl = (this.player.equippedSl === data) ? -1 : data;
        }
        break;
      case 'use':
        if (data !== undefined) {
          const slot = this.player.inventory[data];
          if (slot && ITEM_USE[slot.itemId]) {
            this.player.useItem(slot.itemId);
            this._notify(`${ITEMS[slot.itemId].name}を使った`, '#8f8');
          }
        }
        break;
      case 'drop':
        if (data !== undefined) {
          const s = this.player.inventory[data];
          if (s) {
            this.player.removeItem(s.itemId, 1);
            this._notify('捨てた', '#fa8');
          }
        }
        break;
      case 'craft_recipe':
        this._doCraft(data);
        break;
      case 'craft_filter':
        this.craftFilter = data;
        break;
      case 'confirm_yes':
        if (this.sub === 'confirm' && this.pendingTravelCell) {
          const { col, row } = this.pendingTravelCell;
          this.world.startTravel(col, row);
          this.sub = 'worldmap';
          this.pendingTravelCell = null;
        }
        break;
      case 'confirm_no':
        this.sub = this.pendingTravelCell ? 'worldmap' : 'area';
        this.pendingTravelCell = null;
        break;
      case 'launch':
        this._doLaunchRaft();
        break;
    }
  }

  // ============================================================
  // GAME START
  // ============================================================
  _startGame(mode) {
    this.mode = mode;
    this.player = new Player();
    this.player.x = AREA_W / 2;
    this.player.y = AREA_H / 2 + 40;
    this.player.water  = 80;
    this.player.hunger = 80;

    this.world = new WorldMap();
    this.gameHour = 8.0;
    this.day = 1;
    this.realMs = 0;
    this.facilities = new Set();
    this.exploredTypes = new Set(['base']);
    this.notifs = [];
    this.tutStep = 0;
    this.sub = 'area';
    this.farmTimer = 0;
    this.waterTimer = 0;
    this.state = 'playing';

    // Give player starting items
    this.player.addItem('wood_stick', 3);
    this.player.addItem('fiber', 4);
    this.player.addItem('stone', 2);
  }

  // ============================================================
  // MAIN LOOP
  // ============================================================
  _loop(ts) {
    const dt = this._last ? Math.min((ts - this._last) / 1000, 0.1) : 0;
    this._last = ts;
    this._update(dt);
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this.state !== 'playing') return;
    if (this.tutStep >= 0) return;

    // Keyboard joystick
    this.joystick.setFromKeys(this.keys);
    const wantsRun = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    const scene = this.world.currentScene;
    const prevSubWasArea = this.sub === 'area';

    // Travel
    if (this.world.traveling) {
      const arrived = this.world.updateTravel(dt);
      if (arrived) {
        const type = this.world.currentType;
        if (!this.exploredTypes.has(type)) {
          this.exploredTypes.add(type);
          this._notify(`新エリア解禁: ${AREA_CFG[type].name}! 新しいレシピが増えました`, '#0ef');
        }
        this._placePlayerInArea();
        this._notify(`${AREA_CFG[type].name} に到着!`, '#aef');
      }
      // Advance game time during travel
      this._advanceTime(dt);
      return;
    }

    if (this.sub === 'sleeping') {
      this._updateSleep(dt);
      return;
    }

    if (this.sub !== 'area') {
      // Still advance time in menus but no movement
      this._advanceTime(dt);
      return;
    }

    // ----- AREA UPDATE -----
    this._advanceTime(dt);

    const isNight = this._isNight();
    const p = this.player;

    // Player movement
    p.update(dt, this.joystick.dx, this.joystick.dy, wantsRun);

    // Clamp player to area bounds
    p.x = Math.max(p.r, Math.min(AREA_W - p.r, p.x));
    p.y = Math.max(p.r, Math.min(AREA_H - p.r, p.y));

    // Stat decay
    const waterDecay  = 5  / 37.5;  // per real second
    const hungerDecay = 2.5 / 37.5;
    p.water  = Math.max(0, p.water  - waterDecay  * dt);
    p.hunger = Math.max(0, p.hunger - hungerDecay * dt);

    // HP decay from dehydration/starvation
    const noWater  = p.water  <= 0;
    const noHunger = p.hunger <= 0;
    if (noWater && noHunger) p.takeDamage((10 / 37.5) * dt);
    else if (noWater || noHunger) p.takeDamage((5 / 37.5) * dt);

    // Passive facilities at base
    if (this.world.currentType === 'base') {
      if (this.facilities.has('water_collector')) {
        this.waterTimer += dt;
        if (this.waterTimer >= 1) { p.water = Math.min(p.maxWater, p.water + 0.5); this.waterTimer = 0; }
      }
      if (this.facilities.has('farm')) {
        this.farmTimer += dt;
        if (this.farmTimer >= 1) { p.hunger = Math.min(p.maxHunger, p.hunger + 0.3); this.farmTimer = 0; }
      }
    }

    // Gathering progress
    if (p.gathering && p.gatherTarget) {
      p.gatherProgress += dt;
      if (p.gatherProgress >= p.gatherTotal) {
        const drops = p.gatherTarget.harvest(p.gatherBonus);
        let msg = '採集: ';
        for (const d of drops) {
          const ok = p.addItem(d.id, d.n);
          msg += `${ITEMS[d.id].name}×${d.n} `;
          if (!ok) this._notify('所持枠がいっぱい!', '#f80');
        }
        this._notify(msg.trim(), '#8f8');
        p.gathering = false; p.gatherTarget = null; p.gatherProgress = 0;
      }
    }

    // Scene update
    scene.update(dt, p, isNight, this.facilities);

    // Enemy drops
    for (const e of scene.enemies) {
      if (e.dead && !e._dropsGiven) {
        e._dropsGiven = true;
        let msg = '討伐! ';
        for (const d of e.rollDrops()) {
          p.addItem(d.id, d.n);
          msg += `${ITEMS[d.id].name}×${d.n} `;
        }
        this._notify(msg.trim(), '#fa8');
      }
    }

    // Occasional enemy respawn
    scene.respawnEnemies();

    // Death check
    if (p.hp <= 0) {
      this._handleDeath();
      return;
    }

    // Win check (raft_done in inventory)
    if (p.countItem('raft_done') > 0) {
      // Show launch button (handled in render)
    }

    // Tick notifications
    this.notifs = this.notifs.filter(n => { n.timer -= dt; return n.timer > 0; });
  }

  _advanceTime(dt) {
    this.realMs += dt * 1000;
    const prevHour = Math.floor(this.gameHour);
    this.gameHour += (dt * 1000) / this.MS_PER_GH;
    if (this.gameHour >= 24) {
      this.gameHour -= 24;
      this.day++;
      this._notify(`☀️ Day ${this.day} 開始!`, '#ff8');
    }
    const curHour = Math.floor(this.gameHour);
    if (prevHour < 20 && curHour >= 20) this._notify('🌙 夜になった。拠点に戻ろう!', '#88f');
    if (prevHour >= 20 && curHour < 6 && curHour >= 0) {} // night continues
    if (prevHour < 6 && curHour >= 6 || (prevHour >= 20 && curHour < 6)) {
      if (curHour === 6) this._notify('🌅 夜明け!', '#ff8');
    }
  }

  _isNight() { return this.gameHour >= 20 || this.gameHour < 6; }

  _placePlayerInArea() {
    this.player.x = AREA_W / 2 + (Math.random() - 0.5) * 200;
    this.player.y = AREA_H / 2 + (Math.random() - 0.5) * 200;
  }

  _tryGather() {
    const p = this.player;
    const scene = this.world.currentScene;
    if (p.gathering) { p.gathering = false; p.gatherTarget = null; p.gatherProgress = 0; return; }
    const res = scene.getNearbyResource(p.x, p.y, 75);
    if (!res) { this._notify('近くに採集できるものがない', '#fa8'); return; }
    p.gathering = true;
    p.gatherTarget = res;
    p.gatherProgress = 0;
    p.gatherTotal = res.gatherTime * (p.hasAxe() ? 0.6 : 1.0);
    this._notify(`採集中: ${res.label}...`, '#8f8');
  }

  _tryAttack() {
    const p = this.player;
    if (p.atkCooldown > 0) return;
    const scene = this.world.currentScene;
    const enemy = scene.getNearbyEnemy(p.x, p.y, 70);
    if (!enemy) { this._notify('近くに敵がいない', '#fa8'); return; }
    enemy.takeDamage(p.damage);
    p.atkCooldown = 0.6;
    this._notify(`${enemy.name}に ${p.damage} ダメージ!`, '#ffa');
    p.gathering = false; // cancel gather if attacking
  }

  _trySleep() {
    if (this.world.currentType !== 'base') { this._notify('拠点の寝床でしか眠れない', '#fa8'); return; }
    if (!this.facilities.has('bed'))       { this._notify('寝床がない! 拠点でクラフトしよう', '#fa8'); return; }
    // Sleep until 6:00
    let hoursUntilDawn = (6 - this.gameHour + 24) % 24;
    if (hoursUntilDawn < 0.5) hoursUntilDawn = 24;
    this.sleepTotal = hoursUntilDawn * this.MS_PER_GH / 1000 / 8; // fast (8x)
    this.sleepProgress = 0;
    this.sub = 'sleeping';
    this._notify('zzz... 睡眠中...', '#88f');
  }

  _updateSleep(dt) {
    this.sleepProgress += dt;
    const fraction = Math.min(this.sleepProgress / this.sleepTotal, 1);

    // Advance time faster
    const ghDelta = (8 * dt * 1000) / this.MS_PER_GH;
    this.gameHour += ghDelta;
    if (this.gameHour >= 24) { this.gameHour -= 24; this.day++; }

    // HP / Stamina regen while sleeping
    this.player.hp      = Math.min(this.player.maxHp,      this.player.hp + (10 / 37.5) * dt);
    this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 30 * dt);
    // Water/hunger still decrease (slower while sleeping)
    this.player.water  = Math.max(0, this.player.water  - (2.5 / 37.5) * dt);
    this.player.hunger = Math.max(0, this.player.hunger - (1.25/ 37.5) * dt);

    if (fraction >= 1 || this.gameHour >= 6) {
      this.sub = 'area';
      this._notify('🌅 おはよう! HP・スタミナ回復', '#8f8');
    }
  }

  _doCraft(recipeId) {
    const rec = RECIPES.find(r => r.id === recipeId);
    if (!rec) return;
    const p = this.player;

    // Check facility
    const needFac = rec.facility;
    if (needFac && !this.facilities.has(needFac)) {
      this._notify(`${FACILITY_INFO[needFac] ? FACILITY_INFO[needFac].name : needFac}が必要です`, '#f88');
      return;
    }
    // Facility build: must be at base
    if (rec.type === 'facility' && this.world.currentType !== 'base') {
      this._notify('拠点でのみ施設を建てられます', '#f88');
      return;
    }

    if (!p.hasItems(rec.ing)) {
      this._notify('素材が足りない!', '#f88');
      return;
    }
    for (const [id, n] of rec.ing) p.removeItem(id, n);

    if (rec.facilityBuilt) {
      this.facilities.add(rec.facilityBuilt);
      const info = FACILITY_INFO[rec.facilityBuilt];
      this._notify(`${info ? info.icon + info.name : rec.facilityBuilt} を建てた!`, '#ff8');
      if (rec.facilityBuilt === 'storage') {
        p.maxSlots = 12 + 8;
        this._notify('所持枠が20に増えた!', '#8f8');
      }
    }
    if (rec.out) {
      let msg = '作成: ';
      for (const [id, n] of rec.out) {
        const ok = p.addItem(id, n);
        msg += `${ITEMS[id] ? ITEMS[id].name : id}×${n} `;
        if (!ok) {
          this._notify('所持枠がいっぱい! 物置を建てよう', '#f80');
        }
      }
      this._notify(msg.trim(), '#8f8');
    }
  }

  _doLaunchRaft() {
    if (this.player.countItem('raft_done') > 0) {
      this.state = 'win';
    }
  }

  _handleDeath() {
    if (this.mode === 'HARDCORE') {
      this.state = 'gameover';
      if (this.day > this.highScore) {
        this.highScore = this.day;
        localStorage.setItem('muzinto_hs', this.highScore);
      }
    } else {
      // NORMAL: respawn at base, lose inventory
      this.player.inventory = [];
      this.player.equippedSl = -1;
      this.player.hp      = 50;
      this.player.water   = 50;
      this.player.hunger  = 50;
      this.player.stamina = 80;
      this.world.playerCol = BASE_COL;
      this.world.playerRow = BASE_ROW;
      this.world.traveling = false;
      this._placePlayerInArea();
      this.sub = 'area';
      this._notify('💀 死亡... 拠点に復帰(所持品ロスト)', '#f88');
    }
  }

  _notify(text, color = '#fff') {
    this.notifs.unshift({ text, timer: 3.5, color });
    if (this.notifs.length > 6) this.notifs.pop();
  }

  // ============================================================
  // RENDER
  // ============================================================
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this._buttons = [];

    if (this.state === 'title')   { this._drawTitle(); return; }
    if (this.state === 'gameover'){ this._drawGameOver(); return; }
    if (this.state === 'win')     { this._drawWin(); return; }

    // PLAYING
    this._drawArea();
    if (this.sub === 'sleeping') { this._drawSleeping(); return; }
    this._drawHUD();

    if (this.sub === 'worldmap') { this.world.draw(ctx, this.W, this.H, this.gameHour, this.day); this._drawMapCloseBtn(); }
    if (this.sub === 'confirm')  { this._drawConfirm(); }
    if (this.sub === 'inventory'){ this._drawInventory(); }
    if (this.sub === 'crafting' || this.sub === 'building') { this._drawCrafting(); }

    if (this.tutStep >= 0) { this._drawTutorial(); return; }

    this._drawNotifs();
  }

  // ============================================================
  _drawArea() {
    const ctx = this.ctx;
    const p   = this.player;
    const scene = this.world.currentScene;
    const isNight = this._isNight();

    // Camera center on player
    const camX = p.x - this.W / 2;
    const camY = p.y - this.H / 2;

    scene.drawAll(ctx, camX, camY, this.W, this.H, isNight, this.facilities);
    p.draw(ctx, camX, camY);

    if (isNight) scene.drawNightVignette(ctx, p.x, p.y, camX, camY, this.W, this.H, p.hasTorch());

    // Gathering progress bar
    if (p.gathering && p.gatherTarget) {
      const frac = p.gatherProgress / p.gatherTotal;
      const bw = 160, bh = 16;
      const bx = (this.W - bw) / 2, by = this.H * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, bw + 8, bh + 8, 6); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#4d4';
      ctx.fillRect(bx, by, bw * frac, bh);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('採集中...', bx + bw / 2, by + bh / 2);
    }

    // Raft launch button if raft complete at base (placed right-of-center so it's tap-reachable)
    if (this.player.countItem('raft_done') > 0 && this.world.currentType === 'base') {
      this._drawBtn('launch', this.W * 0.52, this.H * 0.38, 180, 44, '⛵ 出発する!', '#2060c0', '#ffe');
    }
  }

  _drawHUD() {
    const ctx = this.ctx;
    const p   = this.player;
    const isNight = this._isNight();

    // Top bar bg
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, 64);

    // Stats
    const bars = [
      { label: 'HP',   val: p.hp,      max: p.maxHp,     col: '#e04040', bg: '#500' },
      { label: '水',   val: p.water,   max: p.maxWater,  col: '#4080ff', bg: '#005' },
      { label: '食',   val: p.hunger,  max: p.maxHunger, col: '#e0a020', bg: '#420' },
    ];
    const barW = Math.min(130, (this.W - 260) / 3);
    bars.forEach((b, i) => {
      const bx = 10 + i * (barW + 6);
      const by = 8;
      ctx.fillStyle = b.bg; ctx.fillRect(bx, by, barW, 14);
      ctx.fillStyle = b.col; ctx.fillRect(bx, by, barW * (b.val / b.max), 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, barW, 14);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${b.label} ${Math.floor(b.val)}`, bx + 3, by + 7);

      // Stamina
      const sx = bx, sy = by + 19;
      if (i === 0) {
        ctx.fillStyle = '#333'; ctx.fillRect(bx, sy, barW * 3 + 12, 10);
        ctx.fillStyle = p.exhausted ? '#888' : '#a0d0ff';
        ctx.fillRect(bx, sy, (barW * 3 + 12) * (p.stamina / p.maxStamina), 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
        ctx.strokeRect(bx, sy, barW * 3 + 12, 10);
        ctx.font = '9px sans-serif'; ctx.fillStyle = '#cdf'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`スタミナ${p.exhausted ? '(疲弊)' : ''}`, bx + 3, sy + 5);
      }
    });

    // Time display (top right)
    const h  = Math.floor(this.gameHour);
    const m  = Math.floor((this.gameHour % 1) * 60);
    const ph = isNight ? '🌙夜' : (this.gameHour < 11 ? '🌅朝' : this.gameHour < 17 ? '☀️昼' : '🌆晩');
    const timeStr = `Day ${this.day}  ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}  ${ph}`;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = isNight ? '#aad' : '#ffe';
    ctx.fillText(timeStr, this.W - 10, 20);

    // Current area
    const aType = this.world.currentType;
    const aName = AREA_CFG[aType] ? AREA_CFG[aType].name : '?';
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#ccc';
    ctx.fillText(`📍${aName}`, this.W - 10, 40);

    // Equipped item
    const eq = p.equipped;
    if (eq) {
      const def = ITEMS[eq.itemId];
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffd';
      ctx.font = '11px sans-serif';
      ctx.fillText(`🖐 ${def ? def.icon + def.name : eq.itemId}`, this.W - 10, 56);
    }

    // Stamina exhaustion flash
    if (p.exhausted) {
      ctx.fillStyle = 'rgba(255,50,50,0.15)';
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Bottom right action buttons
    const btnR = 54, gap = 8;
    const bx0 = this.W - btnR - 12;
    const by0 = this.H - btnR - 12;
    const btns = [
      { id: 'map',       icon: '🗺️',  dy: -(btnR+gap)*3 },
      { id: 'inventory', icon: '🎒',  dy: -(btnR+gap)*2 },
      { id: 'craft',     icon: '🔨',  dy: -(btnR+gap)*1 },
      { id: 'gather',    icon: '🌿',  dy: 0, dx: -(btnR+gap) },
      { id: 'attack',    icon: '⚔️',   dy: 0, dx: 0 },
    ];
    for (const b of btns) {
      const bx = bx0 + (b.dx || 0);
      const by = by0 + b.dy;
      this._drawCircleBtn(b.id, bx, by, btnR / 2, b.icon);
    }

    // Sleep & Build at base
    if (this.world.currentType === 'base') {
      this._drawCircleBtn('sleep', bx0 - (btnR+gap) * 2, by0 - (btnR+gap)*0, btnR/2, '💤');
      this._drawCircleBtn('build', bx0 - (btnR+gap) * 1, by0 - (btnR+gap)*1, btnR/2, '🏗️');
    }

    // Joystick
    this.joystick.draw(ctx);

    // Near-resource indicator
    const scene = this.world.currentScene;
    const nearRes = scene.getNearbyResource(p.x, p.y, 75);
    if (nearRes) {
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#8f8';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`[E] ${nearRes.label}`, this.W / 2, this.H - 30);
    }
    const nearEn = scene.getNearbyEnemy(p.x, p.y, 70);
    if (nearEn && !nearEn.dead) {
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#f88';
      ctx.textAlign = 'center';
      ctx.fillText(`[F] ${nearEn.name} HP:${nearEn.hp}/${nearEn.maxHp}`, this.W / 2, this.H - 14);
    }
  }

  _drawCircleBtn(id, cx, cy, r, icon) {
    const ctx = this.ctx;
    const active = (this.sub !== 'area' && (id === 'map' || id === 'inventory' || id === 'craft' || id === 'build') &&
                    ((id === 'map' && this.sub === 'worldmap') ||
                     (id === 'inventory' && this.sub === 'inventory') ||
                     ((id === 'craft' || id === 'build') && (this.sub === 'crafting' || this.sub === 'building'))));
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? 'rgba(100,160,255,0.7)' : 'rgba(20,20,40,0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `${Math.floor(r * 0.85)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy - 1);
    this._buttons.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, id });
  }

  _drawBtn(id, x, y, w, h, label, bg = '#204060', fg = '#fff', data) {
    const ctx = this.ctx;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `bold ${Math.min(14, Math.floor(h * 0.4))}px sans-serif`;
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    this._buttons.push({ x, y, w, h, id, data });
  }

  _drawMapCloseBtn() {
    this._drawBtn('close', this.W - 60, 10, 48, 34, '✕', 'rgba(80,20,20,0.9)', '#faa');
  }

  // ============================================================
  _drawInventory() {
    const ctx = this.ctx;
    const p   = this.player;
    const W = Math.min(this.W - 30, 420), H = Math.min(this.H - 120, 500);
    const ox = (this.W - W) / 2, oy = (this.H - H) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath(); ctx.roundRect(ox, oy, W, H, 10); ctx.fill();
    ctx.strokeStyle = '#4a4a7a'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#dde';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`🎒 所持品 (${p.inventory.length}/${p.maxSlots})`, this.W / 2, oy + 22);

    const cols = 4, pad = 10;
    const cellW = (W - pad * 2 - (cols - 1) * 6) / cols;
    const cellH = cellW;
    let ix = ox + pad, iy = oy + 45;

    p.inventory.forEach((slot, i) => {
      const def = ITEMS[slot.itemId];
      if (!def) return;
      const sx = ix + (i % cols) * (cellW + 6);
      const sy = iy + Math.floor(i / cols) * (cellH + 6);
      if (sy + cellH > oy + H - 10) return;

      const isEq = i === p.equippedSl;
      ctx.fillStyle = isEq ? 'rgba(100,140,255,0.4)' : 'rgba(30,30,50,0.7)';
      ctx.beginPath(); ctx.roundRect(sx, sy, cellW, cellH, 5); ctx.fill();
      ctx.strokeStyle = isEq ? '#80a0ff' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.font = `${Math.floor(cellW * 0.38)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, sx + cellW / 2, sy + cellH * 0.4);
      ctx.font = `${Math.floor(cellW * 0.18)}px sans-serif`; ctx.fillStyle = '#ddd';
      ctx.fillText(def.name, sx + cellW / 2, sy + cellH * 0.72);
      if (def.stackable) {
        ctx.font = `bold ${Math.floor(cellW * 0.22)}px sans-serif`; ctx.fillStyle = '#ff8';
        ctx.textAlign = 'right';
        ctx.fillText(`×${slot.count}`, sx + cellW - 4, sy + cellH - 5);
      }

      // Buttons (equip, use, drop) in tiny form
      const btnH = 18, btnW = (cellW - 4) / 3;
      const bby  = sy + cellH + 2;
      if (bby + btnH < oy + H - 10) {
        if (def.isTool) {
          this._drawBtn('equip', sx, bby, cellW, btnH, isEq ? '★装備中' : '装備', isEq ? '#405090' : '#304060', '#adf', i);
        } else if (ITEM_USE[slot.itemId]) {
          this._drawBtn('use',  sx, bby, cellW, btnH, '使う', '#304030', '#afc', i);
        }
      }
    });

    this._drawBtn('close', ox + W - 56, oy + 6, 48, 28, '✕ 閉じる', 'rgba(80,20,20,0.8)', '#faa');
  }

  // ============================================================
  _drawCrafting() {
    const ctx = this.ctx;
    const p   = this.player;
    const W = Math.min(this.W - 20, 440), H = Math.min(this.H - 80, 580);
    const ox = (this.W - W) / 2, oy = (this.H - H) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.90)';
    ctx.beginPath(); ctx.roundRect(ox, oy, W, H, 10); ctx.fill();
    ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.5; ctx.stroke();

    const isBuilding = this.sub === 'building';
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ddd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isBuilding ? '🏗️ 施設建設' : '🔨 クラフト', this.W / 2, oy + 22);

    // Filter tabs
    const filters = isBuilding
      ? [{ id: 'facility', label: '施設' }, { id: 'ship', label: '造船' }]
      : [{ id: 'all', label: 'すべて' }, { id: 'field', label: 'フィールド' }, { id: 'campfire', label: 'たき火' }, { id: 'workbench', label: '作業台' }];
    const tabW = (W - 20) / filters.length;
    filters.forEach((f, i) => {
      const active = this.craftFilter === f.id;
      const tx = ox + 10 + i * tabW;
      const ty = oy + 38;
      this._drawBtn('craft_filter', tx, ty, tabW - 4, 22, f.label,
        active ? '#304080' : 'rgba(30,30,50,0.8)', active ? '#adf' : '#888', f.id);
    });

    // Recipe list
    const isBase = this.world.currentType === 'base';
    let visibleRecipes = RECIPES.filter(r => {
      if (isBuilding) {
        if (this.craftFilter === 'facility' && r.type !== 'facility') return false;
        if (this.craftFilter === 'ship'     && r.type !== 'ship')     return false;
        if (this.craftFilter === 'all' && r.type !== 'facility' && r.type !== 'ship') return false;
      } else {
        if (this.craftFilter === 'field'     && r.type !== 'field')     return false;
        if (this.craftFilter === 'campfire'  && r.type !== 'campfire')  return false;
        if (this.craftFilter === 'workbench' && r.type !== 'workbench') return false;
        if (r.type === 'facility' || r.type === 'ship') return false;
      }
      // unlock check
      if (r.unlockType && !this.exploredTypes.has(r.unlockType)) return false;
      // already built
      if (r.facilityBuilt && this.facilities.has(r.facilityBuilt)) return false;
      return true;
    });

    const ry0 = oy + 68, rh = 72, pad = 8;
    let ri = 0;
    for (const rec of visibleRecipes) {
      const ry = ry0 + ri * (rh + 4);
      if (ry + rh > oy + H - 50) break;
      const canCraft = p.hasItems(rec.ing) &&
        (!rec.facility || this.facilities.has(rec.facility)) &&
        (rec.type !== 'facility' || isBase);

      ctx.fillStyle = canCraft ? 'rgba(20,50,20,0.7)' : 'rgba(40,30,30,0.6)';
      ctx.beginPath(); ctx.roundRect(ox + pad, ry, W - pad * 2, rh, 5); ctx.fill();
      ctx.strokeStyle = canCraft ? 'rgba(80,200,80,0.4)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1; ctx.stroke();

      // Recipe name
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = canCraft ? '#8f8' : '#888';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(rec.label, ox + pad + 8, ry + 6);

      // Ingredients
      let ingX = ox + pad + 8;
      const ingY = ry + 24;
      for (const [id, n] of rec.ing) {
        const def = ITEMS[id];
        const have = p.countItem(id);
        const ok   = have >= n;
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ok ? '#8f8' : '#f88';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${def ? def.icon : '?'}${def ? def.name : id}×${n}(${have})`, ingX, ingY);
        ingX += ctx.measureText(`${def ? def.icon : '?'}${def ? def.name : id}×${n}(${have})`).width + 8;
      }

      // Facility needed
      if (rec.facility) {
        const fi = FACILITY_INFO[rec.facility];
        ctx.font = '10px sans-serif'; ctx.fillStyle = this.facilities.has(rec.facility) ? '#8cf' : '#f88';
        ctx.fillText(`⚙️要: ${fi ? fi.name : rec.facility}`, ox + pad + 8, ingY + 16);
      }

      // Craft button
      if (canCraft) {
        this._drawBtn('craft_recipe', ox + W - pad - 72, ry + (rh - 28) / 2, 70, 28, '作る', '#204040', '#aff', rec.id);
      }
      ri++;
    }
    if (visibleRecipes.length === 0) {
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#666';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('利用可能なレシピなし', this.W / 2, oy + H * 0.5);
    }

    this._drawBtn('close', ox + W - 56, oy + 6, 48, 28, '✕ 閉じる', 'rgba(80,20,20,0.8)', '#faa');
  }

  // ============================================================
  _drawConfirm() {
    const ctx = this.ctx;
    const cell = this.pendingTravelCell;
    if (!cell) return;
    const type = WORLD_GRID[cell.row][cell.col];
    const cfg  = AREA_CFG[type];
    const tSec = this.world.travelTimeSec(this.world.playerCol, this.world.playerRow, cell.col, cell.row);
    const rev  = this.world.revealed[cell.row][cell.col];

    const W = 320, H = 140;
    const ox = (this.W - W) / 2, oy = (this.H - H) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.beginPath(); ctx.roundRect(ox, oy, W, H, 10); ctx.fill();
    ctx.strokeStyle = '#6060a0'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#dde';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${cfg ? cfg.icon : '?'} ${cfg ? cfg.name : '???'} へ移動しますか?`, this.W / 2, oy + 26);

    ctx.font = '12px sans-serif'; ctx.fillStyle = '#aaa';
    const danger = cfg ? ['低','低','中','高','危険'][cfg.dangerLv] || '?' : '?';
    ctx.fillText(`移動時間: 約${Math.ceil(tSec)}秒  危険度: ${danger}`, this.W / 2, oy + 48);
    if (!rev) {
      ctx.fillStyle = '#fa8';
      ctx.fillText('⚠️ 未探索エリア', this.W / 2, oy + 66);
    }

    this._drawBtn('confirm_yes', ox + 20,       oy + H - 50, 120, 36, '✓ 移動する', '#204060', '#adf');
    this._drawBtn('confirm_no',  ox + W - 140,  oy + H - 50, 120, 36, '✕ やめる',  '#602020', '#faa');
  }

  // ============================================================
  _drawSleeping() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,20,0.85)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🌙', this.W / 2, this.H / 2 - 30);
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#88a';
    ctx.fillText('睡眠中... zzz', this.W / 2, this.H / 2 + 20);
    const bw = 200;
    const bx = (this.W - bw) / 2, by = this.H / 2 + 55;
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(bx, by, bw * Math.min(this.sleepProgress / this.sleepTotal, 1), 12);
  }

  // ============================================================
  _drawTitle() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(0, 0, this.W, this.H);

    // stars
    for (let i = 0; i < 80; i++) {
      const x = (i * 197 + 31) % this.W;
      const y = (i * 137 + 53) % this.H;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.1})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // island silhouette
    ctx.fillStyle = '#1a4a1a';
    ctx.beginPath();
    ctx.ellipse(this.W / 2, this.H * 0.7, this.W * 0.38, this.H * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = '#f0d080';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏝️ 無人島サバイバル', this.W / 2, this.H * 0.22);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#8aaa8a';
    ctx.fillText('探索・採集・クラフトで生き延びろ!', this.W / 2, this.H * 0.30);
    ctx.fillText('いかだを完成させ、次の島へ渡ることを目指せ', this.W / 2, this.H * 0.35);

    const bw = 220, bh = 50;
    this._drawBtn('normal',   this.W / 2 - bw / 2, this.H * 0.46, bw, bh, '🎮 NORMAL モード',   '#204060', '#adf');
    this._drawBtn('hardcore', this.W / 2 - bw / 2, this.H * 0.56, bw, bh, '💀 HARDCORE モード', '#602020', '#faa');

    ctx.font = '12px sans-serif'; ctx.fillStyle = '#557';
    ctx.fillText('NORMAL: 死亡後も拠点に復帰して続行', this.W / 2, this.H * 0.68);
    ctx.fillText('HARDCORE: 死亡でゲームオーバー / ランキング記録', this.W / 2, this.H * 0.72);
    if (this.highScore > 0) {
      ctx.fillStyle = '#880'; ctx.font = '13px sans-serif';
      ctx.fillText(`🏆 最高記録: Day ${this.highScore}`, this.W / 2, this.H * 0.80);
    }

    ctx.font = '10px sans-serif'; ctx.fillStyle = '#446';
    ctx.fillText('移動:ジョイスティック/WASDキー  採集:E  攻撃:F  地図:M  クラフト:C  所持:I  走る:Shift', this.W / 2, this.H * 0.90);
  }

  _drawGameOver() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0008';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💀', this.W / 2, this.H * 0.28);
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#e04040';
    ctx.fillText('ゲームオーバー', this.W / 2, this.H * 0.40);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#c0a060';
    ctx.fillText(`${this.day} 日間生き残った`, this.W / 2, this.H * 0.50);
    if (this.day >= this.highScore) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🏆 新記録!', this.W / 2, this.H * 0.58);
    }
    this._drawBtn('restart', this.W / 2 - 100, this.H * 0.68, 200, 48, '▶ タイトルへ', '#203050', '#adf');
  }

  _drawWin() {
    const ctx = this.ctx;
    ctx.fillStyle = '#001820';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.font = '60px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛵', this.W / 2, this.H * 0.25);
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#40e0d0';
    ctx.fillText('脱出成功!!', this.W / 2, this.H * 0.42);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#f0d080';
    ctx.fillText(`${this.day} 日でいかだを完成させた!`, this.W / 2, this.H * 0.52);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#80b080';
    ctx.fillText('次の島でまた新たな冒険が始まる...', this.W / 2, this.H * 0.62);
    this._drawBtn('restart', this.W / 2 - 100, this.H * 0.72, 200, 48, '▶ タイトルへ', '#203050', '#adf');
  }

  _drawTutorial() {
    const ctx  = this.ctx;
    const page = this.tutPages[this.tutStep] || '';
    const W = Math.min(this.W - 40, 380), H = 180;
    const ox = (this.W - W) / 2, oy = this.H * 0.35;

    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath(); ctx.roundRect(ox, oy, W, H, 12); ctx.fill();
    ctx.strokeStyle = '#5060a0'; ctx.lineWidth = 2; ctx.stroke();

    ctx.font = '12px sans-serif'; ctx.fillStyle = '#889';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(`${this.tutStep + 1}/${this.tutPages.length}`, ox + W - 10, oy + 10);

    ctx.font = '14px sans-serif'; ctx.fillStyle = '#dde';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lines = page.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, this.W / 2, oy + 20 + i * 22));

    const isLast = this.tutStep >= this.tutPages.length - 1;
    this._drawBtn('dummy_tut', ox + W/2 - 70, oy + H - 44, 140, 34,
      isLast ? '✓ 開始する!' : '次へ →', '#204060', '#adf');
  }

  _drawNotifs() {
    const ctx = this.ctx;
    const x = 12, startY = 75;
    this.notifs.forEach((n, i) => {
      const alpha = Math.min(1, n.timer / 0.5) * Math.min(1, (n.timer - 0) * 2);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '12px sans-serif'; ctx.fillStyle = n.color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const maxW = Math.min(300, this.W - 24);
      ctx.fillText(n.text.slice(0, 48), x, startY + i * 18);
      ctx.globalAlpha = 1;
    });
  }
}
