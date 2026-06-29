'use strict';

// ============================================================
// ITEMS
// ============================================================
const ITEMS = {
  // 素材
  wood_stick:   { name: '木の棒',       icon: '🌿', stackable: true,  maxStack: 20 },
  wood_log:     { name: '木材',         icon: '🌲', stackable: true,  maxStack: 10 },
  stone:        { name: '石',           icon: '🪨', stackable: true,  maxStack: 20 },
  fiber:        { name: '繊維',         icon: '🌾', stackable: true,  maxStack: 20 },
  vine:         { name: '蔓',           icon: '🌱', stackable: true,  maxStack: 15 },
  driftwood:    { name: '流木',         icon: '🪵', stackable: true,  maxStack: 10 },
  shellfish:    { name: '貝殻',         icon: '🐚', stackable: true,  maxStack: 20 },
  salt:         { name: '塩',           icon: '🧂', stackable: true,  maxStack: 20 },
  clay:         { name: '粘土',         icon: '🧱', stackable: true,  maxStack: 15 },
  iron_ore:     { name: '鉄鉱石',       icon: '🪨', stackable: true,  maxStack: 10 },
  rare_ore:     { name: 'レア鉱石',     icon: '💎', stackable: true,  maxStack: 5  },
  fruit:        { name: '果実',         icon: '🍎', stackable: true,  maxStack: 10 },
  mushroom:     { name: 'きのこ',       icon: '🍄', stackable: true,  maxStack: 10 },
  raw_meat:     { name: '生肉',         icon: '🥩', stackable: true,  maxStack: 5  },
  animal_hide:  { name: '動物の皮',     icon: '🦴', stackable: true,  maxStack: 5  },
  // 加工品
  rope:         { name: 'ロープ',       icon: '🪢', stackable: true,  maxStack: 10 },
  tough_cloth:  { name: '丈夫な布',     icon: '🧶', stackable: true,  maxStack: 5  },
  iron_ingot:   { name: '鉄インゴット', icon: '⚙️',  stackable: true,  maxStack: 5  },
  iron_nail:    { name: '鉄釘',         icon: '📌', stackable: true,  maxStack: 20 },
  iron_plate:   { name: '補強板',       icon: '🔩', stackable: true,  maxStack: 5  },
  // 食料・飲料
  cooked_meat:  { name: '調理済み肉',   icon: '🍖', stackable: true,  maxStack: 5  },
  cooked_mush:  { name: '焼ききのこ',   icon: '🍽️',  stackable: true,  maxStack: 5  },
  water_jar:    { name: '飲料水',       icon: '🫙', stackable: true,  maxStack: 5  },
  // 道具・武器
  torch:        { name: '松明',         icon: '🔦', stackable: true,  maxStack: 5,  isTool: true, lightBonus: 1 },
  bandage:      { name: '包帯',         icon: '🩹', stackable: true,  maxStack: 5  },
  stick_weapon: { name: '棒',           icon: '🥢', stackable: false, maxStack: 1,  isTool: true, isWeapon: true, damage: 5  },
  stone_axe:    { name: '石の斧',       icon: '🪓', stackable: false, maxStack: 1,  isTool: true, isWeapon: true, isAxe: true, damage: 12, gatherBonus: 1.5 },
  iron_axe:     { name: '鉄の斧',       icon: '⚔️',  stackable: false, maxStack: 1,  isTool: true, isWeapon: true, isAxe: true, damage: 25, gatherBonus: 2.0 },
  spear:        { name: '槍',           icon: '🗡️',  stackable: false, maxStack: 1,  isTool: true, isWeapon: true, damage: 18 },
  // 船部品
  raft_base:    { name: 'いかだ(基本)', icon: '🛶', stackable: false, maxStack: 1  },
  sail:         { name: '帆',           icon: '⛵', stackable: false, maxStack: 1  },
  raft_strong:  { name: 'いかだ(強化)', icon: '🚤', stackable: false, maxStack: 1  },
  raft_done:    { name: '完成したいかだ',icon: '⛵', stackable: false, maxStack: 1  },
};

// アイテム使用効果
const ITEM_USE = {
  fruit:       { water: 15, hunger: 20 },
  mushroom:    { water: 5,  hunger: 15 },
  raw_meat:    { hunger: 10, hp: -5 },
  cooked_meat: { hunger: 40, hp: 5  },
  cooked_mush: { hunger: 20 },
  water_jar:   { water: 40 },
  bandage:     { hp: 25 },
};

