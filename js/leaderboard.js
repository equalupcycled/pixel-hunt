// Pixel Hunt - leaderboard abstraction.
// Local provider: top-10 per map in localStorage, with a free-text player name (max 12 chars). Works offline today.
// Online provider: STUB. When hosting is approved, set LEADERBOARD_CONFIG.online.url to a small backend
// (e.g. Render web service + Postgres) exposing:
//   POST {url}/scores        body {map, name, score, round, weapon, ts}   -> 200 {rank}
//   GET  {url}/scores?map=meadow&limit=10                                    -> 200 [{name, score, round, weapon, ts}]
// Infinity boards use map keys like 'meadow:inf'.
// See README "Leaderboard". Until then online calls are no-ops and the game uses local scores only.
'use strict';
window.LEADERBOARD_CONFIG = {
  size: 10,
  nameMax: 12,
  online: { enabled: false, url: '', timeoutMs: 4000 },
};

window.Leaderboard = (() => {
  const cfg = window.LEADERBOARD_CONFIG;
  const KEY = 'pixelhunt.board.v1';
  // Campaign scores live under the map id (e.g. 'meadow'). Infinity scores use 'meadow:inf'.
  const boardKey = (map, infinity) => infinity ? map + ':inf' : map;

  const LocalProvider = {
    _all() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    _save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} },
    async fetchTop(map, limit = cfg.size) { return (this._all()[map] || []).slice(0, limit); },
    async submitScore(map, entry) {
      const all = this._all(), list = all[map] || [];
      list.push(entry); list.sort((a, b) => b.score - a.score || a.ts - b.ts);
      all[map] = list.slice(0, cfg.size); this._save(all);
      const rank = all[map].indexOf(entry);
      return { rank: rank >= 0 ? rank + 1 : null };
    },
    qualifies(map, score) {
      if (score <= 0) return false;
      const list = this._all()[map] || [];
      return list.length < cfg.size || score > list[list.length - 1].score;
    },
  };

  const OnlineProvider = {
    get ready() { return cfg.online.enabled && !!cfg.online.url; },
    async _fetch(path, opts) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), cfg.online.timeoutMs);
      try { const r = await fetch(cfg.online.url.replace(/\/$/, '') + path, Object.assign({ signal: ctl.signal }, opts)); if (!r.ok) throw new Error(r.status); return await r.json(); }
      finally { clearTimeout(t); }
    },
    async fetchTop(map, limit = cfg.size) {
      if (!this.ready) return null;
      try { return await this._fetch(`/scores?map=${encodeURIComponent(map)}&limit=${limit}`); } catch (e) { return null; }
    },
    async submitScore(map, entry) {
      if (!this.ready) return null;
      try { return await this._fetch('/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ map }, entry)) }); } catch (e) { return null; }
    },
  };

  /** Clean a player name: letters/digits/space and . - _ ' ! only, collapsed spaces, max 12 chars. */
  function cleanName(n) {
    let s = String(n == null ? '' : n).normalize('NFC').replace(/[^\p{L}\p{N} ._'!-]/gu, '').replace(/\s+/g, ' ').trim();
    s = Array.from(s).slice(0, cfg.nameMax).join('').trim();
    return s || 'HUNTER';
  }
  const nameOf = e => e.name || e.initials || 'HUNTER'; // old entries used 3-letter initials
  return {
    local: LocalProvider, online: OnlineProvider, cleanName, nameOf, NAME_MAX: cfg.nameMax,
    qualifies: (map, score, infinity) => LocalProvider.qualifies(boardKey(map, infinity), score),
    boardKey,
    /** Save locally (always) and online (if configured). Resolves {rank, online}. */
    async submitScore(map, entry) {
      const inf = !!entry.infinity;
      const e = Object.assign({ ts: Date.now() }, entry, { name: cleanName(entry.name != null ? entry.name : entry.initials), infinity: inf });
      delete e.initials;
      const key = boardKey(map, inf);
      const local = await LocalProvider.submitScore(key, e);
      const online = await OnlineProvider.submitScore(key, e);
      return { rank: local.rank, online };
    },
    /** Online top list if available, otherwise local. Resolves {list, source}. */
    async fetchTop(map, limit, infinity) {
      const key = boardKey(map, infinity);
      const o = await OnlineProvider.fetchTop(key, limit);
      if (o) return { list: o, source: 'online' };
      return { list: await LocalProvider.fetchTop(key, limit), source: 'local' };
    },
  };
})();
