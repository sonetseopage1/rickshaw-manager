// Full list behind a summary box on the home page:
// every charge, cost, deposit... of the chosen day (or that day's whole month).
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.installers.push(function (app) {
    app.component('detail-sheet', {
      props: { kind: String, from: String, to: String },
      emits: ['close'],
      computed: {
        multi: function () { return this.from !== this.to; },
        title: function () {
          var map = { income: 'home.garageIncome', cost: 'home.garageCost', deposit: 'entry.deposit', expense: 'entry.expense', charge: 'entry.charge' };
          return this.$t(map[this.kind]);
        },
        periodLabel: function () { return this.multi ? this.$d(this.from, 'month') : this.$d(this.from, 'long'); },
        rows: function () {
          var k = this.kind, from = this.from, to = this.to, self = this, out = [];
          if (k === 'cost') {
            D.list('garage_expenses').forEach(function (x) {
              if (x.expense_date < from || x.expense_date > to) return;
              out.push({ id: x.id, date: x.expense_date, main: self.$t('cat.' + x.category), sub: x.note || '', amount: B.num(x.amount) });
            });
          } else {
            var field = { income: 'garage_charge', charge: 'garage_charge', deposit: 'deposit', expense: 'expense' }[k];
            D.list('entries').forEach(function (e) {
              if (e.entry_date < from || e.entry_date > to) return;
              var amount = B.num(e[field]);
              if (amount <= 0) return;
              var rk = D.get('rickshaws', e.rickshaw_id);
              var sub = k === 'expense'
                ? [e.expense_type ? self.$t('exp.' + e.expense_type) : '', e.note || ''].filter(Boolean).join(' · ')
                : k === 'income' ? B.ownerName(e.owner_id || (rk && rk.owner_id)) : (e.driver_id ? B.driverName(e.driver_id) : '');
              out.push({ id: e.id, date: e.entry_date, main: B.rickshawNumber(e.rickshaw_id) || '—', sub: sub, amount: amount });
            });
          }
          out.sort(function (a, b) { return b.date.localeCompare(a.date) || U.natural(a.main, b.main); });
          return out;
        },
        total: function () { return this.rows.reduce(function (a, r) { return a + r.amount; }, 0); },
        groups: function () {
          var by = {}, order = [];
          this.rows.forEach(function (r) {
            if (!by[r.date]) { by[r.date] = { date: r.date, items: [], sum: 0 }; order.push(r.date); }
            by[r.date].items.push(r);
            by[r.date].sum += r.amount;
          });
          return order.map(function (d) { return by[d]; });
        },
      },
      template: '<sheet :title="title" @close="$emit(\'close\')">' +
        '<div class="dl-head"><span class="muted">{{ periodLabel }}</span><b>{{ $m(total) }}</b></div>' +
        '<p v-if="!rows.length" class="muted center-t dl-none">{{ $t(\'detail.none\') }}</p>' +
        '<div v-for="g in groups" :key="g.date" class="dl-group">' +
        '<div v-if="multi" class="dl-day"><span>{{ $d(g.date, \'long\') }}</span><b>{{ $m(g.sum) }}</b></div>' +
        '<div v-for="r in g.items" :key="r.id" class="dl-row"><div class="dl-main"><b>{{ r.main }}</b><small v-if="r.sub" class="muted">{{ r.sub }}</small></div><b>{{ $m(r.amount) }}</b></div>' +
        '</div></sheet>',
    });
  });
})();
