// Forms: daily entry and driver assignment.
(function () {
  var RM = window.RM;
  var U = RM.util, D = RM.data, B = RM.biz;

  RM.opts = {
    expenseTypes: function () {
      return ['maintenance', 'repair', 'battery', 'other'].map(function (k) { return { v: k, l: RM.t('exp.' + k) }; });
    },
    categories: function () {
      return ['rent', 'electricity', 'tools', 'security', 'salary', 'other'].map(function (k) { return { v: k, l: RM.t('cat.' + k) }; });
    },
    statuses: function () {
      return ['active', 'maintenance', 'inactive'].map(function (k) { return { v: k, l: RM.t('status.' + k) }; });
    },
  };
  RM.colors = {
    deposit: 'var(--c-dep)', expense: 'var(--c-exp)', charge: 'var(--c-chg)', net: 'var(--c-net)',
    palette: ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#a855f7', '#f97316'],
  };

  function formOf(e) {
    var v = function (x) { return x === null || x === undefined ? '' : x; };
    return {
      driver_id: e.driver_id || '', deposit: v(e.deposit), expense: v(e.expense), expense_type: e.expense_type || '',
      garage_charge: v(e.garage_charge), taken_time: e.taken_time || '', deposit_time: e.deposit_time || '', note: e.note || '',
    };
  }

  function install(app) {
    app.component('entry-sheet', {
      props: { entry: Object, rickshawId: String, date: String },
      emits: ['close', 'saved'],
      data: function () {
        var e = this.entry;
        var f = e ? {
          rickshaw_id: e.rickshaw_id, entry_date: e.entry_date, driver_id: e.driver_id || '',
          deposit: e.deposit === null || e.deposit === undefined ? '' : e.deposit,
          expense: e.expense === null || e.expense === undefined ? '' : e.expense,
          expense_type: e.expense_type || '',
          garage_charge: e.garage_charge === null || e.garage_charge === undefined ? '' : e.garage_charge,
          taken_time: e.taken_time || '', deposit_time: e.deposit_time || '', note: e.note || '',
        } : {
          rickshaw_id: this.rickshawId || '', entry_date: this.date || U.today(), driver_id: '',
          deposit: '', expense: '', expense_type: '', garage_charge: '', taken_time: '', deposit_time: '', note: '',
        };
        return {
          f: f, err: '', touched: { driver: !!e, charge: !!e }, target: e || null, saving: false,
          more: !!(e && (e.taken_time || e.deposit_time || e.note)),
        };
      },
      created: function () { this.autofill(); },
      computed: {
        rickshaws: function () {
          var self = this;
          return B.rickshaws().filter(function (r) { return r.status !== 'inactive' || r.id === self.f.rickshaw_id; });
        },
        drivers: function () {
          var self = this;
          return D.list('drivers').filter(function (d) { return d.is_active !== false || d.id === self.f.driver_id; })
            .slice().sort(function (a, b) { return U.natural(a.name, b.name); });
        },
        rickshaw: function () { return D.get('rickshaws', this.f.rickshaw_id); },
        expected: function () {
          return this.rickshaw && this.f.entry_date ? B.expectedRent(this.rickshaw, this.f.entry_date) : null;
        },
        /** Editing an entry and moving it onto a day that already has one is not allowed. */
        dup: function () {
          var self = this;
          if (!this.entry || !this.f.rickshaw_id) return null;
          var other = B.entryFor(this.f.rickshaw_id, this.f.entry_date);
          return other && other.id !== self.entry.id ? other : null;
        },
        net: function () {
          return B.num(this.f.deposit) - B.num(this.f.expense) - B.num(this.f.garage_charge);
        },
      },
      watch: {
        'f.rickshaw_id': function () { this.autofill(); },
        'f.entry_date': function () { this.autofill(); },
      },
      methods: {
        /** A new entry for a rickshaw/day that already has one becomes an update of that one. */
        pickExisting: function () {
          var ex = B.entryFor(this.f.rickshaw_id, this.f.entry_date);
          if (ex) {
            if (!this.target || this.target.id !== ex.id) {
              this.target = ex;
              Object.assign(this.f, formOf(ex));
              this.touched.driver = true; this.touched.charge = true;
              this.more = !!(ex.taken_time || ex.deposit_time || ex.note);
            }
            return true;
          }
          if (this.target) { // moved on to a day without an entry: start from a clean sheet
            this.target = null;
            Object.assign(this.f, { deposit: '', expense: '', expense_type: '', garage_charge: '', taken_time: '', deposit_time: '', note: '' });
            this.touched.driver = false; this.touched.charge = false;
          }
          return false;
        },
        autofill: function () {
          if (!this.f.rickshaw_id || !this.f.entry_date) return;
          if (!this.entry && this.pickExisting()) return;
          if (!this.touched.driver) {
            var d = B.driverOn(this.f.rickshaw_id, this.f.entry_date);
            this.f.driver_id = d ? d.id : '';
          }
          if (!this.touched.charge && this.rickshaw) {
            var c = this.rickshaw.default_charge;
            this.f.garage_charge = c === null || c === undefined ? '' : c;
          }
        },
        fillExpected: function () { if (this.expected !== null) this.f.deposit = this.expected; },
        save: function () {
          if (this.saving) return; // a second tap must not save again
          if (!this.f.rickshaw_id || !this.f.entry_date) { this.err = this.$t('entry.needRickshaw'); return; }
          if (this.dup) { this.err = this.$t('entry.dupBlock'); return; }
          var f = this.f, n = U.numOrNull;
          var row = {
            rickshaw_id: f.rickshaw_id, entry_date: f.entry_date,
            driver_id: f.driver_id || null, owner_id: this.rickshaw ? this.rickshaw.owner_id || null : null,
            deposit: n(f.deposit), expense: n(f.expense), expense_type: n(f.expense) ? (f.expense_type || null) : null,
            garage_charge: n(f.garage_charge), taken_time: f.taken_time || null, deposit_time: f.deposit_time || null,
            note: (f.note || '').trim() || null,
          };
          // same id for the same rickshaw + day: saving twice updates, never duplicates
          row.id = this.target ? this.target.id : U.entryId(f.rickshaw_id, f.entry_date);
          this.saving = true;
          D.save('entries', row);
          RM.toast(this.$t('common.saved'), 'ok');
          this.$emit('saved');
          this.$emit('close');
        },
        remove: function () {
          var self = this;
          RM.confirm(this.$t('entry.deleteAsk'), { danger: true, ok: this.$t('common.delete') }).then(function (ok) {
            if (!ok) return;
            D.remove('entries', self.target.id);
            RM.toast(self.$t('common.deleted'));
            self.$emit('close');
          });
        },
      },
      template: '<sheet :title="target ? $t(\'entry.edit\') : $t(\'entry.new\')" @close="$emit(\'close\')"><form @submit.prevent="save">' +
        '<div class="row2">' +
        '<fld :label="$t(\'entry.rickshaw\')" req><select v-model="f.rickshaw_id"><option value="">{{ $t(\'common.choose\') }}</option><option v-for="r in rickshaws" :key="r.id" :value="r.id">{{ r.number }}</option></select></fld>' +
        '<fld :label="$t(\'entry.date\')" req><input type="date" v-model="f.entry_date" required></fld>' +
        '</div>' +
        '<p v-if="dup" class="note warn"><ic name="alert" :size="16"/> {{ $t(\'entry.dupBlock\') }}</p>' +
        '<p v-else-if="!entry && target" class="note"><ic name="info" :size="16"/> {{ $t(\'entry.existsUpdate\') }}</p>' +
        '<fld :label="$t(\'entry.driver\')"><select v-model="f.driver_id" @change="touched.driver = true"><option value="">{{ $t(\'entry.noDriver\') }}</option><option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option></select></fld>' +
        '<fld :label="$t(\'entry.deposit\')"><div class="money-in"><span>৳</span><input type="number" inputmode="decimal" min="0" step="any" v-model="f.deposit" :placeholder="expected !== null ? String(expected) : \'0\'"></div>' +
        '<button v-if="expected !== null && f.deposit === \'\'" type="button" class="link-btn" @click="fillExpected">{{ $t(\'entry.useExpected\') }}: {{ $m(expected) }}</button></fld>' +
        '<div class="row2">' +
        '<fld :label="$t(\'entry.expense\')"><div class="money-in"><span>৳</span><input type="number" inputmode="decimal" min="0" step="any" v-model="f.expense" placeholder="0"></div></fld>' +
        '<fld :label="$t(\'entry.charge\')"><div class="money-in"><span>৳</span><input type="number" inputmode="decimal" min="0" step="any" v-model="f.garage_charge" @input="touched.charge = true" placeholder="0"></div></fld>' +
        '</div>' +
        '<fld v-if="f.expense !== \'\' && Number(f.expense) > 0" :label="$t(\'entry.expenseType\')"><chips v-model="f.expense_type" :options="$opts.expenseTypes()" allow-none/></fld>' +
        '<div class="net-line" :class="{neg: net < 0}"><span>{{ $netLabel() }}</span><b>{{ $m(net) }}</b></div>' +
        '<button type="button" class="link-btn" @click="more = !more">{{ more ? $t(\'entry.lessOptions\') : $t(\'entry.moreOptions\') }}</button>' +
        '<div v-if="more"><div class="row2">' +
        '<fld :label="$t(\'entry.takenTime\')"><input type="time" v-model="f.taken_time"></fld>' +
        '<fld :label="$t(\'entry.depositTime\')"><input type="time" v-model="f.deposit_time"></fld></div>' +
        '<fld :label="$t(\'entry.note\')"><textarea rows="2" v-model="f.note"></textarea></fld></div>' +
        '<p v-if="err" class="form-err">{{ err }}</p>' +
        '<div class="sheet-actions">' +
        '<button v-if="target && $can(\'entries\', \'delete\')" type="button" class="btn danger-o" @click="remove"><ic name="trash" :size="18"/></button>' +
        '<button class="btn primary grow" type="submit" :disabled="saving"><ic name="check" :size="18"/> {{ $t(\'common.save\') }}</button>' +
        '</div></form></sheet>',
    });

    app.component('assign-sheet', {
      props: { assignment: Object, rickshawId: String, date: String },
      emits: ['close'],
      data: function () {
        var a = this.assignment;
        return {
          f: a ? {
            rickshaw_id: a.rickshaw_id, driver_id: a.driver_id, start_date: a.start_date, end_date: a.end_date || '',
            expected_rent: a.expected_rent === null || a.expected_rent === undefined ? '' : a.expected_rent, note: a.note || '',
          } : {
            rickshaw_id: this.rickshawId || '', driver_id: '', start_date: this.date || U.today(), end_date: '',
            expected_rent: '', note: '',
          },
          ongoing: a ? !a.end_date : true, err: '',
        };
      },
      computed: {
        rickshaws: function () { return B.rickshaws().filter(function (r) { return r.status !== 'inactive'; }); },
        drivers: function () {
          var self = this;
          return D.list('drivers').filter(function (d) { return d.is_active !== false || d.id === self.f.driver_id; })
            .slice().sort(function (a, b) { return U.natural(a.name, b.name); });
        },
        rickshaw: function () { return D.get('rickshaws', this.f.rickshaw_id); },
      },
      methods: {
        save: function () {
          var f = this.f, self = this;
          if (!f.rickshaw_id || !f.driver_id || !f.start_date) { this.err = this.$t('assign.needAll'); return; }
          var end = this.ongoing ? null : (f.end_date || null);
          if (end && end < f.start_date) { this.err = this.$t('assign.badDates'); return; }
          var id = this.assignment ? this.assignment.id : null;

          var clash = B.overlap(f.rickshaw_id, f.start_date, end, id);
          if (clash) {
            this.err = this.$t('assign.clash', {
              driver: B.driverName(clash.driver_id),
              from: this.$d(clash.start_date), to: clash.end_date ? this.$d(clash.end_date) : this.$t('assign.ongoing'),
            });
            return;
          }
          var save = function () {
            var row = {
              rickshaw_id: f.rickshaw_id, driver_id: f.driver_id, start_date: f.start_date, end_date: end,
              expected_rent: U.numOrNull(f.expected_rent), note: (f.note || '').trim() || null,
            };
            if (id) row.id = id;
            D.save('assignments', row);
            RM.toast(self.$t('common.saved'), 'ok');
            self.$emit('close');
          };
          var busy = B.driverBusy(f.driver_id, f.start_date, end, id);
          if (busy) {
            RM.confirm(this.$t('assign.driverBusy', { rickshaw: B.rickshawNumber(busy.rickshaw_id) }), { ok: this.$t('assign.keep') })
              .then(function (ok) { if (ok) save(); });
          } else save();
        },
        remove: function () {
          var self = this;
          RM.confirm(this.$t('assign.deleteAsk'), { danger: true, ok: this.$t('common.delete') }).then(function (ok) {
            if (!ok) return;
            D.remove('assignments', self.assignment.id);
            RM.toast(self.$t('common.deleted'));
            self.$emit('close');
          });
        },
      },
      template: '<sheet :title="assignment ? $t(\'assign.edit\') : $t(\'assign.new\')" @close="$emit(\'close\')"><form @submit.prevent="save">' +
        '<fld :label="$t(\'entry.rickshaw\')" req><select v-model="f.rickshaw_id"><option value="">{{ $t(\'common.choose\') }}</option><option v-for="r in rickshaws" :key="r.id" :value="r.id">{{ r.number }}</option></select></fld>' +
        '<fld :label="$t(\'entry.driver\')" req><select v-model="f.driver_id"><option value="">{{ $t(\'common.choose\') }}</option><option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option></select></fld>' +
        '<div class="row2"><fld :label="$t(\'assign.from\')" req><input type="date" v-model="f.start_date" required></fld>' +
        '<fld :label="$t(\'assign.to\')"><input type="date" v-model="f.end_date" :disabled="ongoing" :min="f.start_date"></fld></div>' +
        '<label class="switch-row"><span>{{ $t(\'assign.noEnd\') }}</span><input type="checkbox" class="switch" v-model="ongoing"></label>' +
        '<fld :label="$t(\'assign.expectedRent\')" :hint="rickshaw && rickshaw.default_rent ? $t(\'assign.defaultIs\') + \' \' + $m(rickshaw.default_rent) : \'\'"><div class="money-in"><span>৳</span><input type="number" inputmode="decimal" min="0" step="any" v-model="f.expected_rent" placeholder="0"></div></fld>' +
        '<fld :label="$t(\'entry.note\')"><textarea rows="2" v-model="f.note"></textarea></fld>' +
        '<p v-if="err" class="form-err">{{ err }}</p>' +
        '<div class="sheet-actions">' +
        '<button v-if="assignment" type="button" class="btn danger-o" @click="remove"><ic name="trash" :size="18"/></button>' +
        '<button class="btn primary grow" type="submit"><ic name="check" :size="18"/> {{ $t(\'common.save\') }}</button>' +
        '</div></form></sheet>',
    });
  }

  RM.installSheets = install;
})();
