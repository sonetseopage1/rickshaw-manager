// Pictures: profile photos, driver photos and NID scans.
// A picture is shrunk on the phone, kept in IndexedDB, and uploaded when there is internet.
// Other devices download it on demand (the server only serves it to signed-in garage members).
(function () {
  var RM = window.RM;
  var reactive = Vue.reactive;

  var LIMITS = { avatar: [512, 0.85], driver_photo: [900, 0.82], nid_front: [1600, 0.85], nid_back: [1600, 0.85] };

  var rev = reactive({ n: 0 });
  var cache = {};     // id -> { url }
  var loading = {};   // id -> true while a load is running
  var missing = {};   // id -> time of the last "not on the server yet"

  function token() { return RM.state.session && RM.state.session.token; }

  function compress(file, kind) {
    var lim = LIMITS[kind] || LIMITS.driver_photo;
    return new Promise(function (resolve, reject) {
      function draw(img, w, h) {
        var scale = Math.min(1, lim[0] / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('compress')); }, 'image/jpeg', lim[1]);
      }
      if (window.createImageBitmap) {
        createImageBitmap(file).then(function (bmp) { draw(bmp, bmp.width, bmp.height); }, fallback);
      } else fallback();
      function fallback() {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
        img.src = url;
      }
    });
  }

  function remember(id, blob) {
    if (cache[id] && cache[id].url) URL.revokeObjectURL(cache[id].url);
    cache[id] = { url: URL.createObjectURL(blob) };
    delete missing[id];
    rev.n++;
  }

  /** Store a freshly taken picture locally (to be uploaded later) and return its id. */
  function add(blob, kind) {
    var id = RM.util.uuid();
    remember(id, blob);
    RM.db.put('files', { id: id, kind: kind, blob: blob, state: 'pending' });
    return id;
  }

  function sendOne(rec) {
    var fd = new FormData();
    fd.append('id', rec.id);
    fd.append('kind', rec.kind);
    fd.append('file', rec.blob, rec.id + '.jpg');
    return fetch(RM.api.base() + '/files', {
      method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer ' + token() }, body: fd,
    }).then(function (r) {
      if (r.ok) { rec.state = 'cached'; return RM.db.put('files', rec); }
      if (r.status === 401 || r.status === 403 && rec.kind !== 'avatar') { /* not allowed: keep local copy, stop retrying */ rec.state = 'rejected'; return RM.db.put('files', rec); }
      if (r.status === 422) { rec.state = 'rejected'; return RM.db.put('files', rec); }
      throw new Error('HTTP ' + r.status); // 402 or server trouble: try again later
    });
  }

  /** Upload everything still waiting. Never rejects. */
  function uploadPending() {
    if (!token()) return Promise.resolve();
    return RM.db.getAll('files').then(function (all) {
      var todo = all.filter(function (r) { return r.state === 'pending' && r.blob; });
      return todo.reduce(function (p, rec) { return p.then(function () { return sendOne(rec); }); }, Promise.resolve());
    }).catch(function () { /* offline: retry on the next sync */ });
  }

  /** Upload one picture right now (rejects when offline). */
  function uploadNow(id) {
    return RM.db.getOne('files', id).then(function (rec) {
      if (!rec) throw new Error('missing');
      if (rec.state === 'cached') return;
      return sendOne(rec);
    });
  }

  function fetchRemote(id) {
    if (!token() || !navigator.onLine) { loading[id] = false; return; }
    return fetch(RM.api.base() + '/files/' + id, { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) {
      if (!r.ok) { missing[id] = Date.now(); return null; }
      return r.blob();
    }).then(function (blob) {
      if (!blob) return;
      remember(id, blob);
      RM.db.put('files', { id: id, kind: 'remote', blob: blob, state: 'cached' });
    }).catch(function () { /* offline */ }).then(function () { loading[id] = false; });
  }

  function load(id) {
    loading[id] = true;
    RM.db.getOne('files', id).then(function (rec) {
      if (rec && rec.blob) { remember(id, rec.blob); loading[id] = false; return; }
      return fetchRemote(id);
    });
  }

  /** Object URL for a picture id, or null while it is still being fetched. Reactive. */
  function url(id) {
    rev.n; // re-render when something finished loading
    if (!id) return null;
    if (cache[id]) return cache[id].url;
    if (!loading[id] && !(missing[id] && Date.now() - missing[id] < 60000)) load(id);
    return null;
  }

  /** After a sync other devices may have uploaded what was missing before. */
  function retryMissing() {
    var any = false;
    Object.keys(missing).forEach(function (k) { delete missing[k]; any = true; });
    if (any) rev.n++;
  }

  function reset() {
    Object.keys(cache).forEach(function (k) { URL.revokeObjectURL(cache[k].url); });
    cache = {}; loading = {}; missing = {};
    rev.n++;
  }

  RM.files = { compress: compress, add: add, url: url, uploadPending: uploadPending, uploadNow: uploadNow, retryMissing: retryMissing, reset: reset };

  RM.installFiles = function (app) {
    /** Round picture, or the first letter of the name when there is none. */
    app.component('avatar', {
      props: { id: String, name: String, size: { type: Number, default: 40 } },
      computed: {
        src: function () { return RM.files.url(this.id); },
        letter: function () { return (this.name || '?').trim().charAt(0).toUpperCase(); },
      },
      template: '<span class="avatar-c" :style="{width: size + \'px\', height: size + \'px\', fontSize: Math.round(size * 0.42) + \'px\'}">' +
        '<img v-if="src" :src="src" alt="">' +
        '<template v-else>{{ letter }}</template></span>',
    });

    /** Picture input used inside forms: shows the picture, lets the user take or choose another. */
    app.component('photo-field', {
      props: { modelValue: String, kind: String, wide: Boolean },
      emits: ['update:modelValue'],
      data: function () { return { busy: false, err: '' }; },
      computed: {
        src: function () { return RM.files.url(this.modelValue); },
      },
      methods: {
        pick: function (ev) {
          var self = this, f = ev.target.files && ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          this.busy = true; this.err = '';
          RM.files.compress(f, this.kind).then(function (blob) {
            self.$emit('update:modelValue', RM.files.add(blob, self.kind));
            RM.sync.schedule();
          }).catch(function () { self.err = self.$t('photo.failed'); }).then(function () { self.busy = false; });
        },
        open: function () { if (this.src) RM.ui.lightbox = this.src; },
      },
      template: '<div class="photo-field" :class="{wide: wide}">' +
        '<button type="button" class="photo-box" @click="open" :aria-label="$t(\'photo.view\')">' +
        '<img v-if="src" :src="src" alt=""><span v-else-if="busy" class="spinner small"></span>' +
        '<span v-else class="photo-empty"><ic name="user" :size="26"/><small>{{ $t(\'photo.none\') }}</small></span></button>' +
        '<div class="photo-btns">' +
        '<label class="btn soft sm"><ic name="camera" :size="16"/> {{ $t(\'photo.camera\') }}<input type="file" accept="image/*" capture="environment" @change="pick" hidden></label>' +
        '<label class="btn soft sm"><ic name="image" :size="16"/> {{ $t(\'photo.gallery\') }}<input type="file" accept="image/*" @change="pick" hidden></label>' +
        '<button v-if="modelValue" type="button" class="btn danger-o sm" @click="$emit(\'update:modelValue\', \'\')"><ic name="trash" :size="16"/></button>' +
        '</div><small v-if="err" class="form-err">{{ err }}</small></div>',
    });
  };
})();
