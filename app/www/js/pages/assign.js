// Assignments: which driver has which rickshaw, from which date to which date.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.assignDate = U.today();
  RM.state.assignShowPast = false;

  RM.installers.push(function (app) {
    app.component('page-assign', {
      data: function () { return { sheet: null }; },
      computed: {
        date: {
          get: function () { return RM.state.assignDate; },
          set: function (v) { RM.state.assignDate = v; },
        },
        showPast: {
          get: function () { return RM.state.assignShowPast; },
          set: function (v) { RM.state.assignShowPast = v; },
        },
        board: function () {
          var date = this.date;
          return B.rickshaws().filter(function (r) { return r.status !== 'inactive'; }).map(function (r) {
            return { r: r, status: B.statusOn(r, date), a: B.assignmentOn(r.id, date), driver: B.driverOn(r.id, date), owner: B.ownerName(r.owner_id) };
          });
        },
        counts: function () {
          var c = { free: 0, occupied: 0, maintenance: 0 };
          this.board.forEach(function (x) { c[x.status]++; });
          return c;
        },
        all: function () {
          var today = U.today(), past = this.showPast;
          return D.list('assignments').filter(function (a) {
            var ended = a.end_date && a.end_date < today;
            return past ? ended : !ended;
          }).sort(function (a, b) {
            return past ? (b.end_date || '').localeCompare(a.end_date || '') : a.start_date.localeCompare(b.start_date);
          });
        },
      },
      methods: {
        rn: function (id) { return B.rickshawNumber(id) || '—'; },
        dn: function (id) { return B.driverName(id) || '—'; },
        newFor: function (b) { this.sheet = { assignment: null, rickshawId: b.r.id }; },
        editFor: function (b) { this.sheet = { assignment: b.a, rickshawId: b.r.id }; },
        endToday: function (b) {
          var a = b.a, self = this;
          var end = U.addDays(this.date, -1);
          if (end < a.start_date) { this.sheet = { assignment: a, rickshawId: b.r.id }; return; }
          RM.confirm(this.$t('assign.endAsk', { date: this.$d(end) }), { ok: this.$t('assign.endNow') }).then(function (ok) {
            if (ok) { D.save('assignments', { id: a.id, end_date: end }); RM.toast(self.$t('common.saved'), 'ok'); }
          });
        },
      },
      template: '<div class="page">' +
        '<date-nav v-model="date"/>' +
        '<div class="occ-bar"><div class="occ free"><b>{{ $n(counts.free) }}</b><span>{{ $t(\'home.s_free\') }}</span></div>' +
        '<div class="occ occupied"><b>{{ $n(counts.occupied) }}</b><span>{{ $t(\'home.s_occupied\') }}</span></div>' +
        '<div class="occ maintenance"><b>{{ $n(counts.maintenance) }}</b><span>{{ $t(\'home.s_maintenance\') }}</span></div></div>' +

        '<h4 class="sec-title">{{ $t(\'assign.board\') }}</h4>' +
        '<empty v-if="!board.length" icon="rickshaw" :text="$t(\'assign.noRickshaw\')"/>' +
        '<div v-for="b in board" :key="b.r.id" class="row-card" :class="b.status">' +
        '<div class="rc-main"><b>{{ b.r.number }}</b><span class="muted">{{ b.owner }}</span></div>' +
        '<div class="rc-mid"><span v-if="b.driver" class="who"><ic name="user" :size="15"/> {{ b.driver.name }}</span>' +
        '<span v-else class="tag" :class="b.status">{{ $t(\'home.s_\' + b.status) }}</span>' +
        '<small v-if="b.a" class="muted">{{ $d(b.a.start_date) }} → {{ b.a.end_date ? $d(b.a.end_date) : $t(\'assign.ongoing\') }}</small></div>' +
        '<div class="rc-act">' +
        '<template v-if="$can(\'assignments\', \'update\')">' +
        '<button v-if="b.a" class="mini" @click="editFor(b)"><ic name="edit" :size="14"/></button>' +
        '<button v-if="b.a && !b.a.end_date || b.a && b.a.end_date > date" class="mini" @click="endToday(b)">{{ $t(\'assign.end\') }}</button>' +
        '<button v-if="!b.a && b.status !== \'maintenance\'" class="mini pri" @click="newFor(b)"><ic name="plus" :size="14"/> {{ $t(\'home.assignDriver\') }}</button>' +
        '</template></div></div>' +

        '<div class="toolbar between"><h4 class="sec-title">{{ $t(\'assign.all\') }}</h4>' +
        '<button class="pill-btn" @click="showPast = !showPast">{{ showPast ? $t(\'assign.showCurrent\') : $t(\'assign.showPast\') }}</button></div>' +
        '<empty v-if="!all.length" icon="calendar" :text="$t(\'assign.none\')"/>' +
        '<div v-for="a in all" :key="a.id" class="row-card" @click="$can(\'assignments\', \'update\') && (sheet = {assignment: a})">' +
        '<div class="rc-main"><b>{{ rn(a.rickshaw_id) }}</b><span class="muted">{{ dn(a.driver_id) }}</span></div>' +
        '<div class="rc-side"><small>{{ $d(a.start_date) }}</small><small>→ {{ a.end_date ? $d(a.end_date) : $t(\'assign.ongoing\') }}</small></div></div>' +

        '<button v-if="$can(\'assignments\', \'create\')" class="fab" @click="sheet = {assignment: null, rickshawId: \'\'}" :aria-label="$t(\'assign.new\')"><ic name="plus" :size="26"/></button>' +
        '<assign-sheet v-if="sheet" :assignment="sheet.assignment" :rickshaw-id="sheet.rickshawId" :date="date" @close="sheet = null"/>' +
        '</div>',
    });
  });
})();
