// Accounts: every daily entry with filters and totals.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.entFilter = { period: 'today', from: U.today(), to: U.today(), rickshaw: '', driver: '', owner: '' };

  /** Resolve a period key into [from, to]. Shared with the reports page. */
  RM.periodRange = function (p, from, to) {
    var t = U.today();
    switch (p) {
      case 'today': return [t, t];
      case 'yesterday': var y = U.addDays(t, -1); return [y, y];
      case 'week': return [U.weekStart(t), t];
      case 'month': return [U.monthStart(t), t];
      case 'lastmonth': var lm = U.addMonths(U.monthStart(t), -1); return [lm, U.monthEnd(lm)];
      case '30': return [U.addDays(t, -29), t];
      case 'year': return [t.slice(0, 4) + '-01-01', t];
      default: return [from || t, to || t];
    }
  };

  RM.installers.push(function (app) {
    app.component('period-bar', {
      props: { period: String, from: String, to: String, keys: Array },
      emits: ['update:period', 'update:from', 'update:to'],
      template: '<div><div class="seg-scroll"><button v-for="k in keys" :key="k" class="seg" :class="{on: period === k}" @click="$emit(\'update:period\', k)">{{ $t(\'period.\' + k) }}</button></div>' +
        '<div v-if="period === \'custom\'" class="row2 custom-range"><fld :label="$t(\'period.from\')"><input type="date" :value="from" @change="$emit(\'update:from\', $event.target.value)"></fld>' +
        '<fld :label="$t(\'period.to\')"><input type="date" :value="to" :min="from" @change="$emit(\'update:to\', $event.target.value)"></fld></div></div>',
    });

    app.component('page-entries', {
      data: function () { return { sheet: null, showFilters: false }; },
      computed: {
        f: function () { return RM.state.entFilter; },
        range: function () { return RM.periodRange(this.f.period, this.f.from, this.f.to); },
        rickshaws: function () { return B.rickshaws(); },
        drivers: function () { return D.list('drivers').slice().sort(function (a, b) { return U.natural(a.name, b.name); }); },
        owners: function () { return D.list('owners'); },
        activeFilters: function () { return [this.f.rickshaw, this.f.driver, this.f.owner].filter(Boolean).length; },
        rows: function () {
          var f = this.f, r = this.range;
          return D.list('entries').filter(function (e) {
            if (e.entry_date < r[0] || e.entry_date > r[1]) return false;
            if (f.rickshaw && e.rickshaw_id !== f.rickshaw) return false;
            if (f.driver && e.driver_id !== f.driver) return false;
            if (f.owner) {
              var rk = D.get('rickshaws', e.rickshaw_id);
              if ((e.owner_id || (rk && rk.owner_id)) !== f.owner) return false;
            }
            return true;
          });
        },
        totals: function () { return B.totals(this.rows); },
        groups: function () {
          var by = {};
          this.rows.forEach(function (e) { (by[e.entry_date] = by[e.entry_date] || []).push(e); });
          return Object.keys(by).sort().reverse().map(function (d) {
            return { date: d, items: by[d].sort(function (a, b) { return U.natural(B.rickshawNumber(a.rickshaw_id), B.rickshawNumber(b.rickshaw_id)); }), t: B.totals(by[d]) };
          });
        },
      },
      methods: {
        rn: function (id) { return B.rickshawNumber(id) || '—'; },
        dn: function (id) { return B.driverName(id); },
        net: function (e) { return B.net(e); },
        clear: function () { this.f.rickshaw = ''; this.f.driver = ''; this.f.owner = ''; },
        addDate: function () { return this.range[1] > U.today() ? U.today() : this.range[1]; },
      },
      template: '<div class="page">' +
        '<period-bar v-model:period="f.period" v-model:from="f.from" v-model:to="f.to" :keys="[\'today\', \'yesterday\', \'week\', \'month\', \'custom\']"/>' +
        '<div class="toolbar"><button class="pill-btn" @click="showFilters = !showFilters"><ic name="search" :size="15"/> {{ $t(\'entries.filter\') }}<b v-if="activeFilters"> · {{ $n(activeFilters) }}</b></button>' +
        '<button v-if="activeFilters" class="link-btn" @click="clear">{{ $t(\'entries.clear\') }}</button></div>' +
        '<div v-if="showFilters" class="card filters"><div class="row2">' +
        '<fld :label="$t(\'entry.rickshaw\')"><select v-model="f.rickshaw"><option value="">{{ $t(\'common.all\') }}</option><option v-for="r in rickshaws" :key="r.id" :value="r.id">{{ r.number }}</option></select></fld>' +
        '<fld :label="$t(\'entry.driver\')"><select v-model="f.driver"><option value="">{{ $t(\'common.all\') }}</option><option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option></select></fld></div>' +
        '<fld v-if="!$isOwner()" :label="$t(\'entries.owner\')"><select v-model="f.owner"><option value="">{{ $t(\'common.all\') }}</option><option v-for="o in owners" :key="o.id" :value="o.id">{{ o.name }}</option></select></fld></div>' +

        '<div class="sum-strip">' +
        '<div><span>{{ $t(\'entry.deposit\') }}</span><b class="c-dep">{{ $m(totals.deposit) }}</b></div>' +
        '<div><span>{{ $t(\'entry.expense\') }}</span><b class="c-exp">{{ $m(totals.expense) }}</b></div>' +
        '<div><span>{{ $t(\'entry.charge\') }}</span><b class="c-chg">{{ $m(totals.charge) }}</b></div>' +
        '<div><span>{{ $netLabel() }}</span><b class="c-net" :class="{neg: totals.net < 0}">{{ $m(totals.net) }}</b></div></div>' +

        '<empty v-if="!groups.length" icon="receipt" :text="$t(\'entries.none\')"/>' +
        '<section v-for="g in groups" :key="g.date" class="day-group">' +
        '<header><b>{{ $d(g.date, \'long\') }}</b><span :class="{neg: g.t.net < 0}">{{ $m(g.t.net) }}</span></header>' +
        '<div v-for="e in g.items" :key="e.id" class="row-card" @click="$can(\'entries\', \'update\') && (sheet = e)">' +
        '<div class="rc-main"><b>{{ rn(e.rickshaw_id) }}</b><span class="muted">{{ dn(e.driver_id) || $t(\'entry.noDriver\') }}</span>' +
        '<small v-if="e.taken_time || e.deposit_time" class="muted"><ic name="clock" :size="12"/> {{ $time(e.taken_time) }}{{ e.taken_time && e.deposit_time ? \' → \' : \'\' }}{{ $time(e.deposit_time) }}</small>' +
        '<small v-if="e.note" class="muted note-line">{{ e.note }}</small></div>' +
        '<div class="rc-side"><b class="c-dep">{{ $m(e.deposit || 0) }}</b>' +
        '<small v-if="e.expense" class="c-exp">− {{ $m(e.expense) }}<template v-if="e.expense_type"> · {{ $t(\'exp.\' + e.expense_type) }}</template></small>' +
        '<small v-if="e.garage_charge" class="c-chg">− {{ $m(e.garage_charge) }}</small>' +
        '<small v-if="e.due" class="c-due">{{ $t(\'home.due\') }} {{ $m(e.due) }}</small>' +
        '<small :class="{neg: net(e) < 0}" class="c-net">= {{ $m(net(e)) }}</small></div></div></section>' +

        '<button v-if="$can(\'entries\', \'create\')" class="fab" @click="sheet = {}" :aria-label="$t(\'entry.new\')"><ic name="plus" :size="26"/></button>' +
        '<entry-sheet v-if="sheet" :entry="sheet.id ? sheet : null" :date="addDate()" @close="sheet = null"/>' +
        '</div>',
    });
  });
})();
