// Today board: which rickshaws are free / occupied and today's money at a glance.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.homeDate = U.today();
  RM.state.homeFilter = 'all';

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
      data: function () { return { entrySheet: null, assignSheet: null }; },
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
              expected: exp, due: exp !== null && es.length && t.deposit < exp ? exp - t.deposit : 0,
            };
          });
        },
        counts: function () {
          var c = { all: 0, free: 0, occupied: 0, maintenance: 0, inactive: 0 };
          this.cards.forEach(function (x) { c.all++; c[x.status]++; });
          return c;
        },
        shown: function () {
          var f = this.filter;
          return this.cards.filter(function (x) { return f === 'all' ? x.status !== 'inactive' : x.status === f; });
        },
        totals: function () { return B.totals(B.entriesOn(this.date)); },
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
        addEntry: function (c) { this.entrySheet = { entry: null, rickshawId: c.r.id }; },
        assign: function (c) { this.assignSheet = { assignment: null, rickshawId: c.r.id }; },
        edit: function (e) { this.entrySheet = { entry: e, rickshawId: e.rickshaw_id }; },
        go: function (p) { RM.go(p); },
      },
      template: '<div class="page">' +
        '<date-nav v-model="date"/>' +

        '<div class="hero">' +
        '<div class="hero-main"><span>{{ $isOwner() ? $t(\'home.ownerNet\') : $t(\'home.net\') }}</span><b :class="{neg: totals.net < 0}">{{ $m(totals.net) }}</b></div>' +
        '<div class="hero-row">' +
        '<div><i class="dot dep"></i><span>{{ $t(\'entry.deposit\') }}</span><b>{{ $m(totals.deposit) }}</b></div>' +
        '<div><i class="dot exp"></i><span>{{ $t(\'entry.expense\') }}</span><b>{{ $m(totals.expense) }}</b></div>' +
        '<div><i class="dot chg"></i><span>{{ $t(\'entry.charge\') }}</span><b>{{ $m(totals.charge) }}</b></div>' +
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
        '<button v-if="$can(\'entries\', \'create\')" class="btn soft block daybook-btn" @click="go(\'daybook\')"><ic name="receipt" :size="18"/> {{ $t(\'home.openDaybook\') }}</button>' +
        '<div class="seg-scroll"><button v-for="k in [\'all\', \'free\', \'occupied\', \'maintenance\']" :key="k" class="seg" :class="[\'s-\' + k, {on: filter === k}]" @click="filter = k">' +
        '{{ $t(\'home.f_\' + k) }} <b>{{ $n(counts[k]) }}</b></button></div>' +

        '<div class="rk-grid">' +
        '<div v-for="c in shown" :key="c.r.id" class="rk" :class="c.status" @click="$can(\'entries\', \'create\') && open(c)">' +
        '<div class="rk-top"><span class="rk-no">{{ c.r.number }}</span><span class="tag" :class="c.status">{{ $t(\'home.s_\' + c.status) }}</span></div>' +
        '<div class="rk-owner" v-if="c.owner">{{ c.owner }}</div>' +
        '<div class="rk-driver" :class="{none: !c.driver}"><avatar v-if="c.driver" :id="c.driver.photo_id" :name="c.driver.name" :size="22"/><ic v-else name="user" :size="15"/> {{ c.driver ? c.driver.name : $t(\'home.noDriver\') }}</div>' +
        '<div v-if="c.entries.length" class="rk-money"><span>{{ $t(\'entry.deposit\') }} <b>{{ $m(c.t.deposit) }}</b></span><span :class="{neg: c.t.net < 0}">{{ $t(\'entry.net\') }} <b>{{ $m(c.t.net) }}</b></span></div>' +
        '<div v-else-if="c.expected" class="rk-exp">{{ $t(\'home.expected\') }} {{ $m(c.expected) }}</div>' +
        '<div v-if="c.due" class="rk-due">{{ $t(\'home.due\') }} {{ $m(c.due) }}</div>' +
        '<div class="rk-actions" @click.stop>' +
        '<button v-if="c.status === \'free\' && $can(\'assignments\', \'create\')" class="mini" @click="assign(c)"><ic name="user" :size="14"/> {{ $t(\'home.assignDriver\') }}</button>' +
        '<button v-if="c.entries.length > 1" class="mini" @click="edit(c.entries[c.entries.length - 1])">{{ $n(c.entries.length) }}x</button>' +
        '<button v-if="c.status !== \'inactive\' && $can(\'entries\', \'create\')" class="mini pri" @click="addEntry(c)"><ic name="plus" :size="14"/> {{ $t(\'home.addEntry\') }}</button>' +
        '</div></div></div>' +
        '<empty v-if="!shown.length" icon="rickshaw" :text="$t(\'home.nothing\')"/>' +
        '</template>' +

        '<button v-if="cards.length && $can(\'entries\', \'create\')" class="fab" @click="entrySheet = {entry: null, rickshawId: \'\'}" :aria-label="$t(\'entry.new\')"><ic name="plus" :size="26"/></button>' +
        '<entry-sheet v-if="entrySheet" :entry="entrySheet.entry" :rickshaw-id="entrySheet.rickshawId" :date="date" @close="entrySheet = null"/>' +
        '<assign-sheet v-if="assignSheet" :assignment="assignSheet.assignment" :rickshaw-id="assignSheet.rickshawId" :date="date" @close="assignSheet = null"/>' +
        '</div>',
    });
  });
})();
