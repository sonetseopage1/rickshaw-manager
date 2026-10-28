// Setup: rickshaws, drivers, owners and staff (managers / admins).
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.setupTab = 'rickshaws';

  RM.installers.push(function (app) {
    app.component('page-setup', {
      data: function () { return { form: null, users: [], usersLoading: false, usersErr: '' }; },
      computed: {
        tab: {
          get: function () { return RM.state.setupTab; },
          set: function (v) { RM.state.setupTab = v; if (v === 'staff') this.loadUsers(); },
        },
        tabs: function () {
          var t = ['rickshaws', 'drivers', 'owners'];
          if (RM.isAdmin()) t.push('staff');
          return t;
        },
        owners: function () { return D.list('owners').slice().sort(function (a, b) { return U.natural(a.name, b.name); }); },
        drivers: function () { return D.list('drivers').slice().sort(function (a, b) { return U.natural(a.name, b.name); }); },
        rickshaws: function () { return B.rickshaws(); },
        hasSelfOwner: function () { return D.list('owners').some(function (o) { return o.is_self; }); },
        ownerOptions: function () {
          return [{ v: '', l: this.$t('setup.noOwner') }].concat(this.owners.map(function (o) { return { v: o.id, l: o.name }; }));
        },
        fields: function () {
          var t = this.$t.bind(this), f = this.form && this.form.kind;
          if (f === 'rickshaw') return [
            { key: 'number', label: t('setup.rNumber'), req: true, placeholder: 'R-01' },
            { key: 'owner_id', label: t('setup.owner'), type: 'select', options: this.ownerOptions },
            { key: 'default_rent', label: t('setup.defRent'), type: 'number', hint: t('setup.defRentHint') },
            { key: 'default_charge', label: t('setup.defCharge'), type: 'number', hint: t('setup.defChargeHint') },
            { key: 'status', label: t('setup.status'), type: 'chips', options: this.$opts.statuses(), def: 'active' },
            { key: 'note', label: t('entry.note'), type: 'textarea' },
          ].concat(this.form.item ? [] : [
            { key: 'count', label: t('setup.bulkCount'), type: 'number', hint: t('setup.bulkHint') },
          ]);
          if (f === 'driver') return [
            { key: 'name', label: t('setup.name'), req: true },
            { key: 'phone', label: t('setup.phone'), type: 'tel' },
            { key: 'nid', label: t('setup.nid') },
            { key: 'address', label: t('setup.address') },
            { key: 'note', label: t('entry.note'), type: 'textarea' },
            { key: 'is_active', label: t('setup.active'), type: 'switch', def: true },
          ];
          if (f === 'owner') return [
            { key: 'name', label: t('setup.name'), req: true },
            { key: 'phone', label: t('setup.phone'), type: 'tel' },
            { key: 'address', label: t('setup.address') },
            { key: 'note', label: t('entry.note'), type: 'textarea' },
          ].concat(this.form.item || !RM.isAdmin() ? [] : [
            { key: 'login', label: t('setup.loginOptional'), hint: t('setup.loginOptionalHint') },
            { key: 'password', label: t('auth.password'), type: 'password', hint: t('auth.passwordHint'),
              show: function (f) { return !!(f.login && String(f.login).trim()); } },
          ]);
          if (f === 'staff') {
            var edit = this.form.item;
            return [
              { key: 'name', label: t('setup.name'), req: true },
              { key: 'login', label: t('auth.login'), req: !edit, hint: edit ? t('staff.loginFixed') : t('auth.loginHint') },
              { key: 'password', label: edit ? t('staff.newPassword') : t('auth.password'), req: !edit, hint: t('auth.passwordHint') },
              { key: 'role', label: t('staff.role'), type: 'chips', def: 'manager',
                show: function () { return !edit || edit.role !== 'owner'; },
                options: [{ v: 'manager', l: t('role.manager') }, { v: 'admin', l: t('role.admin') }].concat(edit ? [] : [{ v: 'owner', l: t('role.owner') }]) },
              { key: 'owner_ref', label: t('staff.pickOwner'), type: 'select', hint: t('staff.ownerHint'),
                show: function (f) { return !edit && f.role === 'owner'; },
                options: [{ v: '', l: t('common.choose') }].concat(this.owners.map(function (o) { return { v: o.id, l: o.name }; })) },
            ].concat(edit ? [{ key: 'is_blocked', label: t('staff.blocked'), type: 'switch' }] : []);
          }
          return [];
        },
        formTitle: function () {
          if (!this.form) return '';
          return this.$t((this.form.item ? 'setup.edit_' : 'setup.new_') + this.form.kind);
        },
      },
      mounted: function () { if (this.tab === 'staff' || RM.isAdmin()) this.loadUsers(); },
      methods: {
        ownerOf: function (r) { return B.ownerName(r.owner_id); },
        rickshawCount: function (o) { return this.rickshaws.filter(function (r) { return r.owner_id === o.id; }).length; },
        open: function (kind, item, preset) { this.form = { kind: kind, item: item || null, preset: preset || null }; },
        hasLogin: function (o) { return this.users.some(function (u) { return u.owner_ref === o.id; }); },
        ownerLogin: function (o) { this.open('staff', null, { role: 'owner', owner_ref: o.id, name: o.name }); },
        ownerNameOf: function (u) { return u.owner_ref ? B.ownerName(u.owner_ref) : ''; },
        canEdit: function (table) { return RM.can(table, 'update'); },
        canAdd: function (table) { return RM.can(table, 'create'); },
        initial: function () {
          var it = this.form && this.form.item;
          if (!it) return (this.form && this.form.preset) || {};
          if (this.form.kind === 'staff') return { name: it.name, login: it.login, role: it.role, is_blocked: it.is_blocked };
          return it;
        },
        addSelf: function () {
          D.save('owners', { name: RM.state.session.user.name, is_self: true });
          RM.toast(this.$t('setup.selfAdded'), 'ok');
        },
        save: function (v) {
          var kind = this.form.kind, item = this.form.item;
          if (kind === 'staff') return this.saveStaff(v);
          var table = kind + 's';
          if (kind === 'rickshaw') {
            var count = !item && v.count ? Math.min(Math.floor(v.count), 60) : 1;
            delete v.count;
            var names = [];
            for (var i = 1; i <= count; i++) names.push(count > 1 ? v.number + '-' + U.num(i, RM.state.lang) : v.number);
            var taken = this.rickshaws.map(function (r) { return r.number.toLowerCase(); });
            var clash = names.some(function (nm) { return taken.indexOf(nm.toLowerCase()) >= 0 && !(item && item.number.toLowerCase() === nm.toLowerCase()); });
            if (clash) { RM.toast(this.$t('setup.dupRickshaw'), 'err'); return; }
            v.owner_id = v.owner_id || null;
            v.status = v.status || 'active';
            if (count > 1) {
              names.forEach(function (nm) { D.save('rickshaws', Object.assign({}, v, { number: nm })); });
              RM.toast(this.$t('common.saved'), 'ok');
              this.form = null;
              return;
            }
          }
          if (item) v.id = item.id;
          if (kind === 'owner' && !item) {
            var login = (v.login || '').trim(), pw = v.password || '';
            delete v.login; delete v.password;
            if (login) {
              if (login.length < 4 || pw.length < 6) { RM.toast(this.$t('auth.fillAll'), 'err'); return; }
              return this.saveOwnerWithLogin(v, login, pw);
            }
          }
          delete v.login; delete v.password;
          D.save(table, v);
          RM.toast(this.$t('common.saved'), 'ok');
          this.form = null;
        },
        /** New owner plus a read-only login in one go. The owner must reach the server first. */
        saveOwnerWithLogin: function (v, login, pw) {
          var self = this;
          var row = D.save('owners', v);
          this.form = null;
          RM.toast(this.$t('common.saved'), 'ok');
          return RM.sync.run().then(function () {
            return RM.api.post('/users', { name: v.name, login: login, password: pw, role: 'owner', owner_ref: row.id });
          }).then(function () {
            RM.toast(self.$t('setup.ownerAndLogin'), 'ok');
            self.loadUsers();
          }).catch(function (e) {
            var msg = e.offline ? self.$t('setup.loginLater')
              : (e.data && e.data.errors && e.data.errors.login) ? self.$t('staff.loginTaken')
              : e.data && e.data.errors && e.data.errors.owner_ref ? self.$t('setup.loginLater')
              : e.message;
            RM.toast(msg, 'err');
          });
        },
        remove: function () {
          var self = this, kind = this.form.kind, item = this.form.item;
          if (kind === 'staff') return this.deleteStaff(item);
          RM.confirm(this.$t('setup.deleteAsk_' + kind), { danger: true, ok: this.$t('common.delete') }).then(function (ok) {
            if (!ok) return;
            D.remove(kind + 's', item.id);
            RM.toast(self.$t('common.deleted'));
            self.form = null;
          });
        },
        /* ---- staff (online only, handled by the server) ---- */
        loadUsers: function () {
          var self = this;
          this.usersLoading = true; this.usersErr = '';
          RM.api.get('/users').then(function (r) { self.users = r.users; })
            .catch(function (e) { self.usersErr = e.offline ? self.$t('staff.needOnline') : e.message; })
            .then(function () { self.usersLoading = false; });
        },
        saveStaff: function (v) {
          var self = this, item = this.form.item;
          var body = { name: v.name };
          if (!item) {
            body.role = v.role || 'manager';
            if (body.role === 'owner') {
              if (!v.owner_ref) { RM.toast(this.$t('staff.pickOwner'), 'err'); return; }
              body.owner_ref = v.owner_ref;
            }
          } else if (item.role !== 'owner') body.role = v.role || item.role;
          if (v.password) body.password = v.password;
          if (item) body.is_blocked = !!v.is_blocked;
          else { body.login = v.login; body.password = v.password; }
          if (body.password && body.password.length < 6) { RM.toast(this.$t('auth.passwordHint'), 'err'); return; }
          var p = item ? RM.api.put('/users/' + item.id, body) : RM.api.post('/users', body);
          p.then(function () {
            RM.toast(self.$t('common.saved'), 'ok');
            self.form = null;
            self.loadUsers();
          }).catch(function (e) {
            var msg = e.offline ? self.$t('staff.needOnline')
              : (e.data && e.data.errors && e.data.errors.login) ? self.$t('staff.loginTaken')
              : e.code === 'last_admin' ? self.$t('staff.lastAdmin')
              : e.code === 'plan_limit' ? self.$t('staff.planLimit')
              : e.message;
            RM.toast(msg, 'err');
          });
        },
        deleteStaff: function (item) {
          var self = this;
          RM.confirm(this.$t('staff.deleteAsk', { name: item.name }), { danger: true, ok: this.$t('common.delete') }).then(function (ok) {
            if (!ok) return;
            RM.api.del('/users/' + item.id).then(function () {
              RM.toast(self.$t('common.deleted'));
              self.form = null;
              self.loadUsers();
            }).catch(function (e) {
              RM.toast(e.offline ? self.$t('staff.needOnline') : e.code === 'last_admin' ? self.$t('staff.lastAdmin') : e.message, 'err');
            });
          });
        },
      },
      template: '<div class="page">' +
        '<div class="seg-scroll"><button v-for="k in tabs" :key="k" class="seg" :class="{on: tab === k}" @click="tab = k">{{ $t(\'setup.tab_\' + k) }}</button></div>' +

        '<template v-if="tab === \'rickshaws\'">' +
        '<empty v-if="!rickshaws.length" icon="rickshaw" :text="$t(\'setup.noRickshaws\')"/>' +
        '<div v-for="r in rickshaws" :key="r.id" class="row-card" @click="canEdit(\'rickshaws\') && open(\'rickshaw\', r)">' +
        '<div class="rc-main"><b>{{ r.number }}</b><span class="muted">{{ ownerOf(r) || $t(\'setup.noOwner\') }}</span></div>' +
        '<div class="rc-side"><span class="tag" :class="r.status === \'active\' ? \'free\' : r.status">{{ $t(\'status.\' + r.status) }}</span>' +
        '<small v-if="r.default_rent" class="muted">{{ $t(\'setup.rent\') }} {{ $m(r.default_rent) }}</small></div></div></template>' +

        '<template v-if="tab === \'drivers\'">' +
        '<empty v-if="!drivers.length" icon="user" :text="$t(\'setup.noDrivers\')"/>' +
        '<div v-for="d in drivers" :key="d.id" class="row-card" :class="{dim: d.is_active === false}" @click="canEdit(\'drivers\') && open(\'driver\', d)">' +
        '<div class="rc-main"><b>{{ d.name }}</b><span class="muted">{{ d.phone }}</span></div>' +
        '<div class="rc-side"><span v-if="d.is_active === false" class="tag inactive">{{ $t(\'setup.inactive\') }}</span></div></div></template>' +

        '<template v-if="tab === \'owners\'">' +
        '<button v-if="$can(\'owners\', \'create\') && !hasSelfOwner" class="btn soft block" @click="addSelf"><ic name="star" :size="18"/> {{ $t(\'setup.addSelf\') }}</button>' +
        '<empty v-if="!owners.length" icon="users" :text="$t(\'setup.noOwners\')"/>' +
        '<div v-for="o in owners" :key="o.id" class="row-card" @click="canEdit(\'owners\') && open(\'owner\', o)">' +
        '<div class="rc-main"><b>{{ o.name }} <span v-if="o.is_self" class="tag free">{{ $t(\'setup.me\') }}</span></b><span class="muted">{{ o.phone }}</span></div>' +
        '<div class="rc-side"><small class="muted">{{ $n(rickshawCount(o)) }} {{ $t(\'setup.rickshawsCount\') }}</small>' +
        '<span v-if="hasLogin(o)" class="tag free">{{ $t(\'staff.hasLogin\') }}</span>' +
        '<button v-else-if="$isAdmin()" class="mini" @click.stop="ownerLogin(o)"><ic name="key" :size="14"/> {{ $t(\'staff.ownerLogin\') }}</button></div></div></template>' +

        '<template v-if="tab === \'staff\'">' +
        '<p v-if="usersLoading" class="muted center-t">{{ $t(\'common.loading\') }}</p>' +
        '<p v-if="usersErr" class="note warn"><ic name="alert" :size="16"/> {{ usersErr }}</p>' +
        '<div v-for="u in users" :key="u.id" class="row-card" :class="{dim: u.is_blocked}" @click="open(\'staff\', u)">' +
        '<div class="rc-main"><b>{{ u.name }}</b><span class="muted">{{ u.login }}<template v-if="u.role === \'owner\'"> · {{ ownerNameOf(u) }}</template></span></div>' +
        '<div class="rc-side"><span class="tag" :class="u.role === \'admin\' ? \'occupied\' : u.role === \'owner\' ? \'maintenance\' : \'free\'">{{ $t(\'role.\' + u.role) }}</span>' +
        '<span v-if="u.is_blocked" class="tag blocked">{{ $t(\'staff.blocked\') }}</span></div></div></template>' +

        '<button v-if="tab === \'rickshaws\' && canAdd(\'rickshaws\')" class="fab" @click="open(\'rickshaw\')"><ic name="plus" :size="26"/></button>' +
        '<button v-if="tab === \'drivers\' && canAdd(\'drivers\')" class="fab" @click="open(\'driver\')"><ic name="plus" :size="26"/></button>' +
        '<button v-if="tab === \'owners\' && canAdd(\'owners\')" class="fab" @click="open(\'owner\')"><ic name="plus" :size="26"/></button>' +
        '<button v-if="tab === \'staff\'" class="fab" @click="open(\'staff\')"><ic name="plus" :size="26"/></button>' +

        '<form-sheet v-if="form" :key="form.kind + (form.item ? form.item.id : \'new\')" :title="formTitle" :fields="fields" :initial="initial()" ' +
        ':can-delete="!!form.item && (form.kind === \'staff\' || $can(form.kind + \'s\', \'delete\'))" @save="save" @delete="remove" @close="form = null"/>' +
        '</div>',
    });
  });
})();