// ============================================================
// RECIPES
// ============================================================
const RECIPES = [
  // フィールドクラフト
  { id: 'rope',         label: 'ロープ',       type: 'field',     ing: [['vine',3]],                                out: [['rope',2]],         facility: null,        unlockType: null   },
  { id: 'torch',        label: '松明',         type: 'field',     ing: [['wood_stick',1],['fiber',2]],              out: [['torch',2]],        facility: null,        unlockType: null   },
  { id: 'bandage',      label: '包帯',         type: 'field',     ing: [['fiber',3]],                               out: [['bandage',2]],      facility: null,        unlockType: null   },
  { id: 'stick_weapon', label: '棒',           type: 'field',     ing: [['wood_stick',2]],                          out: [['stick_weapon',1]], facility: null,        unlockType: null   },
  { id: 'fiber_vine',   label: '繊維(蔓から)', type: 'field',     ing: [['vine',1]],                                out: [['fiber',3]],        facility: null,        unlockType: null   },
  // たき火
  { id: 'cook_meat',    label: '肉を焼く',     type: 'campfire',  ing: [['raw_meat',1]],                            out: [['cooked_meat',1]],  facility: 'campfire',  unlockType: null   },
  { id: 'cook_mush',    label: 'きのこを焼く', type: 'campfire',  ing: [['mushroom',1]],                            out: [['cooked_mush',1]],  facility: 'campfire',  unlockType: null   },
  { id: 'make_water',   label: '飲料水を作る', type: 'campfire',  ing: [['shellfish',1]],                           out: [['water_jar',1]],    facility: 'campfire',  unlockType: 'coast'},
  { id: 'smelt_iron',   label: '鉄を精錬する', type: 'campfire',  ing: [['iron_ore',3]],                            out: [['iron_ingot',1]],   facility: 'campfire',  unlockType: 'cave' },
  // 作業台
  { id: 'stone_axe',   label: '石の斧',       type: 'workbench', ing: [['stone',3],['wood_stick',2],['vine',1]],   out: [['stone_axe',1]],    facility: 'workbench', unlockType: 'rocky'},
  { id: 'iron_axe',    label: '鉄の斧',       type: 'workbench', ing: [['iron_ingot',3],['wood_stick',2]],         out: [['iron_axe',1]],     facility: 'workbench', unlockType: 'cave' },
  { id: 'spear',       label: '槍',           type: 'workbench', ing: [['wood_log',2],['iron_ingot',1]],           out: [['spear',1]],        facility: 'workbench', unlockType: 'cave' },
  { id: 'iron_nail',   label: '鉄釘',         type: 'workbench', ing: [['iron_ingot',1]],                          out: [['iron_nail',5]],    facility: 'workbench', unlockType: 'cave' },
  { id: 'iron_plate',  label: '補強板',       type: 'workbench', ing: [['iron_ingot',3]],                          out: [['iron_plate',1]],   facility: 'workbench', unlockType: 'cave' },
  { id: 'tough_cloth', label: '丈夫な布',     type: 'workbench', ing: [['animal_hide',2],['fiber',5]],             out: [['tough_cloth',2]],  facility: 'workbench', unlockType: 'forest'},
  // 施設建設
  { id: 'build_fire',  label: 'たき火を建てる',       type: 'facility', ing: [['stone',5],['wood_stick',3]],                            facilityBuilt: 'campfire',       unlockType: null   },
  { id: 'build_water', label: '水だめを建てる',       type: 'facility', ing: [['wood_log',3],['stone',5],['clay',3]],                   facilityBuilt: 'water_collector',unlockType: 'coast'},
  { id: 'build_bed',   label: '寝床を作る',          type: 'facility', ing: [['wood_log',4],['fiber',8]],                              facilityBuilt: 'bed',            unlockType: 'forest'},
  { id: 'build_store', label: '物置を建てる',         type: 'facility', ing: [['wood_log',6],['vine',4]],                               facilityBuilt: 'storage',        unlockType: 'forest'},
  { id: 'build_bench', label: '作業台を建てる',       type: 'facility', ing: [['wood_log',8],['stone',4],['vine',3]],                   facilityBuilt: 'workbench',      unlockType: 'rocky'},
  { id: 'build_fence', label: '柵・見張り台を建てる', type: 'facility', ing: [['wood_log',12],['vine',6],['stone',4]],                  facilityBuilt: 'fence',          facility: 'workbench', unlockType: 'forest'},
  { id: 'build_farm',  label: '畑/いけすを建てる',    type: 'facility', ing: [['wood_log',6],['clay',5],['stone',4]],                   facilityBuilt: 'farm',           facility: 'workbench', unlockType: 'coast'},
  { id: 'build_dock',  label: 'いかだ台を建てる',     type: 'facility', ing: [['wood_log',10],['driftwood',5],['stone',6]],             facilityBuilt: 'raft_dock',      facility: 'workbench', unlockType: 'coast'},
  // 造船
  { id: 'raft_base',   label: 'いかだ(基本)を作る',   type: 'ship',     ing: [['driftwood',15],['rope',8]],                             out: [['raft_base',1]],    facility: 'raft_dock', unlockType: 'coast'},
  { id: 'sail_build',  label: '帆を作る',            type: 'ship',     ing: [['tough_cloth',4],['wood_log',3]],                        out: [['sail',1]],         facility: 'workbench', unlockType: 'deep' },
  { id: 'raft_strong', label: 'いかだを強化する',     type: 'ship',     ing: [['raft_base',1],['iron_plate',5],['iron_nail',20]],       out: [['raft_strong',1]],  facility: 'raft_dock', unlockType: 'cave' },
  { id: 'raft_done',   label: '完成したいかだを作る', type: 'ship',     ing: [['raft_strong',1],['sail',1],['rare_ore',2]],             out: [['raft_done',1]],    facility: 'raft_dock', unlockType: 'deep' },
];

