// Small dependency-free SVG/HTML charts (work offline).
(function () {
  var RM = window.RM;

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }
  function compact(n, lang) {
    try { return new Intl.NumberFormat(RM.util.locale(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(n); }
    catch (e) { return String(Math.round(n)); }
  }

  function install(app) {
    /** Grouped bar chart. series: [{name,color,values:[]}], labels: [] */
    app.component('bar-chart', {
      props: { labels: Array, series: Array, tips: Array, height: { type: Number, default: 170 } },
      data: function () { return { sel: -1 }; },
      computed: {
        W: function () { return 340; },
        pad: function () { return { l: 38, r: 6, t: 8, b: 20 }; },
        max: function () {
          var m = 0;
          this.series.forEach(function (s) { s.values.forEach(function (v) { if (v > m) m = v; }); });
          return niceMax(m);
        },
        ticks: function () {
          var self = this;
          return [0, 1, 2].map(function (i) {
            var v = self.max * i / 2;
            return { v: v, y: self.pad.t + (self.height - self.pad.t - self.pad.b) * (1 - i / 2) };
          });
        },
        groups: function () {
          var self = this, n = this.labels.length;
          var gw = (this.W - this.pad.l - this.pad.r) / Math.max(n, 1);
          var inner = this.height - this.pad.t - this.pad.b;
          var k = this.series.length;
          var bw = Math.max(1.5, gw * 0.78 / k);
          return this.labels.map(function (lab, i) {
            var x0 = self.pad.l + i * gw + gw * 0.11;
            return {
              i: i, x: self.pad.l + i * gw, w: gw, label: lab,
              bars: self.series.map(function (s, j) {
                var h = inner * (s.values[i] || 0) / self.max;
                return { x: x0 + j * bw, y: self.pad.t + inner - h, w: bw - 0.6, h: Math.max(h, s.values[i] ? 1.5 : 0), color: s.color };
              }),
            };
          });
        },
        every: function () { return Math.ceil(this.labels.length / 9); },
        info: function () {
          if (this.sel < 0) return null;
          var self = this;
          return {
            title: (this.tips && this.tips[this.sel]) || this.labels[this.sel],
            rows: this.series.map(function (s) { return { name: s.name, color: s.color, v: s.values[self.sel] || 0 }; }),
          };
        },
      },
      methods: {
        fmt: function (v) { return compact(v, RM.state.lang); },
        pick: function (i) { this.sel = this.sel === i ? -1 : i; },
      },
      template: '<div class="chart-box">' +
        '<svg class="chart-svg" :viewBox="\'0 0 \' + W + \' \' + height" preserveAspectRatio="xMidYMid meet">' +
        '<g v-for="t in ticks" :key="t.y"><line :x1="pad.l" :x2="W - pad.r" :y1="t.y" :y2="t.y" class="grid"/><text :x="pad.l - 5" :y="t.y + 3" text-anchor="end" class="axis">{{ fmt(t.v) }}</text></g>' +
        '<g v-for="g in groups" :key="g.i" @click="pick(g.i)">' +
        '<rect :x="g.x" :y="pad.t" :width="g.w" :height="height - pad.t - pad.b" class="hit" :class="{sel: sel === g.i}"/>' +
        '<rect v-for="(b, j) in g.bars" :key="j" :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="1.8" :style="{fill: b.color}"/>' +
        '<text v-if="g.i % every === 0" :x="g.x + g.w / 2" :y="height - 6" text-anchor="middle" class="axis">{{ g.label }}</text>' +
        '</g></svg>' +
        '<div class="chart-legend"><span v-for="s in series" :key="s.name"><i :style="{background: s.color}"></i>{{ s.name }}</span></div>' +
        '<div v-if="info" class="chart-tip"><b>{{ info.title }}</b><span v-for="r in info.rows" :key="r.name"><i :style="{background: r.color}"></i>{{ r.name }}: {{ $m(r.v) }}</span></div>' +
        '</div>',
    });

    /** Donut chart with legend. items: [{label,value,color}] */
    app.component('donut', {
      props: { items: Array, center: String, sub: String },
      computed: {
        total: function () { return this.items.reduce(function (a, b) { return a + b.value; }, 0); },
        arcs: function () {
          var acc = 0, t = this.total || 1;
          return this.items.filter(function (i) { return i.value > 0; }).map(function (i) {
            var pct = i.value / t * 100;
            var a = { color: i.color, dash: Math.max(pct - 0.6, 0.4) + ' ' + (100 - Math.max(pct - 0.6, 0.4)), offset: 25 - acc };
            acc += pct;
            return a;
          });
        },
      },
      template: '<div class="donut-box">' +
        '<svg viewBox="0 0 42 42" class="donut-svg"><circle cx="21" cy="21" r="15.9155" class="donut-bg"/>' +
        '<circle v-for="(a, i) in arcs" :key="i" cx="21" cy="21" r="15.9155" fill="none" stroke-width="5" :stroke="a.color" :stroke-dasharray="a.dash" :stroke-dashoffset="a.offset"/>' +
        '<text x="21" y="21.5" text-anchor="middle" class="donut-c">{{ center }}</text><text x="21" y="26.5" text-anchor="middle" class="donut-s">{{ sub }}</text></svg>' +
        '<ul class="donut-legend"><li v-for="i in items" :key="i.label"><i :style="{background: i.color}"></i><span>{{ i.label }}</span>' +
        '<b>{{ $m(i.value) }}</b><em>{{ total ? Math.round(i.value / total * 100) : 0 }}%</em></li></ul></div>',
    });

    /** Horizontal bars. items: [{label, value, sub, color}] */
    app.component('hbars', {
      props: { items: Array, color: { type: String, default: 'var(--c-net)' }, signed: Boolean },
      computed: {
        max: function () { return Math.max.apply(null, this.items.map(function (i) { return Math.abs(i.value); }).concat([1])); },
      },
      template: '<div class="hbars"><div v-for="i in items" :key="i.label + i.sub" class="hbar">' +
        '<div class="hbar-top"><span class="hbar-l">{{ i.label }}<small v-if="i.sub"> {{ i.sub }}</small></span><b :class="{neg: i.value < 0}">{{ $m(i.value) }}</b></div>' +
        '<div class="hbar-track"><div class="hbar-fill" :style="{width: Math.max(Math.abs(i.value) / max * 100, i.value ? 2 : 0) + \'%\', background: i.value < 0 ? \'var(--c-exp)\' : (i.color || color)}"></div></div></div></div>',
    });
  }

  RM.installCharts = install;
})();
