/* ============================================================
   CredyFast — state.js  |  Estado global en memoria
   ============================================================ */

const State = (() => {
  const _data = {
    user:        null,   // { id, username, nombre, rol }
    token:       null,
    currentRoute: null,
    cache:       {},     // { key: { data, ts } }
  };

  function get(key)       { return _data[key]; }
  function set(key, val)  { _data[key] = val; }

  // ── Session persistence (sessionStorage) ──────────────────
  function saveSession(token, user) {
    _data.token = token;
    _data.user  = user;
    try {
      sessionStorage.setItem('cf_token', token);
      sessionStorage.setItem('cf_user',  JSON.stringify(user));
    } catch(_) {}
  }

  function loadSession() {
    try {
      const token = sessionStorage.getItem('cf_token');
      const user  = JSON.parse(sessionStorage.getItem('cf_user') || 'null');
      if (token && user) {
        _data.token = token;
        _data.user  = user;
        return true;
      }
    } catch(_) {}
    return false;
  }

  function clearSession() {
    _data.token = null;
    _data.user  = null;
    _data.cache = {};
    try {
      sessionStorage.removeItem('cf_token');
      sessionStorage.removeItem('cf_user');
    } catch(_) {}
  }

  // ── Simple cache con TTL ───────────────────────────────────
  function cacheSet(key, data, ttlMs = 30000) {
    _data.cache[key] = { data, ts: Date.now(), ttl: ttlMs };
  }

  function cacheGet(key) {
    const entry = _data.cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > entry.ttl) { delete _data.cache[key]; return null; }
    return entry.data;
  }

  function cacheClear(prefix) {
    if (prefix) {
      Object.keys(_data.cache).forEach(k => { if (k.startsWith(prefix)) delete _data.cache[k]; });
    } else {
      _data.cache = {};
    }
  }

  return { get, set, saveSession, loadSession, clearSession, cacheSet, cacheGet, cacheClear };
})();
