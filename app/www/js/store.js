// App state, local data (offline copy) and the sync engine.
(function () {
  var RM = window.RM;
  var reactive = Vue.reactive;

  var TABLES = ['owners', 'drivers', 'rickshaws', 'assignments', 'entries', 'garage_expenses'];
  var FIELDS = {
    owners: ['name', 'phone', 'address', 'note', 'is_self'],
    drivers: ['name', 'phone', 'nid', 'address', 'note', 'is_active', 'photo_id', 'nid_front_id', 'nid_back_id'],
    rickshaws: ['number', 'owner_id', 'default_rent', 'default_charge', 'status', 'note'],
    assignments: ['rickshaw_id', 'driver_id', 'start_date', 'end_date', 'expected_rent', 'note'],
    entries: ['rickshaw_id', 'driver_id', 'owner_id', 'entry_date', 'deposit', 'expense', 'expense_type', 'garage_charge', 'taken_time', 'deposit_time', 'note'],
    garage_expenses: ['category', 'amount', 'expense_date', 'note'],
  };
  // Mirrors the server (SyncSchema): c = create, u = update, d = delete.
  var PERM = {
    owners: { admin: 'cud', manager: '', owner: '' },
    drivers: { admin: 'cud', manager: 'cu', owner: '' },
    rickshaws: { admin: 'cud', manager: '', owner: '' },
    assignments: { admin: 'cud', manager: 'cud', owner: '' },
    entries: { admin: 'cud', manager: 'cud', owner: '' },
    garage_expenses: { admin: 'cud', manager: 'cud', owner: '' },
  };
  var BATCH = 300;

  var state = reactive({
    ready: false,
    lang: RM.util.ls.get('rm_lang') || 'bn',
    session: null,
    online: navigator.onLine !== false,
    blocked: '',
    sync: { state: 'idle', pending: 0, last: 0, error: '' },
    announcementHidden: false,
    mode: 'garage', // 'owner' = an admin looking at only their own rickshaws, like a rickshaw owner
  });

  var maps = {};
  var rev = reactive({});
  var cache = {};
  TABLES.forEach(function (t) { maps[t] = new Map(); rev[t] = 0; });
  var cursor = 0;

  function bump(t) { rev[t]++; }

  function clearMaps() {
    TABLES.forEach(function (t) { maps[t].clear(); bump(t); });
    cursor = 0;
    state.sync.pending = 0;
    state.sync.last = 0;
    state.sync.state = 'idle';
  }

  function countPending() {
    var n = 0;
    TABLES.forEach(function (t) { maps[t].forEach(function (r) { if (r._dirty) n++; }); });
    state.sync.pending = n;
    return n;
  }

  /* ---------- reading ---------- */

  /* The admin's own rickshaws: what an owner-mode view is limited to. */
  var scopeMemo = { sig: '', v: null };

  function selfOwnerId() {
    rev.owners;
    var id = null;
    maps.owners.forEach(function (o) { if (o.is_self && !o.deleted && !id) id = o.id; });
    return id;
  }

  function ownEntry(e, s) { return e.owner_id === s.self || (!e.owner_id && s.rick.has(e.rickshaw_id)); }

  function ownerScope() {
    var sig = [rev.rickshaws, rev.entries, rev.assignments, rev.owners].join('.');
    if (scopeMemo.sig === sig && scopeMemo.v) return scopeMemo.v;
    var s = { self: selfOwnerId(), rick: new Set(), drivers: new Set() };
    if (s.self) {
      maps.rickshaws.forEach(function (r) { if (!r.deleted && r.owner_id === s.self) s.rick.add(r.id); });
      maps.entries.forEach(function (e) { if (!e.deleted && e.owner_id === s.self) s.rick.add(e.rickshaw_id); });
      maps.assignments.forEach(function (a) { if (!a.deleted && s.rick.has(a.rickshaw_id)) s.drivers.add(a.driver_id); });
      maps.entries.forEach(function (e) { if (!e.deleted && e.driver_id && ownEntry(e, s)) s.drivers.add(e.driver_id); });
    }
    scopeMemo = { sig: sig, v: s };
    return s;
  }

  function ownerFilter(t, a) {
    var s = ownerScope();
    switch (t) {
      case 'owners': return a.filter(function (o) { return o.id === s.self; });
      case 'rickshaws': return a.filter(function (r) { return s.rick.has(r.id); });
      case 'assignments': return a.filter(function (x) { return s.rick.has(x.rickshaw_id); });
      case 'drivers': return a.filter(function (d) { return s.drivers.has(d.id); });
      case 'entries': return a.filter(function (e) { return ownEntry(e, s); });
      default: return []; // the garage's own costs are not the owner's business
    }
  }

  function list(t) {
    var r = rev[t]; // register reactive dependency
    var m = state.mode;
    var c = cache[t];
    if (c && c.r === r && c.m === m) return c.a;
    var a = [];
    maps[t].forEach(function (row) { if (!row.deleted) a.push(row); });
    if (m === 'owner') a = ownerFilter(t, a);
    cache[t] = { r: r, m: m, a: a };
    return a;
  }

  function get(t, id) {
    rev[t];
    return id ? maps[t].get(id) : undefined;
  }

  /** Recompute `fn` only when one of the tables changed. */
  var memos = {};
  function memo(key, tables, fn) {
    var sig = tables.map(function (t) { return rev[t]; }).join('.') + state.mode;
    var m = memos[key];
    if (m && m.sig === sig) return m.v;
    var v = fn();
    memos[key] = { sig: sig, v: v };
    return v;
  }

  /* ---------- writing ---------- */

  function role() {
    if (!state.session) return null;
    return state.mode === 'owner' ? 'owner' : state.session.user.role;
  }
  function realRole() { return state.session ? state.session.user.role : null; }
  function can(t, action) {
    var p = (PERM[t] || {})[role()] || '';
    return p.indexOf(action.charAt(0)) >= 0;
  }

  function persist(t, row) { return RM.db.put(t, row); }

  function save(t, obj) {
    var id = obj.id || RM.util.uuid();
    var prev = maps[t].get(id) || {};
    var row = Object.assign({}, prev, obj, { id: id, deleted: false, _dirty: 1 });
    row.updated_at = Math.max(Date.now(), (prev.updated_at || 0) + 1);
    maps[t].set(id, row);
    bump(t);
    persist(t, row);
    countPending();
    scheduleSync();
    return row;
  }

  function remove(t, id) {
    var prev = maps[t].get(id);
    if (!prev) return;
    var row = Object.assign({}, prev, { deleted: true, _dirty: 1, updated_at: Math.max(Date.now(), prev.updated_at + 1) });
    maps[t].set(id, row);
    bump(t);
    persist(t, row);
    countPending();
    scheduleSync();
  }

  /* ---------- sync ---------- */

  function serialize(t, r) {
    var o = { id: r.id, updated_at: r.updated_at, deleted: !!r.deleted };
    FIELDS[t].forEach(function (f) { o[f] = r[f] === undefined ? null : r[f]; });
    return o;
  }

  function collectDirty() {
    var out = {}, n = 0;
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i];
      for (var row of maps[t].values()) {
        if (!row._dirty) continue;
        (out[t] = out[t] || []).push(serialize(t, row));
        if (++n >= BATCH) return { out: out, n: n };
      }
    }
    return { out: out, n: n };
  }

  function adopt(t, r) {
    var row = Object.assign({}, r, { _dirty: 0 });
    maps[t].set(row.id, row);
    persist(t, row);
  }

  function applyResponse(sent, res) {
    var touched = {};

    // 1. rows the server accepted are no longer pending (unless edited again meanwhile)
    Object.keys(sent).forEach(function (t) {
      sent[t].forEach(function (s) {
        var cur = maps[t].get(s.id);
        if (cur && cur._dirty && cur.updated_at === s.updated_at) {
          cur._dirty = 0; persist(t, cur); touched[t] = 1;
        }
      });
    });

    // 2. the server won a conflict or refused the change: take its version
    var ov = res.overrides || {};
    Object.keys(ov).forEach(function (t) {
      if (!maps[t]) return;
      ov[t].forEach(function (r) { adopt(t, r); });
      touched[t] = 1;
    });

    // 3. rows the server refused outright (no permission / plan limit)
    (res.dropped || []).forEach(function (d) {
      if (!maps[d.table]) return;
      maps[d.table].delete(d.id);
      RM.db.del(d.table, d.id);
      touched[d.table] = 1;
      RM.events.emit('dropped', d);
    });

    // 4. news from other devices
    var ch = res.changes || {};
    Object.keys(ch).forEach(function (t) {
      if (!maps[t]) return;
      var batch = [];
      ch[t].forEach(function (r) {
        var local = maps[t].get(r.id);
        if (local && local._dirty && local.updated_at >= r.updated_at) return; // keep my newer pending edit
        var row = Object.assign({}, r, { _dirty: 0 });
        maps[t].set(r.id, row);
        batch.push(row);
      });
      RM.db.putMany(t, batch);
      touched[t] = 1;
    });

    Object.keys(touched).forEach(bump);
  }

  var running = false, queued = false, timer = null;

  function scheduleSync() {
    clearTimeout(timer);
    timer = setTimeout(runSync, 700);
  }

  function setGarage(g) {
    if (!g || !state.session) return;
    state.session.garage = g;
    saveSession();
  }

  function runSync() {
    if (!state.session || state.blocked) return Promise.resolve();
    if (running) { queued = true; return Promise.resolve(); }
    running = true;
    if (state.sync.state !== 'syncing') state.sync.state = 'syncing';

    var loops = 0;
    function step() {
      var d = collectDirty();
      return RM.api.post('/sync', { cursor: cursor, changes: d.out }).then(function (res) {
        applyResponse(d.out, res);
        cursor = res.cursor;
        RM.db.setMeta('cursor', cursor);
        setGarage(res.garage);
        countPending();
        if ((res.more || d.n >= BATCH) && ++loops < 200) return step();
      });
    }

    var uploads = RM.files ? RM.files.uploadPending().then(flushAvatar) : Promise.resolve();
    return uploads.then(step).then(function () {
      if (RM.files) RM.files.retryMissing();
      state.sync.last = Date.now();
      RM.db.setMeta('last', state.sync.last);
      state.sync.error = '';
      state.sync.state = countPending() ? 'pending' : 'ok';
    }).catch(function (e) {
      if (e.offline) state.sync.state = 'offline';
      else if (e.status === 402) {
        if (e.data && e.data.garage) setGarage(e.data.garage);
        state.sync.state = 'expired';
      } else if (e.status === 401 || e.status === 403) { /* handled by events */ }
      else { state.sync.state = 'error'; state.sync.error = e.message; }
    }).then(function () {
      running = false;
      if (queued) { queued = false; setTimeout(runSync, 300); }
    });
  }

  /* ---------- session ---------- */

  function saveSession() {
    if (state.session) RM.util.ls.set('rm_session', JSON.stringify(state.session));
    else RM.util.ls.del('rm_session');
  }

  function loadGarageData(garageId) {
    clearMaps();
    var stores = TABLES.concat(['files']);
    return RM.db.open('rm_garage_' + garageId, stores).then(function () {
      return Promise.all(TABLES.map(function (t) {
        return RM.db.getAll(t).then(function (rows) { rows.forEach(function (r) { maps[t].set(r.id, r); }); bump(t); });
      }));
    }).then(function () {
      return Promise.all([RM.db.getMeta('cursor'), RM.db.getMeta('last')]);
    }).then(function (m) {
      cursor = m[0] || 0;
      state.sync.last = m[1] || 0;
      countPending();
      if (state.sync.pending) state.sync.state = 'pending';
    });
  }

  function setSession(res) {
    var prevGarage = state.session && state.session.garage && state.session.garage.id;
    state.session = { token: res.token || (state.session && state.session.token), user: res.user, garage: res.garage, settings: res.settings || {} };
    // a picture chosen offline stays visible until the server has it
    var pend = null;
    try { pend = JSON.parse(RM.util.ls.get('rm_avatar_pending') || 'null'); } catch (e) { pend = null; }
    if (pend && res.user && pend.user === res.user.id) state.session.user.avatar_id = pend.id;
    saveSession();
    if (res.user && res.user.language && !RM.util.ls.get('rm_lang')) setLang(res.user.language);
    return prevGarage === res.garage.id && state.ready ? Promise.resolve() : loadGarageData(res.garage.id);
  }

  function login(loginName, password) {
    return RM.api.post('/auth/login', { login: loginName, password: password }).then(function (res) {
      state.blocked = '';
      state.mode = 'garage';
      return setSession(res);
    }).then(function () { runSync(); });
  }

  function register(data) {
    return RM.api.post('/auth/register', data).then(function (res) {
      state.blocked = '';
      return setSession(res);
    }).then(function () { runSync(); });
  }

  function endSession() {
    if (RM.files) RM.files.reset();
    state.mode = 'garage';
    state.session = null;
    saveSession();
    RM.db.close();
    clearMaps();
  }

  function logout() {
    var p = RM.api.post('/auth/logout').catch(function () {});
    endSession();
    return p;
  }

  function refreshMe() {
    return RM.api.get('/me').then(function (res) { return setSession(res); }).catch(function () {});
  }

  /** Profile picture chosen while offline (or any time): shown at once, sent to the server on the next sync. */
  function queueAvatar(id) {
    if (!state.session) return;
    state.session.user.avatar_id = id || null;
    saveSession();
    RM.util.ls.set('rm_avatar_pending', JSON.stringify({ id: id || null, user: state.session.user.id }));
    scheduleSync();
  }

  function flushAvatar() {
    var raw = RM.util.ls.get('rm_avatar_pending'), p = null;
    try { p = raw ? JSON.parse(raw) : null; } catch (e) { p = null; }
    if (!p || !state.session || p.user !== state.session.user.id) return Promise.resolve();
    return RM.api.put('/me', { avatar_id: p.id }).then(function (r) {
      RM.util.ls.del('rm_avatar_pending');
      state.session.user = r.user; // keep what the server now says
      saveSession();
    }).catch(function (e) {
      if (e.status === 422) RM.util.ls.del('rm_avatar_pending'); // the picture never reached the server: give up
    });
  }

  function setLang(l) {
    state.lang = l;
    RM.util.ls.set('rm_lang', l);
    document.documentElement.lang = l;
    if (state.session && state.session.token) RM.api.put('/me', { language: l }).catch(function () {});
  }

  function init() {
    document.documentElement.lang = state.lang;
    var raw = RM.util.ls.get('rm_session');
    var s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }

    var done = function () { state.ready = true; };
    if (!(s && s.token && s.garage)) return Promise.resolve().then(done);

    state.session = s;
    return loadGarageData(s.garage.id).then(function () {
      done();
      refreshMe().then(runSync);
    });
  }

  RM.events.on('unauthorized', function () { if (state.session) endSession(); });
  RM.events.on('blocked', function (msg) { state.blocked = msg || ' '; });

  window.addEventListener('online', function () { state.online = true; runSync(); });
  window.addEventListener('offline', function () { state.online = false; state.sync.state = 'offline'; });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) runSync(); });
  setInterval(function () { if (state.session && !document.hidden) runSync(); }, 30000);

  RM.tables = TABLES;
  RM.state = state;
  RM.data = { list: list, get: get, save: save, remove: remove, memo: memo, rev: rev };
  RM.can = can;
  RM.sync = { run: runSync, schedule: scheduleSync };
  RM.auth = { login: login, register: register, logout: logout, refreshMe: refreshMe, setSession: setSession, setGarage: setGarage, endSession: endSession };
  RM.setLang = setLang;
  RM.queueAvatar = queueAvatar;
  RM.init = init;
  RM.isAdmin = function () { return role() === 'admin'; };
  RM.isOwnerRole = function () { return role() === 'owner'; };
  RM.isRealOwner = function () { return realRole() === 'owner'; };
  // An admin who owns rickshaws can flip the whole app into the owner's point of view.
  RM.canSwitchMode = function () { return realRole() === 'admin' && !!selfOwnerId(); };
  RM.setMode = function (m) { state.mode = m === 'owner' ? 'owner' : 'garage'; };
})();
