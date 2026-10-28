// Read-only look at one day's entry: money, times, note and the driver.
// Used by rickshaw owners, who may see everything about their rickshaws but change nothing.
(function () {
  var RM = window.RM;
  var D = RM.data, B = RM.biz;

  RM.installers.push(function (app) {
    app.component('entry-view', {
      props: { entry: Object },
      emits: ['close'],
      data: function () { return { driverSheet: null }; },
      computed: {
        e: function () { return this.entry; },
        driver: function () { return this.e.driver_id ? D.get('drivers', this.e.driver_id) : null; },
        rickshaw: function () { return B.rickshawNumber(this.e.rickshaw_id) || '—'; },
        net: function () { return B.net(this.e); },
        done: function () { return B.num(this.e.deposit) > 0; },
      },
      template: '<sheet :title="rickshaw + \' · \' + $d(e.entry_date)" @close="$emit(\'close\')">' +
        '<div class="ev-top"><span class="tag" :class="done ? \'done\' : \'free\'">{{ done ? $t(\'home.s_done\') : $t(\'entryview.notDeposited\') }}</span></div>' +

        '<button v-if="driver" class="ev-driver" @click="driverSheet = driver">' +
        '<avatar :id="driver.photo_id" :name="driver.name" :size="46"/>' +
        '<div class="ev-dn"><small class="muted">{{ $t(\'entry.driver\') }}</small><b>{{ driver.name }}</b><span v-if="driver.phone" class="muted">{{ driver.phone }}</span></div>' +
        '<ic name="right" :size="18"/></button>' +
        '<div v-else class="di-row"><span>{{ $t(\'entry.driver\') }}</span><b class="muted">{{ $t(\'entry.noDriver\') }}</b></div>' +

        '<div class="ev-money">' +
        '<div class="pl"><span>{{ $t(\'entry.deposit\') }}</span><b class="c-dep">{{ $m(e.deposit || 0) }}</b></div>' +
        '<div class="pl"><span>{{ $t(\'entry.charge\') }}</span><b class="c-chg">− {{ $m(e.garage_charge || 0) }}</b></div>' +
        '<div v-if="e.expense" class="pl"><span>{{ $t(\'entry.expense\') }}<small v-if="e.expense_type" class="muted"> ({{ $t(\'exp.\' + e.expense_type) }})</small></span><b class="c-exp">− {{ $m(e.expense) }}</b></div>' +
        '<div v-if="e.due" class="pl"><span>{{ $t(\'home.due\') }}</span><b class="c-due">− {{ $m(e.due) }}</b></div>' +
        '<div class="pl total"><span>{{ $t(\'entry.net\') }}</span><b :class="{neg: net < 0}">{{ $m(net) }}</b></div></div>' +

        '<div v-if="e.taken_time" class="di-row"><span>{{ $t(\'entryview.out\') }}</span><b>{{ $time(e.taken_time) }}</b></div>' +
        '<div v-if="e.deposit_time" class="di-row"><span>{{ $t(\'entryview.in\') }}</span><b>{{ $time(e.deposit_time) }}</b></div>' +
        '<div v-if="e.note" class="ev-note"><small class="muted">{{ $t(\'entry.note\') }}</small><p>{{ e.note }}</p></div>' +
        '<p v-if="!e.taken_time && !e.deposit_time && !e.note" class="muted small center-t ev-empty">{{ $t(\'entryview.noMore\') }}</p>' +
        '<driver-info v-if="driverSheet" :driver="driverSheet" @close="driverSheet = null"/>' +
        '</sheet>',
    });
  });
})();