// ============================================================
// WORLD GRID  (null = 海、impassable)
// ============================================================
//     col:  0         1        2       3        4
const WORLD_GRID = [
  [null,     null,    'coast',  null,    null   ],  // row 0
  [null,    'forest', 'forest','coast',  null   ],  // row 1
  ['rocky', 'forest', 'base',  'forest','coast' ],  // row 2  ← 拠点(2,2)
  [null,    'cave',   'forest','rocky',  null   ],  // row 3
  [null,    'deep',   'deep',  'deep',   null   ],  // row 4
];
const BASE_COL = 2, BASE_ROW = 2;

// ============================================================
// AREA CONFIGS
// ============================================================
const AREA_CFG = {
  base:   { name: '拠点',       icon: '🏕️', color: '#3a6a3a', dangerLv: 0, resources: ['wood_stick_node','fiber_node','stone_node'],                            enemies: []                         },
  forest: { name: '森',         icon: '🌲', color: '#145014', dangerLv: 1, resources: ['tree_node','vine_node','fiber_node','fruit_node','mushroom_node'],        enemies: ['wild_boar','wolf']        },
  coast:  { name: '海岸',       icon: '🏖️', color: '#a08820', dangerLv: 1, resources: ['driftwood_node','shellfish_node','salt_node'],                           enemies: ['crab']                   },
  rocky:  { name: '岩場',       icon: '⛰️', color: '#505050', dangerLv: 2, resources: ['stone_node','clay_node','iron_ore_node'],                                enemies: ['wolf']                   },
  cave:   { name: '洞窟',       icon: '🕳️', color: '#201020', dangerLv: 3, resources: ['stone_node','iron_ore_node','clay_node'],                                enemies: ['wolf','cave_bear']        },
  deep:   { name: '奥地(危険)', icon: '☠️', color: '#2a0050', dangerLv: 4, resources: ['rare_ore_node','animal_hide_node'],                                      enemies: ['tiger','cave_bear']       },
};

