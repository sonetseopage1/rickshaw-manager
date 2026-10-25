// Daily notebook: one page, one row per rickshaw, like the paper register.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.installers.push(function (app) {
    app.component('page-daybook', {
      data: function () { return { rows: {}, loadedFor: '' }; },
      computed: {
        date: {
          get: function () { return RM.state.homeDate; },
          set: function (v) { RM.state.homeDate = v; },
        },
        list: function () {
          var date = this.date;
          return B.rickshaws().filter(function (r) { return r.status !== 'inactive'; }).map(function (r) {
            var es = B.entriesOn(date).filter(function (e) { return e.rickshaw_id === r.id; });
            return { r: r, driver: B.driverOn(r.id, date), entries: es, status: B.statusOn(r, date) };
          });
        },
        filled: function () {
          var self = this;
          return this.list.filter(function (x) { return self.dirty(x); }).length;
        },
      },
      watch: {
        date: function () { this.load(); },
        'list.length': function () { this.load(); },
      },
      created: function () { this.load(); },
      methods: {
        load: function () {
          var rows = {};
          this.list.forEach(function (x) {
            var e = x.entries[0];
            rows[x.r.id] = {
              deposit: e && e.deposit !== null && e.deposit !== undefined ? String(e.deposit) : '',
              charge: e && e.garage_charge !== null && e.garage_charge !== undefined ? String(e.garage_charge) : '',
              note: e && e.note ? e.note : '',
            };
          });
          this.rows = rows;
          this.loadedFor = this.date;
        },
        row: function (id) { return this.rows[id] || { deposit: '', charge: '', note: '' }; },
        original: function (x) {
          var e = x.entries[0];
          return {
            deposit: e && e.deposit !== null && e.deposit !== undefined ? String(e.deposit) : '',
            charge: e && e.garage_charge !== null && e.garage_charge !== undefined ? String(e.garage_charge) : '',
            note: e && e.note ? e.note : '',
          };
        },
        dirty: function (x) {
          var r = this.row(x.r.id), o = this.original(x);
          if (x.entries.length > 1) return false;
          return r.deposit !== o.deposit || r.charge !== o.charge || r.note !== o.note;
        },
        saveAll: function () {
          var self = this, n = 0, date = this.date;
          this.list.forEach(function (x) {
            if (!self.dirty(x)) return;
            var r = self.row(x.r.id), e = x.entries[0];
            var dep = U.numOrNull(r.deposit), chg = U.numOrNull(r.charge);
            var hasAny = dep !== null || chg !== null || (r.note || '').trim() !== '';
            if (!e && !hasAny) return;
            if (chg === null && dep !== null && x.r.default_charge !== null && x.r.default_charge !== undefined && !e) chg = x.r.default_charge;
            var row = {
              rickshaw_id: x.r.id, entry_date: date, driver_id: x.driver ? x.driver.id : (e ? e.driver_id : null),
              owner_id: x.r.owner_id || null, deposit: dep, garage_charge: chg, note: (r.note || '').trim() || null,
            };
            if (e) row.id = e.id;
            D.save('entries', row);
            n++;
          });
          RM.toast(n ? this.$t('daybook.saved', { n: this.$n(n) }) : this.$t('daybook.nothing'), n ? 'ok' : '');
          this.load();
        },
        expectedOf: function (x) {
          var v = B.expectedRent(x.r, this.date);
          return v === null || v === undefined ? '0' : String(v);
        },
        placeholderCharge: function (x) {
          var c = x.r.default_charge;
          return c === null || c === undefined ? '0' : String(c);
        },
      },
      template: '<div class="page">' +
        '<date-nav v-model="date"/>' +
        '<p class="muted small">{{ $t(\'daybook.hint\') }}</p>' +
        '<empty v-if="!list.length" icon="rickshaw" :text="$t(\'assign.noRickshaw\')"/>' +
        '<div v-if="list.length" class="dbk-head"><span>{{ $t(\'entry.rickshaw\') }} / {{ $t(\'entry.driver\') }}</span><span>{{ $t(\'entry.deposit\') }}</span><span>{{ $t(\'entry.charge\') }}</span></div>' +
        '<div v-for="x in list" :key="x.r.id" class="dbk-row" :class="[x.status, {changed: dirty(x)}]">' +
        '<div class="dbk-name"><b>{{ x.r.number }}</b><small :class="{muted: !x.driver}">{{ x.driver ? x.driver.name : $t(\'home.noDriver\') }}</small></div>' +
        '<template v-if="x.entries.length <= 1">' +
        '<input class="dbk-in" type="number" inputmode="decimal" min="0" step="any" v-model="rows[x.r.id].deposit" :placeholder="expectedOf(x)">' +
        '<input class="dbk-in" type="number" inputmode="decimal" min="0" step="any" v-model="rows[x.r.id].charge" :placeholder="placeholderCharge(x)">' +
        '<input class="dbk-note" v-model="rows[x.r.id].note" :placeholder="$t(\'entry.note\')">' +
        '</template>' +
        '<div v-else class="dbk-multi muted small">{{ $t(\'daybook.multi\', {n: $n(x.entries.length)}) }}</div>' +
        '</div>' +
        '<div v-if="list.length" class="dbk-bar"><button class="btn primary block" :disabled="!filled" @click="saveAll"><ic name="check" :size="18"/> {{ $t(\'daybook.saveAll\') }}<b v-if="filled"> ({{ $n(filled) }})</b></button></div>' +
        '</div>',
    });
  });

})();
