// Reports: charts and statements by period.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.repFilter = { period: 'month', from: U.monthStart(U.today()), to: U.today(), tab: 'overview' };

  RM.shareText = function (text) {
    if (navigator.share) {
      return navigator.share({ text: text }).catch(function () {});
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { RM.toast(RM.t('common.copied'), 'ok'); });
    }
    return Promise.resolve();
  };

  RM.installers.push(function (app) {
    app.component('page-reports', {
      computed: {
        f: function () { return RM.state.repFilter; },
        range: function () { return RM.periodRange(this.f.period, this.f.from, this.f.to); },
        sum: function () { return B.summarize(this.range[0], this.range[1]); },
        t: function () { return this.sum.totals; },
        chartLabels: function () {
          var self = this, lang = RM.state.lang;
          return this.sum.series.map(function (s) {
            if (self.sum.monthly) return new Intl.DateTimeFormat(U.locale(lang), { month: 'short' }).format(U.parse(s.date));
            return U.num(Number(s.date.slice(8)), lang);
          });
        },
        chartTips: function () {
          var self = this;
          return this.sum.series.map(function (s) { return self.sum.monthly ? self.$d(s.date, 'month') : self.$d(s.date, 'long'); });
        },
        chartSeries: function () {
          var s = this.sum.series;
          return [
            { name: this.$t('entry.deposit'), color: 'var(--c-dep)', values: s.map(function (x) { return x.deposit; }) },
            { name: this.$t('entry.net'), color: 'var(--c-net)', values: s.map(function (x) { return Math.max(x.net, 0); }) },
          ];
        },
        expenseDonut: function () {
          var self = this, pal = RM.colors.palette, e = this.sum.expenseTypes;
          return Object.keys(e).sort(function (a, b) { return e[b] - e[a]; }).map(function (k, i) {
            return { label: self.$t('exp.' + k), value: e[k], color: pal[i % pal.length] };
          });
        },
        utilDonut: function () {
          var self = this, pal = RM.colors.palette, e = this.sum.utility.byCategory;
          return Object.keys(e).sort(function (a, b) { return e[b] - e[a]; }).map(function (k, i) {
            return { label: self.$t('cat.' + k), value: e[k], color: pal[i % pal.length] };
          });
        },
        rickshawBars: function () {
          var self = this, by = this.sum.byRickshaw;
          return Object.keys(by).map(function (id) {
            return { label: B.rickshawNumber(id) || '—', value: by[id].net, sub: self.$m(by[id].deposit) + ' · ' + U.num(by[id].count, RM.state.lang) + ' ' + self.$t('reports.days') };
          }).sort(function (a, b) { return b.value - a.value; });
        },
        driverBars: function () {
          var self = this, by = this.sum.byDriver;
          return Object.keys(by).map(function (id) {
            return { label: id ? (B.driverName(id) || '—') : self.$t('entry.noDriver'), value: by[id].deposit, sub: U.num(by[id].count, RM.state.lang) + ' ' + self.$t('reports.days') };
          }).sort(function (a, b) { return b.value - a.value; });
        },
        owners: function () {
          var self = this, by = this.sum.byOwner;
          return Object.keys(by).map(function (id) {
            return {
              id: id, name: id ? (B.ownerName(id) || '—') : self.$t('reports.noOwner'), t: by[id],
              count: D.list('rickshaws').filter(function (r) { return (r.owner_id || '') === id; }).length,
            };
          }).sort(function (a, b) { return b.t.net - a.t.net; });
        },
        periodLabel: function () {
          return this.range[0] === this.range[1] ? this.$d(this.range[0]) : this.$d(this.range[0]) + ' – ' + this.$d(this.range[1]);
        },
      },
      methods: {
        share: function (o) {
          var m = this.$m.bind(this), t = o.t;
          var lines = [
            RM.state.session.garage.name + ' — ' + o.name,
            this.periodLabel,
            this.$t('entry.deposit') + ': ' + m(t.deposit),
            this.$t('entry.expense') + ': ' + m(t.expense),
            this.$t('entry.charge') + ': ' + m(t.charge),
            this.$t('entry.net') + ': ' + m(t.net),
          ];
          RM.shareText(lines.join('\n'));
        },
      },
      template: '<div class="page">' +
        '<period-bar v-model:period="f.period" v-model:from="f.from" v-model:to="f.to" :keys="[\'today\', \'week\', \'month\', \'lastmonth\', \'30\', \'year\', \'custom\']"/>' +
        '<p class="muted period-lbl">{{ periodLabel }}</p>' +
        '<div class="seg-scroll tabs"><button v-for="k in [\'overview\', \'rickshaws\', \'owners\', \'drivers\']" :key="k" class="seg" :class="{on: f.tab === k}" @click="f.tab = k">{{ $t(\'reports.tab_\' + k) }}</button></div>' +

        '<template v-if="f.tab === \'overview\'">' +
        '<div class="kpis">' +
        '<div class="kpi dep"><span>{{ $t(\'entry.deposit\') }}</span><b>{{ $m(t.deposit) }}</b></div>' +
        '<div class="kpi exp"><span>{{ $t(\'entry.expense\') }}</span><b>{{ $m(t.expense) }}</b></div>' +
        '<div class="kpi chg"><span>{{ $t(\'entry.charge\') }}</span><b>{{ $m(t.charge) }}</b></div>' +
        '<div class="kpi net"><span>{{ $t(\'entry.net\') }}</span><b :class="{neg: t.net < 0}">{{ $m(t.net) }}</b></div></div>' +

        '<div class="card"><h4>{{ $t(\'reports.garagePL\') }}</h4>' +
        '<div class="pl"><span>{{ $t(\'exp.garageIncome\') }}</span><b>{{ $m(t.charge) }}</b></div>' +
        '<div class="pl"><span>{{ $t(\'reports.utility\') }}</span><b class="c-exp">− {{ $m(sum.utility.total) }}</b></div>' +
        '<div class="pl total"><span>{{ $t(\'exp.garageProfit\') }}</span><b :class="{neg: sum.garageProfit < 0}">{{ $m(sum.garageProfit) }}</b></div></div>' +

        '<div class="card"><h4>{{ sum.monthly ? $t(\'reports.perMonth\') : $t(\'reports.perDay\') }}</h4>' +
        '<bar-chart v-if="sum.series.length > 1 && t.count" :labels="chartLabels" :series="chartSeries" :tips="chartTips"/>' +
        '<p v-else class="muted center-t">{{ t.count ? $t(\'reports.needMoreDays\') : $t(\'reports.noData\') }}</p></div>' +

        '<div v-if="expenseDonut.length" class="card"><h4>{{ $t(\'reports.expenseTypes\') }}</h4><donut :items="expenseDonut" :center="$m(t.expense)" :sub="$t(\'entry.expense\')"/></div>' +
        '<div v-if="utilDonut.length" class="card"><h4>{{ $t(\'reports.utility\') }}</h4><donut :items="utilDonut" :center="$m(sum.utility.total)" :sub="$t(\'exp.total\')"/></div>' +
        '</template>' +

        '<template v-if="f.tab === \'rickshaws\'"><div class="card"><h4>{{ $t(\'reports.netByRickshaw\') }}</h4>' +
        '<hbars v-if="rickshawBars.length" :items="rickshawBars"/><p v-else class="muted center-t">{{ $t(\'reports.noData\') }}</p></div></template>' +

        '<template v-if="f.tab === \'drivers\'"><div class="card"><h4>{{ $t(\'reports.depositByDriver\') }}</h4>' +
        '<hbars v-if="driverBars.length" :items="driverBars" color="var(--c-dep)"/><p v-else class="muted center-t">{{ $t(\'reports.noData\') }}</p></div></template>' +

        '<template v-if="f.tab === \'owners\'">' +
        '<p v-if="!owners.length" class="muted center-t">{{ $t(\'reports.noData\') }}</p>' +
        '<div v-for="o in owners" :key="o.id" class="card owner-card"><div class="oc-head"><div><b>{{ o.name }}</b><small class="muted">{{ $n(o.count) }} {{ $t(\'setup.rickshawsCount\') }}</small></div>' +
        '<button class="pill-btn" @click="share(o)"><ic name="phone" :size="14"/> {{ $t(\'reports.share\') }}</button></div>' +
        '<div class="pl"><span>{{ $t(\'entry.deposit\') }}</span><b class="c-dep">{{ $m(o.t.deposit) }}</b></div>' +
        '<div class="pl"><span>{{ $t(\'entry.expense\') }}</span><b class="c-exp">− {{ $m(o.t.expense) }}</b></div>' +
        '<div class="pl"><span>{{ $t(\'entry.charge\') }}</span><b class="c-chg">− {{ $m(o.t.charge) }}</b></div>' +
        '<div class="pl total"><span>{{ $t(\'reports.ownerShare\') }}</span><b :class="{neg: o.t.net < 0}">{{ $m(o.t.net) }}</b></div></div></template>' +
        '</div>',
    });
  });
})();
