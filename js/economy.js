// Pixel Hunt - economy, arsenal & difficulty config (shared by the game and tools/econ-sim.js).
'use strict';
(function (root) {
  const R = (a, b, n) => Array.from({ length: n }, (_, i) => +(a + (b - a) * i / (n - 1)).toFixed(2));

  // ---------- primary weapons ----------
  // input: tap | hold (auto fire) | draw (hold to charge, release) | beam (hold)
  const WEAPONS = [
    { id: 'shotgun', name: 'Shotgun', input: 'tap', req: 0, ownW: 0, cash: 1, pts: 1, delay: 0.25,
      role: 'Starter. Wide pellet spread, forgiving aim.', ammoName: 'SHELLS', reloadName: 'RELOAD',
      tracks: [
        { k: 'cap', name: 'Barrel', names: ['Single Shot', 'Double Barrel', 'Pump Action', 'Lever Action', 'Semi-Auto', 'Combat 12', 'Drum Mag'],
          val: [1, 2, 3, 4, 5, 6, 8], desc: v => `${v} shell${v > 1 ? 's' : ''} per load` },
        { k: 'reload', name: 'Quick Hands', icon: 'hand', val: [1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.62, 0.55, 0.48, 0.42, 0.36], desc: v => `Reload ${v}s` },
        { k: 'choke', name: 'Wide Choke', icon: 'choke', val: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], desc: v => `Spread ${v}px` },
        { k: 'dmg', name: 'Heavy Load', icon: 'scope', w: 1.15, val: [2, 3, 4, 5, 6, 7, 8], desc: v => `DMG ${v}` },
      ] },
    { id: 'handgun', name: 'Handgun', input: 'tap', req: 2, ownW: 1.25, cash: 1, pts: 1, delay: 0.12,
      role: 'Fast precise taps, big mag, quick reload. Small hit area. Crits pay double.', ammoName: 'ROUNDS', reloadName: 'RELOAD',
      tracks: [
        { k: 'cap', name: 'Magazine', val: [6, 7, 8, 9, 10, 12, 14, 16], desc: v => `${v}-round mag` },
        { k: 'reload', name: 'Mag Swap', icon: 'hand', val: [1.0, 0.9, 0.8, 0.7, 0.6, 0.52, 0.45, 0.38], desc: v => `Reload ${v}s` },
        { k: 'sights', name: 'Red Dot', icon: 'choke', val: [3, 3.5, 4, 4.5, 5, 6, 7, 8], desc: v => `Hit area ${v}px` },
        { k: 'crit', name: 'Double Tap', icon: 'coin', val: [0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.4], desc: v => `${Math.round(v * 100)}% crit (2x $)` },
        { k: 'dmg', name: 'Hot Loads', icon: 'scope', w: 1.15, val: [1, 2, 3, 4, 5, 6], desc: v => `DMG ${v}` },
      ] },
    { id: 'rifle', name: 'Rifle', input: 'tap', req: 12, ownW: 1.35, cash: 1, pts: 1.2, delay: 0.45, deerBonus: 1.5,
      role: 'One piercing round flies from you through the tap point. Line up birds. Deer pay 1.5x.', ammoName: 'ROUNDS', reloadName: 'BOLT',
      tracks: [
        { k: 'cap', name: 'Stripper Clip', val: [1, 2, 3, 4, 5], desc: v => `${v} round${v > 1 ? 's' : ''} per load` },
        { k: 'reload', name: 'Smooth Bolt', icon: 'hand', val: [2.0, 1.8, 1.6, 1.4, 1.25, 1.1, 0.95, 0.8], desc: v => `Bolt ${v}s` },
        { k: 'caliber', name: 'Caliber', icon: 'choke', val: [3.5, 4, 4.5, 5, 5.5, 6, 7], desc: v => `Bullet ${v}px` },
        { k: 'pierce', name: 'AP Rounds', icon: 'scope', val: [1, 2, 3, 4, 5], desc: v => `Pierces ${v} target${v > 1 ? 's' : ''}` },
        { k: 'dmg', name: 'Soft Point', icon: 'scope', w: 1.2, val: [4, 5, 6, 7, 9, 11, 13], desc: v => `DMG ${v}` },
      ] },
    { id: 'bow', name: 'Bow', input: 'draw', req: 24, ownW: 1.35, cash: 1, pts: 1.1, delay: 0.15, goldBonus: 2,
      role: 'Silent: misses never break your streak. Hold to draw, release to loose. Arrows arc - lead your target. Golden birds pay 2x.', ammoName: 'ARROWS', reloadName: 'NOCK',
      tracks: [
        { k: 'cap', name: 'Quiver', val: [3, 4, 5, 6, 7, 8, 10], desc: v => `${v} arrows` },
        { k: 'reload', name: 'Fletcher', icon: 'hand', val: [1.6, 1.4, 1.25, 1.1, 0.95, 0.8, 0.65, 0.55], desc: v => `Restock ${v}s` },
        { k: 'draw', name: 'Draw Weight', icon: 'scope', val: [0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22], desc: v => `Full draw ${v}s` },
        { k: 'tip', name: 'Broad Tip', icon: 'choke', val: [3, 3.5, 4, 4.5, 5, 5.5, 6], desc: v => `Tip ${v}px` },
        { k: 'pierce', name: 'Bodkin', icon: 'feather', val: [1, 2, 3], desc: v => `Pierces ${v}` },
        { k: 'dmg', name: 'War Tips', icon: 'scope', w: 1.2, val: [3, 4, 5, 6, 7, 9, 11], desc: v => `DMG ${v}` },
      ] },
    { id: 'mg', name: 'Machine Gun', input: 'hold', req: 40, ownW: 1.4, cash: 0.65, pts: 0.6,
      role: 'Hold to spray. Shreds crowds in late rounds, but long reload and each hit pays 65%.', ammoName: 'BELT', reloadName: 'RELOAD',
      tracks: [
        { k: 'cap', name: 'Belt Box', val: [30, 40, 50, 60, 75, 90, 110], desc: v => `${v}-round belt` },
        { k: 'reload', name: 'Belt Feed', icon: 'hand', val: [3.0, 2.7, 2.4, 2.1, 1.8, 1.6, 1.4, 1.2], desc: v => `Reload ${v}s` },
        { k: 'spread', name: 'Bipod', icon: 'choke', val: [12, 10, 8.5, 7, 6, 5, 4], desc: v => `Spread ${v}px` },
        { k: 'rate', name: 'Fire Rate', icon: 'scope', val: [0.11, 0.1, 0.09, 0.08, 0.07, 0.06], desc: v => `${Math.round(1 / v)} rounds/s` },
        { k: 'dmg', name: 'AP Belt', icon: 'scope', w: 1.15, val: [1, 2, 3, 4, 5], desc: v => `DMG ${v}` },
      ] },
    { id: 'laser', name: 'Laser Gun', input: 'beam', req: 90, ownW: 1.5, cash: 0.85, pts: 0.8,
      role: 'No ammo: a beam you sweep while holding. Builds heat - VENT by hand. Tracks erratic birds. Hits pay 85%.', ammoName: 'HEAT', reloadName: 'VENT',
      tracks: [
        { k: 'cap', name: 'Heat Sink', val: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], desc: v => `${v}s of beam` },
        { k: 'reload', name: 'Coolant', icon: 'hand', val: [2.5, 2.2, 1.9, 1.6, 1.4, 1.2, 1.0, 0.8], desc: v => `Vent ${v}s` },
        { k: 'width', name: 'Lens', icon: 'choke', val: [2, 2.5, 3, 3.5, 4, 4.5, 5], desc: v => `Beam ${v}px` },
        { k: 'power', name: 'Power Cell', icon: 'scope', val: [0.25, 0.21, 0.18, 0.15, 0.12, 0.1, 0.08], desc: v => `Burns in ${v}s` },
        { k: 'dmg', name: 'Overcharge', icon: 'scope', w: 1.2, val: [2, 3, 4, 5, 6, 7], desc: v => `DMG ${v}` },
      ] },
  ];

  // ---------- turrets (auto-fire, limited ammo per round, only "clean up" birds about to escape) ----------
  const TURRETS = [
    { id: 'pellet', name: 'Pellet Turret', req: 20, ownW: 1.3, role: 'Cheap auto-gun. Fires at birds that are about to get away.',
      tracks: [
        { k: 'ammo', name: 'Hopper', val: [2, 3, 3, 4, 4, 5], desc: v => `${v} shots/round` },
        { k: 'rate', name: 'Servo', icon: 'hand', val: [2.5, 2.1, 1.8, 1.5, 1.2], desc: v => `Every ${v}s` },
        { k: 'aim', name: 'Optics', icon: 'scope', val: [10, 7, 5, 3], desc: v => `Aim error ${v}px` },
        { k: 'dmg', name: 'Shot Weight', icon: 'scope', w: 1.15, val: [2, 3, 4, 5, 6], desc: v => `DMG ${v}` },
      ] },
    { id: 'tesla', name: 'Tesla Coil', req: 55, ownW: 1.5, role: 'Instant chain lightning. Few charges, never misses in range.',
      tracks: [
        { k: 'ammo', name: 'Capacitors', val: [1, 1, 2, 2, 3], desc: v => `${v} zap${v > 1 ? 's' : ''}/round` },
        { k: 'chain', name: 'Arc Chain', icon: 'choke', val: [1, 2, 3], desc: v => `Chains to ${v}` },
        { k: 'range', name: 'Coil Size', icon: 'scope', val: [70, 85, 100, 120], desc: v => `Range ${v}px` },
        { k: 'dmg', name: 'Voltage', icon: 'scope', w: 1.2, val: [3, 4, 5, 6, 8], desc: v => `DMG ${v}` },
      ] },
    { id: 'missile', name: 'Missile Pod', req: 75, ownW: 1.6, role: 'Homing missiles with splash. Loves deer and golden birds.',
      tracks: [
        { k: 'ammo', name: 'Pods', val: [1, 1, 2, 2, 3], desc: v => `${v} missile${v > 1 ? 's' : ''}/round` },
        { k: 'blast', name: 'Warhead', icon: 'choke', val: [8, 10, 12, 15], desc: v => `Blast ${v}px` },
        { k: 'rate', name: 'Autoloader', icon: 'hand', val: [5, 4.2, 3.5, 2.8], desc: v => `Every ${v}s` },
        { k: 'dmg', name: 'Payload', icon: 'scope', w: 1.2, val: [3, 4, 5, 6, 8], desc: v => `DMG ${v}` },
      ] },
  ];
  const TURRET_CASH = 0.4, TURRET_PTS = 0.5; // turret kills pay less and never reset the miss counter

  // ---------- global gear & gadgets ----------
  const GLOBAL = [
    { id: 'eye', name: "Hunter's Eye", icon: 'eye', val: [1, 1.06, 1.12, 1.18, 1.24, 1.3, 1.36, 1.43, 1.5], desc: v => v > 1 ? `Targets cross ${Math.round((1 - 1 / v) * 100)}% slower` : 'Targets cross the screen slower' },
    { id: 'focus', name: 'Focus Scope', icon: 'scope', w: 1.1, val: [0, 1, 1, 2, 2, 3, 3], dur: [0, 2.5, 3.5, 3.5, 4.5, 4.5, 5.5],
      desc: (v, l) => v ? `${v} slow-mo/round, ${extendVal([0, 2.5, 3.5, 3.5, 4.5, 4.5, 5.5], l)}s` : 'Slow-mo ability (F)' },
    { id: 'luck', name: 'Lucky Feather', icon: 'feather', w: 2.5, val: [3, 4, 5], desc: v => `${v} misses (X) allowed per run` },
    { id: 'bounty', name: 'Bounty Hunter', icon: 'coin', val: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.75, 3], desc: v => `x${v} money` },
    { id: 'loadout', name: 'Gun Sling', icon: 'gun', w: 1.6, req: 30, unlock: true, val: [0, 1], desc: v => v ? '2 weapons, SWAP mid-run' : 'Carry a 2nd weapon' },
    { id: 'turret.slots', name: 'Turret Pads', icon: 'turret', w: 1.4, req: 20, val: [0, 1, 2, 3], desc: v => `${v} turret slot${v === 1 ? '' : 's'}` },
    { id: 'gadget.flak', name: 'Flak Grenade', icon: 'flak', req: 8, val: [0, 1, 2, 3, 4], desc: v => v ? `${v} per run: tap FLAK, tap sky` : 'Area blast gadget' },
    { id: 'gadget.call', name: 'Bird Call', icon: 'call', req: 16, val: [0, 1, 2, 3], desc: v => v ? `${v} per run: next 3 birds golden` : 'Lure golden birds' },
    { id: 'gadget.decoy', name: 'Duck Decoy', icon: 'decoy', req: 30, val: [0, 1, 2, 3], desc: v => v ? `${v} per run: birds slow & gather 6s` : 'Lure & slow birds' },
  ];

  // ---------- maps: each harder than the last, with a rising money multiplier ----------
  // diff: multipliers on speed / linger time / size.  animals: [kind for bird slot, alt bird, ground runner, boss]
  const MAPS = [
    { id: 'meadow', name: 'Meadow', req: 0, w: 0, cash: 1.0, pts: 1.0, speed: 1.0, life: 1.0, size: 1.0, dark: 0,
      role: 'Classic fields. Ducks, bluebirds, deer.', boss: 'eagle' },
    { id: 'lake', name: 'Lake', req: 18, w: 1.4, cash: 1.3, pts: 1.2, speed: 1.08, life: 0.95, size: 0.97, dark: 0,
      role: 'Ducks & geese skim low over the water. Geese are tougher. Pays 1.3x.', boss: 'goose' },
    { id: 'snow', name: 'Snowy Forest', req: 45, w: 1.6, cash: 1.7, pts: 1.5, speed: 1.15, life: 0.92, size: 0.95, dark: 0,
      role: 'Snow owls glide, rabbits zig-zag, wolves sprint. Pays 1.7x.', boss: 'yeti' },
    { id: 'desert', name: 'Desert', req: 80, w: 1.8, cash: 2.2, pts: 1.8, speed: 1.22, life: 0.88, size: 0.93, dark: 0,
      role: 'Vultures circle, roadrunners dash, coyotes. Heat haze. Pays 2.2x.', boss: 'vulture' },
    { id: 'night', name: 'Night Hunt', req: 120, w: 2.0, cash: 2.8, pts: 2.3, speed: 1.3, life: 0.85, size: 0.92, dark: 1,
      role: 'Bats & owls in the dark - only your flashlight shows them. Pays 2.8x.', boss: 'batking' },
  ];
  const BOSS_EVERY = 10;
  // A map is CLEARED by defeating that map's round 30 boss (the 3rd boss). That unlocks Infinity mode for the map.
  const CLEAR_ROUND = 30;
  // HP tables. Shotgun starts at DMG 2, so a basic duck (2 HP) still dies in one starter shot.
  // Boss HP is the old hit-count (6, 10, 14, 18...) times that shotgun base, so mid-game clear pacing stays put.
  const BASE_SHOT_DMG = 2;
  const HP = {
    bird: 2, blue: 2, gold: 2, decoy: 1,
    goose: 4, owl: 3, bat: 2, vulture: 4,
    deer: 4, swimgoose: 4, rabbit: 3, wolf: 5, roadrunner: 3, coyote: 5, eyes: 3, egg: 2,
  };
  const kindHp = k => HP[k] || 2;
  const hitsNeeded = (hp, dmg) => Math.max(1, Math.ceil((hp || 1) / Math.max(1, dmg || 1)));
  const flakDmg = l => 3 + Math.max(1, l | 0);
  const bossHp = r => (6 + Math.floor(r / 10) * 4) * BASE_SHOT_DMG;
  const bossTime = r => Math.max(9, 16 - Math.floor(r / 10)); // seconds before it escapes (counts as a miss)
  const bossCash = r => 120 + r * 12;                      // before map/bounty multipliers

  // ---------- cosmetics (fixed prices, no gameplay effect) ----------
  const SKINS = [
    { id: 'classic', name: 'Classic Camo', cost: 0, pal: { H: '#5b6b2f', J: '#4a5a24', P: '#3b2f1d', S: '#f0c08a', C: '#2f3a18' } },
    { id: 'blaze', name: 'Blaze Orange', cost: 5000, pal: { H: '#ff7a1a', J: '#ff6a00', P: '#3b2f1d', S: '#f0c08a', C: '#ff7a1a' } },
    { id: 'ghillie', name: 'Ghillie Suit', cost: 20000, pal: { H: '#3f7a2a', J: '#2f6a20', P: '#2a4a18', S: '#c09a6a', C: '#5a9a3a' } },
    { id: 'midnight', name: 'Midnight', cost: 60000, pal: { H: '#1a1a2a', J: '#2a2a44', P: '#111', S: '#d0a070', C: '#6a3fb5' } },
    { id: 'golden', name: 'Golden Hunter', cost: 250000, pal: { H: '#ffd23f', J: '#e0a800', P: '#7a5a00', S: '#f0c08a', C: '#fff2a0' } },
  ];
  const CROSSHAIRS = [
    { id: 'white', name: 'White', cost: 0, c: '#ffffff' }, { id: 'red', name: 'Red', cost: 3000, c: '#ff3b3b' },
    { id: 'lime', name: 'Lime', cost: 3000, c: '#7dff7a' }, { id: 'cyan', name: 'Cyan', cost: 3000, c: '#5ae0ff' },
    { id: 'pink', name: 'Hot Pink', cost: 3000, c: '#ff5aa8' }, { id: 'gold', name: 'Gold', cost: 12000, c: '#ffd23f' },
  ];

  // ---------- flatten into purchasable tracks ----------
  const TRACKS = [];
  WEAPONS.forEach(w => {
    if (w.ownW) TRACKS.push({ id: 'own.' + w.id, name: 'Unlock ' + w.name, icon: w.id, w: w.ownW, req: w.req, val: [0, 1], group: 'weapon', of: w.id, unlock: true, desc: v => v ? 'Owned' : 'Unlock' });
    w.tracks.forEach(t => TRACKS.push(Object.assign({}, t, { id: w.id + '.' + t.k, icon: t.icon || w.id, w: t.w || 1, req: w.req, group: 'weapon', of: w.id, needs: w.ownW ? 'own.' + w.id : null })));
  });
  TURRETS.forEach(tu => {
    TRACKS.push({ id: 'own.' + tu.id, name: 'Build ' + tu.name, icon: 'turret', w: tu.ownW, req: tu.req, val: [0, 1], group: 'turret', of: tu.id, unlock: true, desc: v => v ? 'Built' : 'Build' });
    tu.tracks.forEach(t => TRACKS.push(Object.assign({}, t, { id: tu.id + '.' + t.k, icon: t.icon || 'turret', w: t.w || 1, req: tu.req, group: 'turret', of: tu.id, needs: 'own.' + tu.id })));
  });
  GLOBAL.forEach(g => TRACKS.push(Object.assign({ w: 1, req: 0, group: 'gear' }, g)));
  MAPS.forEach(m => { if (m.w) TRACKS.push({ id: 'map.' + m.id, name: 'Map: ' + m.name, icon: 'map', w: m.w, req: m.req, val: [0, 1], group: 'map', of: m.id, unlock: true, desc: v => v ? 'Unlocked' : 'Unlock map' }); });
  TRACKS.push({ id: 'flashlight', name: 'Flashlight', icon: 'scope', w: 1, req: 120, needs: 'map.night', val: [40, 50, 60, 72, 85], group: 'gear', desc: v => `Night light radius ${v}px` });

  // Late-game Perks: expensive, genuinely helpful, and distinct from Gear (Eye, Focus, Lucky Feather, Bounty, gadgets).
  // In Infinity these are not capped — extendVal keeps growing the bonus.
  const PERKS = [
    { id: 'perk.auto', name: 'Auto Reload', icon: 'auto', w: 3.2, req: 28,
      val: [0, 0.20, 0.12, 0.06, 0.02, 0],
      desc: (v, l) => !l ? 'When your gun is empty it reloads for you. The laser vents itself when it overheats; the bow nocks itself.'
        : v <= 0.001 ? 'Auto reload / vent / nock instantly when empty' : `Auto reload / vent / nock ${v.toFixed(2)}s after empty` },
    { id: 'perk.loader', name: 'Speed Loader', icon: 'loader', w: 2.8, req: 32,
      val: [1, 0.70, 0.60, 0.50, 0.40, 0.32],
      desc: (v, l) => !l ? 'Every reload, vent, and nock is faster — all weapons.' : `Reload / vent / nock ${Math.round((1 - v) * 100)}% faster` },
    { id: 'perk.reserve', name: 'Reserve Ammo', icon: 'reserve', w: 3.0, req: 36,
      val: [0, 3, 4, 5, 7, 9],
      desc: (v, l) => !l ? 'Extra shells, rounds, arrows, or belt ammo in every gun, plus more laser heat capacity.' : (v ? `+${v} ammo (laser +${(v * 0.35).toFixed(2)}s heat)` : 'No reserve') },
    { id: 'perk.combo', name: 'Combo Keeper', icon: 'combo', w: 3.0, req: 40,
      val: [99, 0, 0, 0, 0, 0],
      pay: [1, 1.22, 1.30, 1.38, 1.48, 1.60],
      desc: (v, l) => !l ? 'A miss no longer wipes your streak, and every kill and round bonus pays more.' : ('Misses never break your streak · kills and round bonuses pay +' + Math.round(([1, 1.22, 1.30, 1.38, 1.48, 1.60][Math.min(l, 5)] - 1) * 100) + '%') },
    { id: 'perk.crit', name: 'Critical Shot', icon: 'crit', w: 3.2, req: 45,
      val: [0, 0.26, 0.32, 0.38, 0.46, 0.55],
      desc: (v, l) => !l ? 'Any weapon can crit: double points and cash.' : `${Math.round(v * 100)}% chance to double points and cash` },
    { id: 'perk.eggsnipe', name: 'Egg Sniper', icon: 'eggsnipe', w: 2.8, req: 48,
      val: [1, 8, 10, 13, 16, 20],
      desc: (v, l) => !l ? 'Eggs are worth much more, fall slower, and are easier to smash before they hatch. Boss payouts also get a boost.' : `${v.toFixed(0)}x egg points and cash · eggs fall slower · +${Math.round((0.10 + 0.05 * Math.max(0, l - 1)) * 100)}% boss cash` },
    { id: 'perk.magnet', name: 'Cash Magnet', icon: 'magnet', w: 3.6, req: 50,
      val: [0, 0.20, 0.26, 0.32, 0.40, 0.50],
      desc: (v, l) => !l ? 'At the end of every cleared round, collect a bonus on the cash you earned that round.' : `+${Math.round(v * 100)}% cash at the end of each cleared round` },
    { id: 'perk.second', name: 'Second Chance', icon: 'second', w: 4.2, req: 55,
      val: [0, 2, 2, 3, 3, 4],
      desc: (v, l) => !l ? 'The first escapes each run are ignored — free saves. After a save, time briefly slows so you can recover.' : `${v} ignored escape${v === 1 ? '' : 's'} per run · brief slow-mo after a save` },
    { id: 'perk.deer', name: 'Deer Whisperer', icon: 'deer', w: 2.8, req: 60,
      val: [1, 0.50, 0.42, 0.36, 0.30, 0.24],
      mercy: [0, 99, 99, 99, 99, 99],
      cash: [1, 1.50, 1.65, 1.80, 2.00, 2.25],
      desc: (v, l) => !l ? 'Deer and other ground animals run slower and pay more. Ground escapes cost no X, and more deer show up.' : `Ground animals ${Math.round((1 - v) * 100)}% slower · pay +${Math.round(([1, 1.50, 1.65, 1.80, 2.00, 2.25][Math.min(l, 5)] - 1) * 100)}% · ground escapes cost no X · +2 deer/round` },
    { id: 'perk.bullet', name: 'Bullet Time', icon: 'bullet', w: 3.8, req: 70,
      val: [1, 0.55, 0.48, 0.42, 0.36, 0.30],
      desc: (v, l) => !l ? 'Time automatically slows when you are one X from game over, and during every boss round.' : `World runs at ${Math.round(v * 100)}% speed on your last X and on bosses` },
  ];
  PERKS.forEach(g => TRACKS.push(Object.assign({ group: 'perk' }, g)));
  const TOTAL_LEVELS = TRACKS.reduce((a, t) => a + t.val.length - 1, 0);

  // ---------- prices ----------
  // cost = BASE x weight x (1 + 3%/track level) x CURVE[upgrades owned]
  // CURVE is the pre-total-miss re-fit (cad8aa6 / 342f990). John asked to keep these higher prices (~6 games/upgrade under the total-miss + checkpoint rules). Do not --fit down.
  const BASE = 1000, PER_LEVEL = 0.03;
  /*CURVE*/const CURVE = [3.617, 6.626, 7.168, 8.677, 9.411, 9.463, 9.858, 10.602, 11.84, 12.648, 13.344, 14.083, 14.342, 14.909, 15.327, 15.584, 16.094, 16.744, 17.68, 18.456, 19.376, 20.171, 20.881, 21.494, 22.03, 22.533, 22.902, 22.908, 22.968, 22.968, 22.968, 23.196, 23.553, 23.737, 23.737, 23.737, 23.737, 23.913, 24.15, 24.376, 24.462, 24.462, 24.462, 25.088, 25.663, 26.119, 26.386, 26.771, 27.247, 28.003, 29.16, 30.133, 30.622, 31.138, 31.765, 32.485, 33.595, 34.638, 35.523, 36.99, 38.025, 39.656, 41.26, 42.434, 44.273, 45.516, 46.815, 47.891, 48.25, 48.549, 48.777, 49.039, 49.039, 49.039, 49.039, 49.039, 49.039, 49.039, 49.039, 49.842, 50.533, 52.407, 54.054, 55.758, 57.165, 59.036, 60.186, 60.934, 61.559, 63.094, 64.2, 65.257, 66.328, 67.53, 67.84, 67.84, 67.84, 67.916, 67.916, 67.916, 67.916, 69.19, 71.356, 73.451, 75.599, 78.279, 81.239, 84.444, 87.435, 88.956, 90.052, 91.486, 92.527, 93.306, 94.432, 96.396, 99.054, 102.608, 106.943, 111.18, 114.881, 120.668, 127.98, 134.694, 141.492, 148.719, 154.545, 160.419, 167.909, 180.474, 191.513, 202.971, 217.525, 229.809, 243.053, 256.022, 270.224, 291.107, 308.696, 331.485, 356.943, 380.256, 405.287, 429.211, 459.604, 491.185, 518.162, 550.294, 581.16, 615.522, 657.867, 735.128, 846.428, 991.598, 1172.532, 1353.722, 1521.781, 1689.76, 1851.882, 1989.985, 2097.567, 2179.575, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2210.954, 2214.104, 2215.176, 2215.176, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2222.528, 2229.866, 2229.866, 2229.866, 2229.866, 2229.866, 2229.866, 2229.866, 2229.866, 2236.024, 2280.74448];/*END*/
  function curve(n) {
    if (CURVE) return CURVE[Math.min(n, CURVE.length - 1)];
    return 3.1 * (n === 0 ? 1 : 1.6 * Math.pow(1.03, n));
  }
  function nice(n) {
    const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
    return Math.round(n / m) * m;
  }
  function cost(track, level, totalBought) { return nice(BASE * (track.w || 1) * curve(totalBought) * (1 + PER_LEVEL * level)); }

  // Infinity: same prices through the vanilla track, then exponential cost past the original cap.
  // Values past the cap keep growing/shrinking with diminishing (but never-zero) returns.
  const INF_OVER = 1.22;
  function cappedTrack(track) { return !!(track && (track.unlock || track.group === 'map' || track.id === 'turret.slots')); }
  function extendVal(arr, level) {
    const a = arr || [0], lv = Math.max(0, level | 0);
    if (lv < a.length) return a[lv];
    const v0 = a[Math.max(0, a.length - 2)], v1 = a[a.length - 1], extra = lv - (a.length - 1);
    if (v1 === v0) return v1;
    if (v1 > v0) {
      let v = v1, step = v1 - v0;
      for (let i = 0; i < extra; i++) { step = Math.max(step * 0.72, Math.abs(v1) * 0.012, 0.01); v += step; }
      return a.every(x => Number.isInteger(x)) ? Math.round(v) : +v.toFixed(4);
    }
    const floor = Math.max(0.04, Math.min(Math.abs(v1) * 0.2, 0.2));
    return +Math.max(floor, floor + (v1 - floor) * Math.pow(0.78, extra)).toFixed(4);
  }
  function infVal(track, level) {
    if (!track) return 0;
    if (cappedTrack(track)) return track.val[Math.min(Math.max(0, level | 0), track.val.length - 1)];
    return extendVal(track.val, level);
  }
  function infCost(track, level, totalBought) {
    const cap = track.val.length - 1;
    const base = cost(track, Math.min(level, cap), totalBought);
    const over = Math.max(0, level - cap);
    return over ? nice(base * Math.pow(INF_OVER, over)) : base;
  }
  function dmgOf(id, level) {
    const tr = TRACKS.find(t => t.id === id + '.dmg');
    return tr ? infVal(tr, level) : 1;
  }

  // ---------- difficulty ----------
  function difficulty(r) {
    const late = Math.max(0, r - 15); // after round 15 it keeps getting harder so even a maxed arsenal eventually falls
    const late2 = Math.max(0, r - 28); // "storm" phase: endgame runs top out around round 35-45
    return {
      count: Math.min(3 + r, 26),
      speed: Math.min(26 + (r - 1) * 5.5, 103) + late * 5 + late2 * late2 * 1.2,
      conc: r < 3 ? 1 : r < 6 ? 2 : r < 10 ? 3 : r < 16 ? 4 : r < 24 ? 5 : 6,
      life: Math.max(0.55, Math.max(2.4, 6.5 - (r - 1) * 0.3) - late * 0.09 - late2 * 0.05),
      erratic: Math.min(0.9, Math.max(0, (r - 2) * 0.09)),
      scale: Math.max(0.55, Math.max(0.85, 1.5 - (r - 1) * 0.05) - late * 0.012 - late2 * 0.01),
      gold: Math.min(0.05 + r * 0.01, 0.16),
      decoy: r >= 3 ? Math.min(0.05 + (r - 3) * 0.02, 0.22) : 0,
      deer: r >= 4 ? Math.min(0.14 + (r - 4) * 0.025, 0.32) : 0,
      deerSpeed: Math.min(48 + (r - 4) * 8, 150) + late * 5,
      interval: Math.max(0.45, 1.5 - r * 0.07),
    };
  }
  const KILL = { bird: { pts: 500, cash: 5 }, blue: { pts: 750, cash: 7 }, gold: { pts: 2500, cash: 25 }, deer: { pts: 1500, cash: 15 },
    goose: { pts: 1200, cash: 12 }, owl: { pts: 900, cash: 9 }, rabbit: { pts: 1000, cash: 10 }, wolf: { pts: 2000, cash: 20 },
    vulture: { pts: 900, cash: 9 }, roadrunner: { pts: 1600, cash: 16 }, coyote: { pts: 1800, cash: 18 }, bat: { pts: 800, cash: 8 }, eyes: { pts: 1400, cash: 14 } };
  const killCash = (kind, round, moneyMult, mult) => Math.round(KILL[kind].cash * (1 + 0.08 * (round - 1)) * moneyMult * (1 + 0.1 * (mult - 1)));
  const killPts = (kind, round, mult) => Math.round(KILL[kind].pts * (1 + (round - 1) * 0.25) * mult / 10) * 10;
  const roundBonus = (r, perfect) => Math.round((10 + r * 5 + (perfect ? 10 + r * 3 : 0)));
  const decoyPenalty = r => 15 + r * 5;
  // Eggs dropped by patrolling bosses. Interval shortens with boss tier (round/10) and faster maps.
  // Round 10 Meadow is deliberately gentle so a new player who reaches it isn't swarmed.
  const eggPts = r => Math.round((200 + 12 * r) / 10) * 10;
  const eggCash = r => 3 + Math.floor(r / 5);
  function eggInterval(r, map) {
    const tier = Math.max(1, Math.floor(r / BOSS_EVERY));
    const mapMul = (map && map.speed) || 1;
    return Math.max(1.15, (4.05 - (tier - 1) * 0.55) / mapMul);
  }


  const MISSION_PCT = 0.10;
  const DAILY_PCT = [0.08, 0.10, 0.12, 0.14, 0.16, 0.20, 0.35];
  const DOUBLE_ADS_PER_DAY = 3;

  const ECON = { WEAPONS, TURRETS, GLOBAL, PERKS, MAPS, BOSS_EVERY, CLEAR_ROUND, BASE_SHOT_DMG, HP, kindHp, hitsNeeded, flakDmg, dmgOf, bossHp, bossTime, bossCash, SKINS, CROSSHAIRS, TRACKS, TOTAL_LEVELS, TURRET_CASH, TURRET_PTS,
    cost, infCost, infVal, extendVal, cappedTrack, nice, curve, difficulty, KILL, killCash, killPts, roundBonus, decoyPenalty,
    MISSION_PCT, DAILY_PCT, DOUBLE_ADS_PER_DAY, BASE, PER_LEVEL, eggPts, eggCash, eggInterval };
  if (typeof module !== 'undefined' && module.exports) module.exports = ECON; else root.ECON = ECON;
})(typeof window !== 'undefined' ? window : globalThis);
