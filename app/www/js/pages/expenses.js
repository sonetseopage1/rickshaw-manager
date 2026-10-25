// Garage running costs: rent, electricity, tools, security...
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.expMonth = U.monthStart(U.today());

  RM.installers.push(function (app) {
    app.component('page-expenses', {
      data: function () { return { form: null }; },
      computed: {
        month: {
          get: function () { return RM.state.expMonth; },
          set: function (v) { RM.state.expMonth = v; },
        },
        isThisMonth: function () { return this.month === U.monthStart(U.today()); },
        list: function () {
          var from = this.month, to = U.monthEnd(this.month);
          return D.list('garage_expenses').filter(function (x) { return x.expense_date >= from && x.expense_date <= to; })
            .sort(function (a, b) { return b.expense_date.localeCompare(a.expense_date) || b.updated_at - a.updated_at; });
        },
        total: function () { return this.list.reduce(function (a, x) { return a + B.num(x.amount); }, 0); },
        cats: function () {
          var by = {}, pal = RM.colors.palette;
          this.list.forEach(function (x) { by[x.category] = (by[x.category] || 0) + B.num(x.amount); });
          var self = this;
          return Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k, i) {
            return { label: self.$t('cat.' + k), value: by[k], color: pal[i % pal.length] };
          });
        },
        garageIncome: function () { return B.summarize(this.month, U.monthEnd(this.month)).totals.charge; },
        fields: function () {
          var t = this.$t.bind(this);
          return [
            { key: 'category', label: t('exp.category'), type: 'chips', options: this.$opts.categories(), def: 'rent', req: true },
            { key: 'amount', label: t('exp.amount'), type: 'number', req: true },
            { key: 'expense_date', label: t('entry.date'), type: 'date', req: true, def: U.today() },
            { key: 'note', label: t('entry.note'), type: 'textarea' },
          ];
        },
      },
      methods: {
        shift: function (n) { this.month = U.addMonths(this.month, n); },
        open: function (x) { this.form = x || {}; },
        save: function (v) {
          if (this.form.id) v.id = this.form.id;
          D.save('garage_expenses', v);
          RM.toast(this.$t('common.saved'), 'ok');
          this.form = null;
        },
        remove: function () {
          var self = this, id = this.form.id;
          RM.confirm(this.$t('exp.deleteAsk'), { danger: true, ok: this.$t('common.delete') }).then(function (ok) {
            if (!ok) return;
            D.remove('garage_expenses', id);
            RM.toast(self.$t('common.deleted'));
            self.form = null;
          });
        },
      },
      template: '<div class="page">' +
        '<div class="date-nav"><button class="icon-btn" @click="shift(-1)"><ic name="left" :size="20"/></button>' +
        '<div class="date-label static"><span>{{ $d(month, \'month\') }}</span></div>' +
        '<button class="icon-btn" @click="shift(1)"><ic name="right" :size="20"/></button>' +
        '<button v-if="!isThisMonth" class="pill-btn" @click="month = $U.monthStart($U.today())">{{ $t(\'common.thisMonth\') }}</button></div>' +

        '<div class="hero small"><div class="hero-main"><span>{{ $t(\'exp.monthTotal\') }}</span><b>{{ $m(total) }}</b></div>' +
        '<div class="hero-row two"><div><span>{{ $t(\'exp.garageIncome\') }}</span><b>{{ $m(garageIncome) }}</b></div>' +
        '<div><span>{{ $t(\'exp.garageProfit\') }}</span><b :class="{neg: garageIncome - total < 0}">{{ $m(garageIncome - total) }}</b></div></div></div>' +

        '<div v-if="cats.length" class="card"><donut :items="cats" :center="$m(total)" :sub="$t(\'exp.total\')"/></div>' +
        '<empty v-if="!list.length" icon="wallet" :text="$t(\'exp.none\')"/>' +
        '<div v-for="x in list" :key="x.id" class="row-card" @click="open(x)">' +
        '<div class="rc-main"><b>{{ $t(\'cat.\' + x.category) }}</b><span class="muted">{{ x.note }}</span></div>' +
        '<div class="rc-side"><b class="c-exp">{{ $m(x.amount) }}</b><small class="muted">{{ $d(x.expense_date, \'short\') }}</small></div></div>' +

        '<button class="fab" @click="open()"><ic name="plus" :size="26"/></button>' +
        '<form-sheet v-if="form" :key="form.id || \'new\'" :title="form.id ? $t(\'exp.edit\') : $t(\'exp.new\')" :fields="fields" :initial="form" :can-delete="!!form.id" @save="save" @delete="remove" @close="form = null"/>' +
        '</div>',
    });
  });
})();
