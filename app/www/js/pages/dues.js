// Outstanding amounts ("বাকি"): who still owes how much, grouped by driver.
// A due is the "due" field of a day's entry; when the driver pays, edit that entry and lower or clear it.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.state.duesOpen = {};

  RM.installers.push(function (app) {
    app.component('page-dues', {
      data: function () { return { sheet: null }; },
      computed: {
        open: function () { return RM.state.duesOpen; },
        groups: function () {
          var by = {};
          D.list('entries').forEach(function (e) {
            var amt = B.num(e.due);
            if (amt <= 0) return;
            var k = e.driver_id || '';
            var g = by[k] = by[k] || { id: k, items: [], total: 0 };
            g.items.push(e);
            g.total += amt;
          });
          return Object.keys(by).map(function (k) {
            var g = by[k], d = k ? D.get('drivers', k) : null;
            g.name = d ? d.name : '';
            g.photo = d ? d.photo_id : null;
            g.items.sort(function (a, b) { return b.entry_date.localeCompare(a.entry_date); });
            return g;
          }).sort(function (a, b) { return b.total - a.total; });
        },
        total: function () { return this.groups.reduce(function (a, g) { return a + g.total; }, 0); },
        days: function () { return this.groups.reduce(function (a, g) { return a + g.items.length; }, 0); },
      },
      methods: {
        toggle: function (id) { RM.state.duesOpen[id || '_'] = !RM.state.duesOpen[id || '_']; },
        isOpen: function (id) { return !!RM.state.duesOpen[id || '_']; },
        rn: function (id) { return B.rickshawNumber(id) || '—'; },
        edit: function (e) { if (RM.can('entries', 'update')) this.sheet = e; },
      },
      template: '<div class="page">' +
        '<div class="hero small"><div class="hero-main"><span>{{ $t(\'dues.total\') }}</span><b>{{ $m(total) }}</b></div>' +
        '<p class="hero-sub">{{ $n(groups.length) }} {{ $t(\'dues.drivers\') }} · {{ $n(days) }} {{ $t(\'reports.days\') }}</p></div>' +
        '<p class="muted small dues-hint">{{ $t(\'dues.hint\') }}</p>' +
        '<empty v-if="!groups.length" icon="wallet" :text="$t(\'dues.none\')"/>' +
        '<div v-for="g in groups" :key="g.id || \'_\'" class="due-group">' +
        '<div class="row-card" @click="toggle(g.id)">' +
        '<avatar :id="g.photo" :name="g.name || \'?\'" :size="44"/>' +
        '<div class="rc-main"><b>{{ g.name || $t(\'entry.noDriver\') }}</b><span class="muted">{{ $n(g.items.length) }} {{ $t(\'reports.days\') }}</span></div>' +
        '<div class="rc-side"><b class="c-due">{{ $m(g.total) }}</b></div><ic :name="isOpen(g.id) ? \'down\' : \'right\'" :size="18"/></div>' +
        '<div v-if="isOpen(g.id)" class="due-items">' +
        '<div v-for="e in g.items" :key="e.id" class="due-item" @click="edit(e)">' +
        '<span>{{ $d(e.entry_date) }}</span><span class="muted">{{ rn(e.rickshaw_id) }}</span><b class="c-due">{{ $m(e.due) }}</b>' +
        '<ic v-if="$can(\'entries\', \'update\')" name="edit" :size="15"/></div></div></div>' +
        '<entry-sheet v-if="sheet" :entry="sheet" :date="sheet.entry_date" @close="sheet = null"/>' +
        '</div>',
    });
  });
})();
