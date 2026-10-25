// Shared UI building blocks: icons, bottom sheets, dialogs, toasts, form sheet.
(function () {
  var RM = window.RM;
  var reactive = Vue.reactive;

  var ICONS = {
    home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    plus: 'M12 5v14M5 12h14',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    left: 'M15 18l-6-6 6-6',
    right: 'M9 18l6-6-6-6',
    down: 'M6 9l6 6 6-6',
    trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
    receipt: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    menu: 'M3 12h18M3 6h18M3 18h18',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    sync: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
    wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z',
    bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    rickshaw: 'M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 14l3-7h5l2 7M13 7h4l2 7M8 10h6',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    building: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35',
    key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  };

  /* ---------- global dialog + toast state ---------- */
  var ui = reactive({ dialog: null, toast: '', toastKind: '' });
  var toastTimer = null;

  RM.toast = function (msg, kind) {
    ui.toast = msg; ui.toastKind = kind || '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast = ''; }, 3200);
  };

  RM.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      ui.dialog = {
        message: message, danger: !!opts.danger, ok: opts.ok, cancel: opts.cancel, title: opts.title,
        done: function (v) { ui.dialog = null; resolve(v); },
      };
    });
  };
  RM.ui = ui;

  /* ---------- bottom sheets with Android back-button support ---------- */
  var stack = [];
  var ignoreNext = 0;
  window.addEventListener('popstate', function () {
    if (ignoreNext > 0) { ignoreNext--; return; }
    var top = stack[stack.length - 1];
    if (top) { top.popped = true; top.$emit('close'); }
  });

  function install(app) {
    app.component('ic', {
      props: { name: String, size: { type: Number, default: 22 } },
      computed: { d: function () { return ICONS[this.name] || ''; } },
      template: '<svg class="ic" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="d"/></svg>',
    });

    app.component('sheet', {
      props: { title: String, wide: Boolean },
      emits: ['close'],
      mounted: function () {
        stack.push(this);
        history.pushState({ rmSheet: 1 }, '');
        document.body.classList.add('noscroll');
      },
      unmounted: function () {
        var i = stack.indexOf(this);
        if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.body.classList.remove('noscroll');
        if (!this.popped) { ignoreNext++; history.back(); }
      },
      template: '<div class="sheet-wrap" @click.self="$emit(\'close\')">' +
        '<div class="sheet" :class="{wide: wide}" role="dialog">' +
        '<div class="sheet-grab"></div>' +
        '<div class="sheet-head"><h3>{{ title }}</h3><button class="icon-btn" type="button" @click="$emit(\'close\')" :aria-label="$t(\'common.close\')"><ic name="x" :size="20"/></button></div>' +
        '<div class="sheet-body"><slot/></div>' +
        '</div></div>',
    });

    app.component('fld', {
      props: { label: String, hint: String, req: Boolean },
      template: '<label class="fld"><span class="fld-l">{{ label }}<b v-if="req" class="req"> *</b></span><slot/><small v-if="hint" class="hint">{{ hint }}</small></label>',
    });

    app.component('chips', {
      props: { modelValue: [String, Number, Boolean], options: Array, allowNone: Boolean },
      emits: ['update:modelValue'],
      template: '<div class="chips"><button type="button" v-for="o in options" :key="o.v" class="chip" :class="{on: modelValue === o.v}" @click="$emit(\'update:modelValue\', (allowNone && modelValue === o.v) ? \'\' : o.v)">{{ o.l }}</button></div>',
    });

    app.component('empty', {
      props: { icon: { type: String, default: 'info' }, text: String },
      template: '<div class="empty"><ic :name="icon" :size="34"/><p>{{ text }}</p><slot/></div>',
    });

    app.component('confirm-dialog', {
      computed: { d: function () { return RM.ui.dialog; } },
      template: '<div v-if="d" class="dlg-wrap" @click.self="d.done(false)"><div class="dlg">' +
        '<h4 v-if="d.title">{{ d.title }}</h4><p>{{ d.message }}</p>' +
        '<div class="dlg-btns"><button class="btn ghost" @click="d.done(false)">{{ d.cancel || $t(\'common.cancel\') }}</button>' +
        '<button class="btn" :class="{danger: d.danger}" @click="d.done(true)">{{ d.ok || $t(\'common.ok\') }}</button></div></div></div>',
    });

    /**
     * Generic form inside a bottom sheet.
     * fields: [{key,label,type:text|tel|number|date|select|chips|textarea|switch,options,req,hint,placeholder}]
     */
    app.component('form-sheet', {
      props: { title: String, fields: Array, initial: Object, canDelete: Boolean, deleteText: String, saveText: String },
      emits: ['close', 'save', 'delete'],
      data: function () {
        var f = {};
        var init = this.initial || {};
        this.fields.forEach(function (x) {
          var v = init[x.key];
          f[x.key] = v === undefined || v === null ? (x.type === 'switch' ? !!x.def : (x.def !== undefined ? x.def : '')) : v;
        });
        return { f: f, err: '' };
      },
      methods: {
        submit: function () {
          for (var i = 0; i < this.fields.length; i++) {
            var x = this.fields[i];
            if (x.req && (this.f[x.key] === '' || this.f[x.key] === null)) { this.err = x.label; return; }
          }
          this.err = '';
          var out = {};
          var self = this;
          this.fields.forEach(function (x) {
            var v = self.f[x.key];
            if (x.type === 'number') v = RM.util.numOrNull(v);
            else if (typeof v === 'string') { v = v.trim(); if (v === '') v = null; }
            out[x.key] = v;
          });
          this.$emit('save', out);
        },
      },
      template: '<sheet :title="title" @close="$emit(\'close\')"><form @submit.prevent="submit">' +
        '<template v-for="x in fields" :key="x.key">' +
        '<fld v-if="x.type !== \'switch\'" :label="x.label" :req="x.req" :hint="x.hint">' +
        '<chips v-if="x.type === \'chips\'" v-model="f[x.key]" :options="x.options"/>' +
        '<select v-else-if="x.type === \'select\'" v-model="f[x.key]"><option v-for="o in x.options" :key="o.v" :value="o.v">{{ o.l }}</option></select>' +
        '<textarea v-else-if="x.type === \'textarea\'" rows="2" v-model="f[x.key]"></textarea>' +
        '<input v-else :type="x.type || \'text\'" :inputmode="x.type === \'number\' ? \'decimal\' : null" :step="x.type === \'number\' ? \'any\' : null" :min="x.type === \'number\' ? 0 : null" v-model="f[x.key]" :placeholder="x.placeholder" :required="x.req">' +
        '</fld>' +
        '<label v-else class="switch-row"><span>{{ x.label }}</span><input type="checkbox" v-model="f[x.key]" class="switch"></label>' +
        '</template>' +
        '<p v-if="err" class="form-err">{{ $t(\'common.required\') }}: {{ err }}</p>' +
        '<div class="sheet-actions">' +
        '<button v-if="canDelete" type="button" class="btn danger-o" @click="$emit(\'delete\')"><ic name="trash" :size="18"/> {{ deleteText || $t(\'common.delete\') }}</button>' +
        '<button class="btn primary grow" type="submit"><ic name="check" :size="18"/> {{ saveText || $t(\'common.save\') }}</button>' +
        '</div></form></sheet>',
    });
  }

  RM.installUi = install;
})();
