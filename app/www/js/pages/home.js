// Today board: which rickshaws are free / occupied and today's money at a glance.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.homeDate = U.today();
  RM.state.homeFilter = 'all';
RM.state.homePeriod = 'day';

  RM.installers.push(function (app) {
    app.component('date-nav', {
      props: { modelValue: String },
      emits: ['update:modelValue'],
      computed: {
        isToday: function () { return this.modelValue === U.today(); },
        label: function () { return this.$d(this.modelValue, 'long'); },
      },
      template: '<div class="date-nav">' +
        '<button class="icon-btn" @click="$emit(\'update:modelValue\', $U.addDays(modelValue, -1))" :aria-label="$t(\'common.prev\')"><ic name="left" :size="20"/></button>' +
        '<label class="date-label"><span>{{ label }}</span><input type="date" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value || modelValue)"></label>' +
        '<button class="icon-btn" @click="$emit(\'update:modelValue\', $U.addDays(modelValue, 1))" :aria-label="$t(\'common.next\')"><ic name="right" :size="20"/></button>' +
        '<button v-if="!isToday" class="pill-btn" @click="$emit(\'update:modelValue\', $U.today())">{{ $t(\'common.today\') }}</button>' +
        '</div>',
    });

    app.component('page-home', {
      data: function () { return { entrySheet: null, assignSheet: null, detail: null, expenseSheet: null }; },
      computed: {
        s: function () { return RM.state; },
        date: {
          get: function () { return RM.state.homeDate; },
          set: function (v) { RM.state.homeDate = v; },
        },
        filter: {
          get: function () { return RM.state.homeFilter; },
          set: function (v) { RM.state.homeFilter = v; },
        },
        cards: function () {
          var date = this.date;
          var entries = B.entriesOn(date);
          var byR = {};
          entries.forEach(function (e) { (byR[e.rickshaw_id] = byR[e.rickshaw_id] || []).push(e); });
          return B.rickshaws().map(function (r) {
            var st = B.statusOn(r, date);
            var es = byR[r.id] || [];
            var t = B.totals(es);
            var exp = B.expectedRent(r, date);
            return {
              r: r, status: st, driver: B.driverOn(r.id, date), owner: B.ownerName(r.owner_id), entries: es, t: t,
              expected: exp, due: t.due || 0, done: t.deposit > 0, // 'done' = the day's entry with a deposit is saved
            };
          });
        },
        ownerKey: function () { return RM.state.homeOwner; },
        /** Garage staff first see the owners; owners (and an admin in owner view) go straight to their rickshaws. */
        staffList: function () { return !RM.isOwnerRole() && this.ownerKey === null && this.cards.length > 0; },
        groups: function () {
          var by = {}, self = this;
          this.cards.forEach(function (c) {
            var k = c.r.owner_id || 'none';
            var g = by[k] = by[k] || { key: k, cards: [] };
            g.cards.push(c);
          });
          function make(key, name, isSelf) {
            var g = by[key] || { key: key, cards: [] };
            var live = g.cards.filter(function (c) { return c.status !== 'inactive'; });
            var t = { deposit: 0, expense: 0, charge: 0, net: 0 };
            g.cards.forEach(function (c) { t.deposit += c.t.deposit; t.expense += c.t.expense; t.charge += c.t.charge; t.net += c.t.net; });
            return {
              key: key, name: name, self: isSelf, count: live.length, t: t,
              free: live.filter(function (c) { return c.status === 'free'; }).length,
              occupied: live.filter(function (c) { return c.status === 'occupied'; }).length,
              maintenance: live.filter(function (c) { return c.status === 'maintenance'; }).length,
            };
          }
          var out = D.list('owners').slice().sort(function (a, b) { return U.natural(a.name, b.name); })
            .map(function (o) { return make(o.id, o.name, !!o.is_self); });
          if (by.none) out.push(make('none', self.$t('reports.noOwner'), false));
          return out;
        },
        cur: function () {
          var k = this.ownerKey, g = this.groups.find(function (x) { return x.key === k; });
          return g || { key: k, name: '', count: 0, t: { deposit: 0, expense: 0, charge: 0, net: 0 } };
        },
        scoped: function () {
          var k = this.ownerKey;
          if (RM.isOwnerRole() || k === null) return this.cards;
          return this.cards.filter(function (c) { return (c.r.owner_id || 'none') === k; });
        },
        counts: function () {
          var c = { all: 0, free: 0, occupied: 0, done: 0, maintenance: 0, inactive: 0 };
          this.scoped.forEach(function (x) { c.all++; c[x.status]++; if (x.done) c.done++; });
          return c;
        },
        shown: function () {
          var f = this.filter;
          return this.scoped.filter(function (x) {
            if (f === 'done') return x.done;
            return f === 'all' ? x.status !== 'inactive' : x.status === f;
          });
        },
        period: {
          get: function () { return RM.state.homePeriod; },
          set: function (v) { RM.state.homePeriod = v; },
        },
        /** The summary covers the chosen day, or that day's whole month. */
        range: function () {
          var date = this.date;
          return this.period === 'month' ? [U.monthStart(date), U.monthEnd(date)] : [date, date];
        },
        /** Garage staff view: the garage's own earning (charges) minus its running costs. */
        gp: function () {
          var s = B.summarize(this.range[0], this.range[1]);
          return {
            income: s.totals.charge, cost: s.utility.total, net: s.totals.charge - s.utility.total,
            deposit: s.totals.deposit, ownersNet: s.totals.net, due: s.totals.due,
          };
        },
        totals: function () { return B.summarize(this.range[0], this.range[1]).totals; },
        setupDone: function () {
          return {
            owners: D.list('owners').length, drivers: D.list('drivers').length, rickshaws: D.list('rickshaws').length,
            assignments: D.list('assignments').length,
          };
        },
      },
      methods: {
        open: function (c) {
          this.entrySheet = { entry: c.entries.length === 1 ? c.entries[0] : null, rickshawId: c.r.id };
        },
        addEntry: function (c) { this.entrySheet = { entry: c.entries.length === 1 ? c.entries[0] : null, rickshawId: c.r.id }; },
        assign: function (c) { this.assignSheet = { assignment: null, rickshawId: c.r.id }; },
        edit: function (e) { this.entrySheet = { entry: e, rickshawId: e.rickshaw_id }; },
        go: function (p) { RM.go(p); },
        openOwner: function (k) { RM.openOwner(k); },
        closeOwner: function () { RM.closeOwner(); },
      },
      template: '<div class="page">' +
        '<date-nav v-model="date"/>' +

        '<div v-if="!$isOwner()" class="hero">' +
        '<div class="hero-top"><div class="hero-main"><span>{{ $t(\'home.garageNet\') }}</span><b :class="{neg: gp.net < 0}">{{ $m(gp.net) }}</b></div>' +
        '<div class="seg-mini"><button :class="{on: period === \'day\'}" @click="period = \'day\'">{{ $t(\'home.pDay\') }}</button>' +
        '<button :class="{on: period === \'month\'}" @click="period = \'month\'">{{ $t(\'home.pMonth\') }}</button></div></div>' +
        '<p class="hero-sub">{{ period === \'month\' ? $d(date, \'month\') : $d(date, \'long\') }}</p>' +
        '<div class="hero-row two">' +
        '<div class="tap" @click="detail = \'income\'"><i class="dot chg"></i><span>{{ $t(\'home.garageIncome\') }}</span><b>{{ $m(gp.income) }}</b><ic name="right" :size="14" class="chev"/></div>' +
        '<div class="tap" @click="detail = \'cost\'"><i class="dot exp"></i><span>{{ $t(\'home.garageCost\') }}</span><b>{{ $m(gp.cost) }}</b><ic name="right" :size="14" class="chev"/></div>' +
        '</div></div>' +
        '<div v-if="!$isOwner()" class="card collect">' +
        '<div class="collect-main"><span>{{ $t(\'home.collected\') }}</span><b>{{ $m(gp.deposit) }}</b></div>' +
        '<small class="muted">{{ $t(\'home.collectedNote\') }}</small>' +
        '<div class="collect-row"><span>{{ $t(\'home.ownersShare\') }}</span><b>{{ $m(gp.ownersNet) }}</b></div>' +
        '<div v-if="gp.due" class="collect-row due tap" @click="go(\'dues\')"><span>{{ $t(\'home.dueTotal\') }}</span><b>{{ $m(gp.due) }}</b></div></div>' +

        '<button v-if="!$isOwner() && $can(\'garage_expenses\', \'create\')" class="btn soft block add-cost-btn" @click="expenseSheet = {}"><ic name="plus" :size="18"/> {{ $t(\'home.addCost\') }}</button>' +

        '<div v-if="$isOwner()" class="hero">' +
        '<div class="hero-top"><div class="hero-main"><span>{{ $t(\'home.ownerNet\') }}</span><b :class="{neg: totals.net < 0}">{{ $m(totals.net) }}</b></div>' +
        '<div class="seg-mini"><button :class="{on: period === \'day\'}" @click="period = \'day\'">{{ $t(\'home.pDay\') }}</button>' +
        '<button :class="{on: period === \'month\'}" @click="period = \'month\'">{{ $t(\'home.pMonth\') }}</button></div></div>' +
        '<p class="hero-sub">{{ period === \'month\' ? $d(date, \'month\') : $d(date, \'long\') }}</p>' +
        '<div class="hero-row">' +
        '<div class="tap" @click="detail = \'deposit\'"><i class="dot dep"></i><span>{{ $t(\'entry.deposit\') }}</span><b>{{ $m(totals.deposit) }}</b><ic name="right" :size="14" class="chev"/></div>' +
        '<div class="tap" @click="detail = \'expense\'"><i class="dot exp"></i><span>{{ $t(\'entry.expense\') }}</span><b>{{ $m(totals.expense) }}</b><ic name="right" :size="14" class="chev"/></div>' +
        '<div class="tap" @click="detail = \'charge\'"><i class="dot chg"></i><span>{{ $t(\'entry.charge\') }}</span><b>{{ $m(totals.charge) }}</b><ic name="right" :size="14" class="chev"/></div>' +
        '</div></div>' +

        '<div v-if="!cards.length && $isOwner()" class="card onboard"><p>{{ $t(\'home.ownerEmpty\') }}</p></div>' +
        '<div v-if="!cards.length && !$isOwner()" class="card onboard">' +
        '<h3>{{ $t(\'home.welcome\') }}</h3><p class="muted">{{ $t(\'home.welcomeText\') }}</p>' +
        '<ol class="steps">' +
        '<li :class="{done: setupDone.owners}"><span>1</span>{{ $t(\'home.stepOwner\') }}</li>' +
        '<li :class="{done: setupDone.rickshaws}"><span>2</span>{{ $t(\'home.stepRickshaw\') }}</li>' +
        '<li :class="{done: setupDone.drivers}"><span>3</span>{{ $t(\'home.stepDriver\') }}</li>' +
        '<li :class="{done: setupDone.assignments}"><span>4</span>{{ $t(\'home.stepAssign\') }}</li></ol>' +
        '<button v-if="$can(\'rickshaws\', \'create\')" class="btn primary" @click="go(\'setup\')"><ic name="plus" :size="18"/> {{ $t(\'home.startSetup\') }}</button>' +
        '<p v-else class="muted">{{ $t(\'home.askAdmin\') }}</p></div>' +

        '<template v-else>' +

        '<template v-if="staffList">' +
        '<h4 class="sec-title">{{ $t(\'home.owners\') }}</h4><p class="muted small owners-hint">{{ $t(\'home.ownersHint\') }}</p>' +
        '<div v-for="g in groups" :key="g.key" class="row-card owner-row" @click="openOwner(g.key)">' +
        '<avatar :name="g.name" :size="46"/>' +
        '<div class="rc-main"><b>{{ g.name }} <span v-if="g.self" class="tag free">{{ $t(\'setup.me\') }}</span></b>' +
        '<span class="muted">{{ $n(g.count) }} {{ $t(\'setup.rickshawsCount\') }}</span>' +
        '<span class="occ-dots"><i class="d free"></i>{{ $n(g.free) }}<i class="d occupied"></i>{{ $n(g.occupied) }}<template v-if="g.maintenance"><i class="d maintenance"></i>{{ $n(g.maintenance) }}</template></span></div>' +
        '<div class="rc-side"><small class="muted">{{ $t(\'entry.deposit\') }}</small><b class="c-dep">{{ $m(g.t.deposit) }}</b>' +
        '<small :class="{neg: g.t.net < 0}">{{ $netLabel() }} {{ $m(g.t.net) }}</small></div><ic name="right" :size="18"/></div>' +
        '</template>' +

        '<template v-else>' +
        '<div v-if="!$isOwner()" class="drill-head"><button class="icon-btn" @click="closeOwner" :aria-label="$t(\'common.prev\')"><ic name="left" :size="20"/></button>' +
        '<div class="dh-t"><b>{{ cur.name }}</b><small class="muted">{{ $n(cur.count) }} {{ $t(\'setup.rickshawsCount\') }}</small></div>' +
        '<div class="dh-side"><b :class="{neg: cur.t.net < 0}">{{ $m(cur.t.net) }}</b><small class="muted">{{ $netLabel() }}</small></div></div>' +
        '<div class="seg-scroll"><button v-for="k in [\'all\', \'free\', \'occupied\', \'done\', \'maintenance\']" :key="k" class="seg" :class="[\'s-\' + k, {on: filter === k}]" @click="filter = k">' +
        '{{ $t(\'home.f_\' + k) }} <b>{{ $n(counts[k]) }}</b></button></div>' +

        '<div class="rk-grid">' +
        '<div v-for="c in shown" :key="c.r.id" class="rk" :class="[c.status, {done: c.done}]" @click="$can(\'entries\', \'create\') && open(c)">' +
        '<div class="rk-top"><span class="rk-no">{{ c.r.number }}</span><span class="tag" :class="c.done ? \'done\' : c.status">{{ c.done ? $t(\'home.s_done\') : $t(\'home.s_\' + c.status) }}</span></div>' +
        '<div class="rk-owner" v-if="c.owner">{{ c.owner }}</div>' +
        '<div class="rk-driver" :class="{none: !c.driver}"><avatar v-if="c.driver" :id="c.driver.photo_id" :name="c.driver.name" :size="22"/><ic v-else name="user" :size="15"/> {{ c.driver ? c.driver.name : $t(\'home.noDriver\') }}</div>' +
        '<div v-if="c.entries.length" class="rk-money">' +
        '<span>{{ $t(\'entry.deposit\') }} <b>{{ $m(c.t.deposit) }}</b></span>' +
        '<span>{{ $t(\'entry.charge\') }} <b>{{ $m(c.t.charge) }}</b></span>' +
        '<span v-if="c.t.expense">{{ $t(\'entry.expense\') }} <b>{{ $m(c.t.expense) }}</b></span>' +
        '<span v-if="c.due" class="due">{{ $t(\'home.due\') }} <b>{{ $m(c.due) }}</b></span>' +
        '<span class="net" :class="{neg: c.t.net < 0}">{{ $netLabel() }} <b>{{ $m(c.t.net) }}</b></span></div>' +
        '<div v-else-if="c.expected" class="rk-exp">{{ $t(\'home.expected\') }} {{ $m(c.expected) }}</div>' +
        '<div class="rk-actions" @click.stop>' +
        '<button v-if="c.status === \'free\' && $can(\'assignments\', \'create\')" class="mini" @click="assign(c)"><ic name="user" :size="14"/> {{ $t(\'home.assignDriver\') }}</button>' +
        '<button v-if="c.entries.length > 1" class="mini" @click="edit(c.entries[c.entries.length - 1])">{{ $n(c.entries.length) }}x</button>' +
        '<button v-if="c.status !== \'inactive\' && $can(\'entries\', \'create\')" class="mini" :class="c.done ? \'view\' : \'pri\'" @click="addEntry(c)">' +
        '<ic :name="c.done ? \'eye\' : \'plus\'" :size="14"/> {{ c.done ? $t(\'home.viewEntry\') : $t(\'home.giveDeposit\') }}</button>' +
        '</div></div></div>' +
        '<empty v-if="!shown.length" icon="rickshaw" :text="$t(\'home.nothing\')"/>' +
        '</template>' +
        '</template>' +

        '<button v-if="cards.length && $can(\'entries\', \'create\')" class="fab" @click="entrySheet = {entry: null, rickshawId: \'\'}" :aria-label="$t(\'entry.new\')"><ic name="plus" :size="26"/></button>' +
        '<detail-sheet v-if="detail" :kind="detail" :from="range[0]" :to="range[1]" @close="detail = null" @add="expenseSheet = {}" @edit="expenseSheet = $event"/>' +
        '<expense-sheet v-if="expenseSheet" :key="expenseSheet.id || \'new\'" :expense="expenseSheet.id ? expenseSheet : null" :date="date" @close="expenseSheet = null"/>' +
        '<entry-sheet v-if="entrySheet" :entry="entrySheet.entry" :rickshaw-id="entrySheet.rickshawId" :date="date" @close="entrySheet = null"/>' +
        '<assign-sheet v-if="assignSheet" :assignment="assignSheet.assignment" :rickshaw-id="assignSheet.rickshawId" :date="date" @close="assignSheet = null"/>' +
        '</div>',
    });
  });
})();