// ============================================================
// RESOURCE NODES
// ============================================================
const RES_NODE = {
  wood_stick_node: { label: '木の枝', icon: '🌿', col: '#8B6530', r: 16, drops: [{ id: 'wood_stick', min:2, max:4 }], gatherTime: 1.5, respawn: 60  },
  fiber_node:      { label: '草むら', icon: '🌾', col: '#5a9a3a', r: 14, drops: [{ id: 'fiber',      min:3, max:6 }], gatherTime: 1.0, respawn: 45  },
  stone_node:      { label: '岩',     icon: '🪨', col: '#808080', r: 22, drops: [{ id: 'stone',      min:2, max:4 }], gatherTime: 2.0, respawn: 120 },
  tree_node:       { label: '木',     icon: '🌲', col: '#1a8020', r: 28, drops: [{ id: 'wood_log',   min:1, max:3 }, { id: 'wood_stick', min:1, max:2 }], gatherTime: 3.0, respawn: 180 },
  vine_node:       { label: '蔓植物', icon: '🌱', col: '#2acd2a', r: 14, drops: [{ id: 'vine',       min:2, max:4 }, { id: 'fiber',      min:1, max:2 }], gatherTime: 1.5, respawn: 60  },
  fruit_node:      { label: '果樹',   icon: '🍎', col: '#cc3030', r: 20, drops: [{ id: 'fruit',      min:1, max:3 }], gatherTime: 1.0, respawn: 90  },
  mushroom_node:   { label: 'きのこ', icon: '🍄', col: '#9a6a2a', r: 12, drops: [{ id: 'mushroom',   min:1, max:2 }], gatherTime: 0.8, respawn: 60  },
  driftwood_node:  { label: '流木',   icon: '🪵', col: '#8B6914', r: 22, drops: [{ id: 'driftwood',  min:2, max:4 }], gatherTime: 2.0, respawn: 120 },
  shellfish_node:  { label: '貝',     icon: '🐚', col: '#d4a47a', r: 14, drops: [{ id: 'shellfish',  min:2, max:5 }], gatherTime: 1.0, respawn: 45  },
  salt_node:       { label: '塩地',   icon: '🧂', col: '#e0e0d0', r: 16, drops: [{ id: 'salt',       min:2, max:4 }], gatherTime: 1.5, respawn: 90  },
  clay_node:       { label: '粘土',   icon: '🟤', col: '#CD853F', r: 18, drops: [{ id: 'clay',       min:2, max:4 }], gatherTime: 2.0, respawn: 90  },
  iron_ore_node:   { label: '鉄鉱石', icon: '⚒️',  col: '#708090', r: 20, drops: [{ id: 'iron_ore',  min:1, max:3 }], gatherTime: 3.5, respawn: 180 },
  rare_ore_node:   { label: 'レア鉱石',icon: '💎', col: '#9400D3', r: 22, drops: [{ id: 'rare_ore',  min:1, max:2 }], gatherTime: 5.0, respawn: 300 },
  animal_hide_node:{ label: '獣の痕跡',icon: '🦴', col: '#8B0000', r: 18, drops: [{ id: 'animal_hide',min:1, max:2}], gatherTime: 2.0, respawn: 180 },
};

// ============================================================
// ENEMIES
// ============================================================
const ENEMY_DEF = {
  wild_boar: { name: 'イノシシ', icon: '🐗', col: '#7B4513', maxHp:  30, dmg: 8,  spd:  90, alert: 160, atkR: 50, atkCd: 1.5, drops: [{ id:'raw_meat',  min:1,max:2 }]                                           },
  crab:      { name: 'カニ',     icon: '🦀', col: '#FF4500', maxHp:  15, dmg: 4,  spd:  60, alert: 100, atkR: 50, atkCd: 1.2, drops: [{ id:'shellfish', min:1,max:2 }]                                           },
  wolf:      { name: 'オオカミ', icon: '🐺', col: '#696969', maxHp:  50, dmg: 15, spd: 140, alert: 200, atkR: 55, atkCd: 1.8, drops: [{ id:'raw_meat',  min:1,max:2 },{ id:'animal_hide',min:0,max:1 }]          },
  cave_bear: { name: 'クマ',     icon: '🐻', col: '#5a3010', maxHp: 120, dmg: 30, spd: 110, alert: 180, atkR: 60, atkCd: 2.5, drops: [{ id:'raw_meat',  min:2,max:3 },{ id:'animal_hide',min:1,max:2 }]          },
  tiger:     { name: 'トラ',     icon: '🐅', col: '#FF8C00', maxHp:  90, dmg: 35, spd: 170, alert: 260, atkR: 55, atkCd: 1.5, drops: [{ id:'raw_meat',  min:2,max:3 },{ id:'animal_hide',min:1,max:2 },{ id:'rare_ore',min:0,max:1 }] },
};

// 施設情報
const FACILITY_INFO = {
  campfire:        { name: 'たき火',       icon: '🔥', desc: '調理・暖・灯り' },
  water_collector: { name: '水だめ',       icon: '💧', desc: '水分を毎分自動補充(+0.5/sec)' },
  bed:             { name: '寝床',         icon: '🛏️',  desc: '睡眠でHP/スタミナ回復' },
  storage:         { name: '物置',         icon: '📦', desc: '所持枠+8スロット' },
  workbench:       { name: '作業台',       icon: '🔨', desc: '上位クラフト解禁' },
  fence:           { name: '柵・見張り台', icon: '🪵', desc: '夜の敵警戒範囲-30%' },
  farm:            { name: '畑/いけす',    icon: '🌾', desc: '食料を毎分自動補充(+0.3/sec)' },
  raft_dock:       { name: 'いかだ台',     icon: '🛶', desc: '船の建造が可能になる' },
};
