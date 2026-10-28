// "More" menu, activity log and settings.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data;

  RM.installers.push(function (app) {
    app.component('sub-card', {
      computed: {
        g: function () { return RM.state.session.garage; },
        s: function () { return RM.state.session.settings || {}; },
      },
      template: '<div class="card sub" :class="g.status">' +
        '<div class="sub-top"><ic name="shield" :size="20"/><b>{{ $t(\'sub.title\') }}</b><span class="tag" :class="g.status === \'active\' ? \'free\' : g.status === \'trial\' ? \'occupied\' : \'blocked\'">{{ $t(\'sub.\' + g.status) }}</span></div>' +
        '<div class="sub-grid"><div><span>{{ $t(\'sub.plan\') }}</span><b>{{ g.plan ? g.plan.name : $t(\'sub.trialPlan\') }}</b></div>' +
        '<div v-if="g.ends_at"><span>{{ $t(\'sub.ends\') }}</span><b>{{ $d(g.ends_at.slice(0, 10)) }}</b></div>' +
        '<div v-if="g.days_left !== null"><span>{{ $t(\'sub.daysLeft\') }}</span><b>{{ g.days_left > 0 ? $n(g.days_left) : 0 }}</b></div></div>' +
        '<p v-if="g.plan && (g.plan.max_rickshaws || g.plan.max_users)" class="muted small">{{ $t(\'sub.limits\') }}: ' +
        '<template v-if="g.plan.max_rickshaws">{{ $n(g.plan.max_rickshaws) }} {{ $t(\'setup.rickshawsCount\') }}</template>' +
        '<template v-if="g.plan.max_users"> · {{ $n(g.plan.max_users) }} {{ $t(\'sub.users\') }}</template></p>' +
        '<p v-if="g.status === \'expired\'" class="note warn"><ic name="alert" :size="16"/> {{ $t(\'sub.expiredText\') }}</p>' +
        '<p v-if="s.support_phone" class="muted small"><ic name="phone" :size="14"/> {{ $t(\'sub.contact\') }}: <a :href="\'tel:\' + s.support_phone">{{ s.support_phone }}</a></p>' +
        '</div>',
    });

    app.component('page-more', {
      computed: {
        user: function () { return RM.state.session.user; },
        garage: function () { return RM.state.session.garage; },
        items: function () {
          if (RM.isOwnerRole()) return [
            { to: 'dues', icon: 'wallet', t: 'more.dues', d: 'more.duesDesc' },
            { to: 'settings', icon: 'sliders', t: 'more.settings', d: 'more.settingsDesc' },
          ];
          return [
            { to: 'setup', icon: 'rickshaw', t: 'more.setup', d: 'more.setupDesc' },
            { to: 'dues', icon: 'clock', t: 'more.dues', d: 'more.duesDesc' },
            { to: 'expenses', icon: 'wallet', t: 'more.expenses', d: 'more.expensesDesc' },
            { to: 'logs', icon: 'activity', t: 'more.logs', d: 'more.logsDesc' },
            { to: 'settings', icon: 'sliders', t: 'more.settings', d: 'more.settingsDesc' },
          ];
        },
      },
      template: '<div class="page">' +
        '<div class="card profile"><avatar :id="user.avatar_id" :name="user.name" :size="56"/>' +
        '<div><b>{{ user.name }}</b><span class="muted">{{ garage.name }}</span><span class="tag" :class="user.role === \'admin\' ? \'occupied\' : \'free\'">{{ $t(\'role.\' + user.role) }}</span></div></div>' +
        '<sub-card v-if="!$isOwner()"/>' +
        '<div class="menu"><button v-for="i in items" :key="i.to" class="menu-item" @click="$go(i.to)">' +
        '<span class="mi-ic"><ic :name="i.icon" :size="22"/></span><span class="mi-t"><b>{{ $t(i.t) }}</b><small>{{ $t(i.d) }}</small></span><ic name="right" :size="18"/></button></div>' +
        '</div>',
    });

    /* ---------------- activity log ---------------- */
    app.component('page-logs', {
      data: function () { return { logs: [], loading: false, more: false, err: '', entity: '', open: {} }; },
      mounted: function () { this.load(true); },
      computed: {
        entities: function () {
          return [{ v: '', l: this.$t('common.all') }].concat(['entries', 'assignments', 'rickshaws', 'drivers', 'owners', 'garage_expenses'].map(function (k) {
            return { v: k, l: RM.t('ent.' + k) };
          }));
        },
      },
      watch: { entity: function () { this.load(true); } },
      methods: {
        load: function (reset) {
          var self = this;
          if (this.loading) return;
          this.loading = true; this.err = '';
          var q = '?limit=40' + (this.entity ? '&entity=' + this.entity : '') + (!reset && this.logs.length ? '&before=' + this.logs[this.logs.length - 1].id : '');
          RM.api.get('/logs' + q).then(function (r) {
            self.logs = reset ? r.logs : self.logs.concat(r.logs);
            self.more = r.more;
          }).catch(function (e) {
            self.err = e.offline ? self.$t('logs.needOnline') : e.message;
          }).then(function () { self.loading = false; });
        },
        valueText: function (field, v) {
          if (v === null || v === undefined || v === '') return '—';
          if (/_id$/.test(field)) {
            var map = { rickshaw_id: ['rickshaws', 'number'], driver_id: ['drivers', 'name'], owner_id: ['owners', 'name'] }[field];
            var row = map && D.get(map[0], v);
            return row ? row[map[1]] : '…';
          }
          if (typeof v === 'boolean' || field === 'is_active' || field === 'is_self') return v ? this.$t('common.yes') : this.$t('common.no');
          if (['deposit', 'expense', 'garage_charge', 'default_rent', 'default_charge', 'expected_rent', 'amount'].indexOf(field) >= 0) return this.$m(Number(v));
          if (field === 'expense_type') return this.$t('exp.' + v);
          if (field === 'category') return this.$t('cat.' + v);
          if (field === 'status') return this.$t('status.' + v);
          if (/_date$/.test(field)) return this.$d(v);
          if (/_time$/.test(field)) return this.$time(v);
          return String(v);
        },
        diff: function (l) {
          var self = this, c = l.changes || {};
          return Object.keys(c).map(function (k) {
            var isPair = l.action === 'update';
            return { k: k, label: self.$t('field.' + k), from: isPair ? self.valueText(k, c[k][0]) : null, to: self.valueText(k, isPair ? c[k][1] : c[k]) };
          });
        },
        labelText: function (l) {
          var lab = l.label || '';
          if (l.entity === 'garage_expenses') {
            var p = lab.split(' ');
            if (['rent', 'electricity', 'tools', 'security', 'salary', 'other'].indexOf(p[0]) >= 0) return this.$t('cat.' + p[0]) + (p[1] ? ' ' + this.$m(Number(p[1])) : '');
          }
          if (l.entity === 'entries' && /^\d{4}-\d{2}-\d{2} · /.test(lab)) return this.$d(lab.slice(0, 10)) + lab.slice(10);
          return lab;
        },
        toggle: function (id) { this.open[id] = !this.open[id]; },
      },
      template: '<div class="page">' +
        '<div class="seg-scroll"><button v-for="o in entities" :key="o.v" class="seg" :class="{on: entity === o.v}" @click="entity = o.v">{{ o.l }}</button></div>' +
        '<p v-if="err" class="note warn"><ic name="alert" :size="16"/> {{ err }}</p>' +
        '<empty v-if="!logs.length && !loading && !err" icon="activity" :text="$t(\'logs.none\')"/>' +
        '<div v-for="l in logs" :key="l.id" class="log" @click="toggle(l.id)">' +
        '<div class="log-ic" :class="l.action"><ic :name="l.action === \'create\' ? \'plus\' : l.action === \'delete\' ? \'trash\' : \'edit\'" :size="16"/></div>' +
        '<div class="log-body"><div><b>{{ l.user_name }}</b> {{ $t(\'logs.\' + l.action) }} <span class="tag soft">{{ $t(\'ent.\' + l.entity) }}</span></div>' +
        '<div class="log-label">{{ labelText(l) }}</div><small class="muted">{{ $dt(l.at) }}</small>' +
        '<div v-if="open[l.id] && diff(l).length" class="diff"><div v-for="d in diff(l)" :key="d.k"><span>{{ d.label }}</span>' +
        '<template v-if="d.from !== null"><s>{{ d.from }}</s> → <b>{{ d.to }}</b></template><b v-else>{{ d.to }}</b></div></div></div></div>' +
        '<p v-if="loading" class="muted center-t">{{ $t(\'common.loading\') }}</p>' +
        '<button v-if="more && !loading" class="btn soft block" @click="load(false)">{{ $t(\'logs.more\') }}</button>' +
        '</div>',
    });

    /* ---------------- settings ---------------- */
    app.component('page-settings', {
      data: function () { return { sheet: '', server: RM.util.ls.get('rm_server') || '' }; },
      computed: {
        s: function () { return RM.state; },
        user: function () { return RM.state.session.user; },
        garage: function () { return RM.state.session.garage; },
        native: function () { return RM.api.isNative(); },
        version: function () { return RM_CONFIG.VERSION; },
        fields: function () {
          var t = this.$t.bind(this);
          if (this.sheet === 'name') return [{ key: 'name', label: t('setup.name'), req: true }];
          if (this.sheet === 'password') return [
            { key: 'current_password', label: t('settings.currentPassword'), type: 'password', req: true },
            { key: 'password', label: t('settings.newPassword'), type: 'password', req: true, hint: t('auth.passwordHint') },
          ];
          if (this.sheet === 'garage') return [
            { key: 'name', label: t('settings.garageName'), req: true },
            { key: 'phone', label: t('setup.phone'), type: 'tel' },
            { key: 'address', label: t('setup.address') },
          ];
          return [];
        },
        initial: function () {
          if (this.sheet === 'name') return { name: this.user.name };
          if (this.sheet === 'garage') return { name: this.garage.name, phone: this.garage.phone, address: this.garage.address };
          return {};
        },
        syncText: function () {
          var st = this.s.sync;
          if (st.state === 'syncing') return this.$t('sync.syncing');
          if (st.state === 'offline') return this.$t('sync.offline');
          if (st.state === 'expired') return this.$t('sync.expired');
          if (st.state === 'error') return this.$t('sync.error') + (st.error ? ': ' + st.error : '');
          return st.pending ? this.$t('sync.pending', { n: this.$n(st.pending) }) : this.$t('sync.ok');
        },
      },
      methods: {
        setLang: function (l) { RM.setLang(l); },
        save: function (v) {
          var self = this, sheet = this.sheet, p;
          if (sheet === 'password' && v.password.length < 6) { RM.toast(this.$t('auth.passwordHint'), 'err'); return; }
          if (sheet === 'name') p = RM.api.put('/me', { name: v.name }).then(function (r) { return RM.auth.setSession(r); });
          else if (sheet === 'password') p = RM.api.put('/me/password', { current_password: v.current_password, password: v.password });
          else p = RM.api.put('/garage', { name: v.name, phone: v.phone, address: v.address }).then(function (r) { RM.auth.setGarage(r.garage); });
          p.then(function () { RM.toast(self.$t('common.saved'), 'ok'); self.sheet = ''; })
            .catch(function (e) { RM.toast(e.offline ? self.$t('staff.needOnline') : e.code === 'bad_credentials' ? self.$t('settings.wrongPassword') : e.message, 'err'); });
        },
        syncNow: function () { RM.sync.run(); },
        /** Own profile picture: needs the internet, because the server must hold it before it is attached. */
        /** Own profile picture, any time (also offline): it shows at once and reaches the server on the next sync. */
        setPhoto: function (ev) {
          var self = this, f = ev.target.files && ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          RM.files.compress(f, 'avatar').then(function (blob) {
            RM.queueAvatar(RM.files.add(blob, 'avatar'));
            RM.toast(self.$t(navigator.onLine ? 'common.saved' : 'photo.savedOffline'), 'ok');
          }).catch(function () { RM.toast(self.$t('photo.failed'), 'err'); });
        },
        removePhoto: function () {
          RM.queueAvatar(null);
          RM.toast(this.$t('common.saved'), 'ok');
        },
        saveServer: function () {
          var v = this.server.trim().replace(/\/+$/, '');
          if (v) RM.util.ls.set('rm_server', v); else RM.util.ls.del('rm_server');
          RM.toast(this.$t('common.saved'), 'ok');
        },
        logout: function () {
          var n = RM.state.sync.pending, self = this;
          RM.confirm(n ? this.$t('settings.logoutPending', { n: this.$n(n) }) : this.$t('settings.logoutAsk'), { danger: true, ok: this.$t('settings.logout') })
            .then(function (ok) { if (ok) RM.auth.logout().then(function () { RM.go('home'); }); });
        },
      },
      template: '<div class="page">' +
        '<div class="card"><h4>{{ $t(\'settings.language\') }}</h4><div class="seg-row">' +
        '<button class="seg" :class="{on: s.lang === \'bn\'}" @click="setLang(\'bn\')">বাংলা</button>' +
        '<button class="seg" :class="{on: s.lang === \'en\'}" @click="setLang(\'en\')">English</button></div></div>' +

        '<sub-card v-if="!$isOwner()"/>' +

        '<div class="card"><h4>{{ $t(\'settings.account\') }}</h4>' +
        '<div class="my-photo"><avatar :id="user.avatar_id" :name="user.name" :size="76"/><div class="photo-btns">' +
        '<label class="btn soft sm"><ic name="camera" :size="16"/> {{ $t(\'photo.camera\') }}<input type="file" accept="image/*" capture="user" @change="setPhoto" hidden></label>' +
        '<label class="btn soft sm"><ic name="image" :size="16"/> {{ $t(\'photo.gallery\') }}<input type="file" accept="image/*" @change="setPhoto" hidden></label>' +
        '<button v-if="user.avatar_id" class="btn danger-o sm" @click="removePhoto"><ic name="trash" :size="16"/></button></div></div>' +
        '<button class="list-btn" @click="sheet = \'name\'"><span>{{ $t(\'setup.name\') }}</span><b>{{ user.name }}</b></button>' +
        '<div class="list-btn static"><span>{{ $t(\'auth.login\') }}</span><b>{{ user.login }}</b></div>' +
        '<button class="list-btn" @click="sheet = \'password\'"><span>{{ $t(\'settings.changePassword\') }}</span><ic name="right" :size="18"/></button>' +
        '<button v-if="user.role === \'admin\'" class="list-btn" @click="sheet = \'garage\'"><span>{{ $t(\'settings.garageInfo\') }}</span><b>{{ garage.name }}</b></button></div>' +

        '<div class="card"><h4>{{ $t(\'settings.sync\') }}</h4>' +
        '<p class="sync-line"><i class="sync-dot" :class="s.sync.state"></i>{{ syncText }}</p>' +
        '<p v-if="s.sync.last" class="muted small">{{ $t(\'sync.last\') }}: {{ $dt(new Date(s.sync.last).toISOString()) }}</p>' +
        '<button class="btn soft block" @click="syncNow"><ic name="sync" :size="18"/> {{ $t(\'sync.now\') }}</button></div>' +

        '<div class="card" v-if="native"><h4>{{ $t(\'settings.server\') }}</h4>' +
        '<input type="url" v-model="server" placeholder="https://example.com"><button class="btn soft block" @click="saveServer">{{ $t(\'common.save\') }}</button></div>' +

        '<button class="btn danger-o block" @click="logout"><ic name="logout" :size="18"/> {{ $t(\'settings.logout\') }}</button>' +
        '<p class="muted center-t small">{{ $t(\'app.name\') }} · v{{ version }}</p>' +

        '<form-sheet v-if="sheet" :key="sheet" :title="$t(\'settings.edit_\' + sheet)" :fields="fields" :initial="initial" @save="save" @close="sheet = \'\'"/>' +
        '</div>',
    });
  });
})();
