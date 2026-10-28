// Login / register screen.
(function () {
  var RM = window.RM;

  RM.installers.push(function (app) {
    app.component('page-auth', {
      data: function () {
        return {
          mode: 'login', busy: false, err: '', showServer: false,
          server: RM.util.ls.get('rm_server') || RM_CONFIG.SERVER,
          f: { name: '', login: '', password: '', garage_name: '' },
        };
      },
      computed: {
        lang: function () { return RM.state.lang; },
        native: function () { return RM.api.isNative(); },
      },
      methods: {
        setLang: function (l) { RM.setLang(l); },
        errText: function (e) {
          if (e.offline) return this.$t('auth.offline');
          if (e.code === 'bad_credentials') return this.$t('auth.wrong');
          if (e.code === 'blocked') return e.message || this.$t('auth.blocked');
          if (e.code === 'closed') return this.$t('auth.closed');
          if (e.status === 422 && e.data && e.data.errors) return e.data.errors.login ? this.$t('auth.taken') : this.$t('auth.fillAll');
          if (e.status === 429) return this.$t('auth.tooMany');
          return e.message;
        },
        submit: function () {
          var self = this, f = this.f;
          this.err = '';
          if (this.native || RM.util.ls.get('rm_server')) {
            var v = this.server.trim().replace(/\/+$/, '');
            if (v) RM.util.ls.set('rm_server', v);
          }
          if (this.mode === 'register' && (f.password.length < 6 || f.login.trim().length < 4)) { this.err = this.$t('auth.fillAll'); return; }
          this.busy = true;
          var p = this.mode === 'login'
            ? RM.auth.login(f.login, f.password)
            : RM.auth.register({ name: f.name, login: f.login, password: f.password, garage_name: f.garage_name });
          p.then(function () { RM.go('home'); })
            .catch(function (e) { self.err = self.errText(e); })
            .then(function () { self.busy = false; });
        },
      },
      template: '<div class="auth">' +
        '<div class="auth-top"><div class="logo"><img src="img/logo.png" alt=""></div>' +
        '<h1>{{ $t(\'app.name\') }}</h1><p>{{ $t(\'auth.tagline\') }}</p></div>' +
        '<div class="auth-card">' +
        '<div class="seg-row"><button class="seg" :class="{on: mode === \'login\'}" @click="mode = \'login\'; err = \'\'">{{ $t(\'auth.signIn\') }}</button>' +
        '<button class="seg" :class="{on: mode === \'register\'}" @click="mode = \'register\'; err = \'\'">{{ $t(\'auth.signUp\') }}</button></div>' +
        '<form @submit.prevent="submit">' +
        '<template v-if="mode === \'register\'">' +
        '<fld :label="$t(\'auth.garageName\')" req><input v-model="f.garage_name" required autocomplete="organization"></fld>' +
        '<fld :label="$t(\'auth.yourName\')" req><input v-model="f.name" required autocomplete="name"></fld></template>' +
        '<fld :label="$t(\'auth.login\')" req :hint="mode === \'register\' ? $t(\'auth.loginHint\') : \'\'"><input v-model="f.login" required autocomplete="username" autocapitalize="none" inputmode="text"></fld>' +
        '<fld :label="$t(\'auth.password\')" req :hint="mode === \'register\' ? $t(\'auth.passwordHint\') : \'\'"><input type="password" v-model="f.password" required autocomplete="current-password"></fld>' +
        '<p v-if="err" class="form-err">{{ err }}</p>' +
        '<button class="btn primary block" :disabled="busy">{{ busy ? $t(\'common.loading\') : (mode === \'login\' ? $t(\'auth.signIn\') : $t(\'auth.createGarage\')) }}</button>' +
        '<p v-if="mode === \'register\'" class="muted small center-t">{{ $t(\'auth.trialNote\') }}</p>' +
        '</form></div>' +
        '<div class="auth-foot"><button class="link-btn" @click="setLang(lang === \'bn\' ? \'en\' : \'bn\')"><ic name="globe" :size="16"/> {{ lang === \'bn\' ? \'English\' : \'বাংলা\' }}</button>' +
        '<button v-if="native" class="link-btn" @click="showServer = !showServer">{{ $t(\'settings.server\') }}</button></div>' +
        '<div v-if="showServer" class="auth-card"><input type="url" v-model="server" placeholder="https://example.com"></div>' +
        '</div>',
    });
  });
})();
