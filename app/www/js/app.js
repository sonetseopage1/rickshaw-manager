// Root component: shell, router, banners.
(function () {
  var RM = window.RM;
  var U = RM.util;

  var TABS = ['home', 'entries', 'assign', 'reports', 'more'];
  var SUBS = ['setup', 'expenses', 'logs', 'settings', 'daybook', 'dues', 'drivers'];
  var ROUTES = TABS.concat(SUBS);
  // Rickshaw owners get a read-only subset of the app.
  var OWNER_TABS = ['home', 'entries', 'reports', 'more'];
  var OWNER_ROUTES = OWNER_TABS.concat(['settings', 'dues', 'drivers']);
  var TAB_ICONS = { home: 'home', entries: 'receipt', assign: 'calendar', reports: 'chart', more: 'menu' };

  function parse(h) {
    var n = String(h || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(n) >= 0 ? n : 'home';
  }

  function ownerParam(h) {
    var m = /[?&]o=([^&]*)/.exec(String(h || ''));
    return m ? decodeURIComponent(m[1]) : null;
  }

  var route = Vue.ref(parse(location.hash));
  RM.state.homeOwner = ownerParam(location.hash); // null = the list of owners
  window.addEventListener('hashchange', function () {
    route.value = parse(location.hash);
    RM.state.homeOwner = ownerParam(location.hash);
  });

  RM.openOwner = function (key) {
    RM.state.homeFilter = 'all';
    location.hash = '#/home?o=' + encodeURIComponent(key);
  };
  RM.closeOwner = function () {
    if (RM.state.homeOwner === null) return;
    history.back();
    // opened straight from a reloaded address: there is nothing to go back to
    setTimeout(function () {
      if (RM.state.homeOwner !== null) { history.replaceState(history.state, '', '#/home'); RM.state.homeOwner = null; }
    }, 200);
  };

  RM.go = function (name) {
    if (SUBS.indexOf(name) >= 0) {
      location.hash = '#/' + name;
    } else {
      history.replaceState(history.state, '', '#/' + name);
      route.value = name;
      RM.state.homeOwner = null;
    }
    var c = document.querySelector('.content');
    if (c) c.scrollTop = 0;
  };

  RM.events.on('dropped', function (d) {
    RM.toast(RM.t(d.reason === 'plan_limit' ? 'banner.planLimit' : 'banner.dropped'), 'err');
  });

  var App = {
    data: function () { return { icons: TAB_ICONS, dismissed: false }; },
    computed: {
      s: function () { return RM.state; },
      isOwner: function () { return RM.isOwnerRole(); },
      canSwitch: function () { return RM.canSwitchMode(); },
      tabs: function () { return this.isOwner ? OWNER_TABS : TABS; },
      route: function () {
        var r = route.value;
        return this.isOwner && OWNER_ROUTES.indexOf(r) < 0 ? 'home' : r;
      },
      isSub: function () { return SUBS.indexOf(this.route) >= 0; },
      garage: function () { return this.s.session ? this.s.session.garage : null; },
      user: function () { return this.s.session ? this.s.session.user : null; },
      title: function () { return this.isSub ? this.$t('title.' + this.route) : (this.garage ? this.garage.name : ''); },
      chip: function () {
        var st = this.s.sync;
        if (st.state === 'syncing') return { cls: 'syncing', text: this.$t('sync.syncing') };
        if (st.state === 'offline' || !this.s.online) return { cls: 'offline', text: st.pending ? this.$n(st.pending) : this.$t('sync.offline').split(',')[0] };
        if (st.state === 'expired') return { cls: 'expired', text: this.$t('sub.expired') };
        if (st.state === 'error') return { cls: 'error', text: this.$t('sync.error') };
        if (st.pending) return { cls: 'pending', text: this.$n(st.pending) };
        return { cls: 'ok', text: '' };
      },
      banner: function () {
        var g = this.garage;
        if (!g || this.isOwner) return null; // subscription notices are for the garage staff
        if (g.status === 'expired') return { kind: 'bad', text: this.$t('banner.expired') };
        if (g.days_left !== null && g.days_left <= 5) {
          if (g.status === 'trial') return { kind: 'warn', text: g.days_left <= 0 ? this.$t('banner.trialLast') : this.$t('banner.trial', { n: this.$n(g.days_left) }) };
          if (g.status === 'active') return { kind: 'warn', text: this.$t('banner.soon', { n: this.$n(Math.max(g.days_left, 0)) }) };
        }
        return null;
      },
      update: function () {
        var s = this.s.session && this.s.session.settings;
        if (!s || !RM.api.isNative() || !s.app_apk_url) return null;
        var mine = RM_CONFIG.BUILD || 0;
        if ((s.app_build || 0) <= mine) return null;
        return { url: s.app_apk_url, notes: s.app_notes, force: (s.app_min_build || 0) > mine };
      },
      announcement: function () {
        var a = this.s.session && this.s.session.settings && this.s.session.settings.announcement;
        return a && !this.s.announcementHidden ? a : '';
      },
    },
    methods: {
      go: function (n) { RM.go(n); },
      back: function () { history.back(); },
      syncNow: function () { RM.sync.run(); },
      logout: function () { RM.auth.logout(); },
      toggleMode: function () {
        RM.setMode(RM.isOwnerRole() ? 'garage' : 'owner');
        RM.go('home');
      },
      doUpdate: function () { window.open(this.update.url, '_blank'); },
    },
    template: '<div class="root">' +
      '<div v-if="!s.ready" class="boot"><div class="spinner"></div></div>' +
      '<page-auth v-else-if="!s.session"/>' +
      '<div v-else-if="update && update.force" class="blocked-screen upd"><ic name="sync" :size="48"/><h2>{{ $t(\'update.required\') }}</h2>' +
      '<p>{{ update.notes || $t(\'update.requiredText\') }}</p><button class="btn primary" @click="doUpdate">{{ $t(\'update.now\') }}</button></div>' +
      '<div v-else-if="s.blocked" class="blocked-screen"><ic name="shield" :size="48"/><h2>{{ $t(\'blocked.title\') }}</h2>' +
      '<p>{{ s.blocked.trim() || $t(\'blocked.text\') }}</p><button class="btn primary" @click="logout">{{ $t(\'settings.logout\') }}</button></div>' +
      '<div v-else class="app">' +
      '<header class="topbar"><button v-if="isSub" class="icon-btn light" @click="back" :aria-label="$t(\'common.prev\')"><ic name="left" :size="22"/></button>' +
      '<avatar v-if="!isSub && user" class="tb-avatar" :id="user.avatar_id" :name="user.name" :size="38"/>' +
      '<div class="tb-title"><b>{{ title }}</b><small v-if="!isSub && user">{{ $t(\'role.\' + (isOwner ? \'owner\' : user.role)) }} · {{ user.name }}</small></div>' +
      '<button v-if="canSwitch" class="mode-btn" :class="{on: isOwner}" @click="toggleMode"><ic name="rickshaw" :size="16"/><span>{{ isOwner ? $t(\'mode.backToGarage\') : $t(\'mode.myRickshaws\') }}</span></button>' +
      '<button class="sync-chip" :class="chip.cls" @click="syncNow"><i></i><span v-if="chip.text">{{ chip.text }}</span></button></header>' +
      '<div v-if="update" class="banner info"><ic name="sync" :size="16"/> <span>{{ $t(\'update.new\') }}<template v-if="update.notes"> — {{ update.notes }}</template></span><button class="mini pri" @click="doUpdate">{{ $t(\'update.now\') }}</button></div>' +
      '<div v-if="banner" class="banner" :class="banner.kind"><ic name="alert" :size="16"/> {{ banner.text }}</div>' +
      '<div v-if="announcement" class="banner info"><ic name="info" :size="16"/> <span>{{ announcement }}</span><button class="icon-btn light" @click="s.announcementHidden = true"><ic name="x" :size="16"/></button></div>' +
      '<main class="content"><component :is="\'page-\' + route" :key="route"/></main>' +
      '<nav class="tabbar"><button v-for="t in tabs" :key="t" class="tab" :class="{on: route === t || (t === \'more\' && isSub)}" @click="go(t)">' +
      '<ic :name="icons[t]" :size="22"/><span>{{ $t(\'nav.\' + t) }}</span></button></nav>' +
      '</div>' +
      '<div v-if="$ui.toast" class="toast" :class="$ui.toastKind">{{ $ui.toast }}</div>' +
      '<confirm-dialog/>' +
      '<div v-if="$ui.lightbox" class="lightbox" @click="$ui.lightbox = \'\'"><img :src="$ui.lightbox" alt=""></div>' +
      '</div>',
  };

  var app = Vue.createApp(App);
  var G = app.config.globalProperties;
  G.$t = function (k, p) { return RM.t(k, p); };
  G.$m = function (n) { return U.money(n, RM.state.lang); };
  G.$n = function (n) { return U.num(n, RM.state.lang); };
  G.$d = function (s, style) { return U.date(s, RM.state.lang, style); };
  G.$dt = function (iso) { return U.dateTime(iso, RM.state.lang); };
  G.$time = function (s) { return U.time(s, RM.state.lang); };
  G.$U = U;
  G.$can = RM.can;
  G.$opts = RM.opts;
  G.$go = RM.go;
  G.$ui = RM.ui;
  G.$isAdmin = RM.isAdmin;
  // In the ledger the net is what the rickshaw owner gets; owners just call it their net.
  G.$netLabel = function () { return RM.t(RM.isOwnerRole() ? 'entry.net' : 'entry.ownerNet'); };
  G.$isOwner = RM.isOwnerRole;

  RM.installUi(app);
  RM.installFiles(app);
  RM.installCharts(app);
  RM.installSheets(app);
  RM.installers.forEach(function (fn) { fn(app); });

  app.mount('#app');
  RM.init().catch(function (e) {
    console.error(e);
    RM.state.ready = true;
  });

  // Keep the document title in the active language.
  Vue.watch(function () { return RM.state.lang; }, function () { document.title = RM.t('app.name'); }, { immediate: true });
})();
