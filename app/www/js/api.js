(function () {
  var RM = window.RM;

  function isNative() {
    return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  }

  function base() {
    var custom = RM.util.ls.get('rm_server');
    var server = (custom || RM_CONFIG.SERVER || '').replace(/\/+$/, '');
    if (custom || isNative() || location.protocol === 'file:') return server + '/api';
    return '/api'; // served by the same Laravel site
  }

  function request(method, path, body) {
    var token = RM.state && RM.state.session && RM.state.session.token;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(base() + path, {
      method: method, headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* not json */ }
        if (r.ok && data !== null) return data;
        var err = new Error((data && data.message) || ('HTTP ' + r.status));
        err.status = r.status; err.code = data && data.code; err.data = data;
        if (r.status === 401 && token) RM.events.emit('unauthorized');
        if (r.status === 403 && data && data.code === 'blocked') RM.events.emit('blocked', data.message);
        if (r.ok && data === null) { err.code = 'bad_response'; err.message = 'Server returned a non-JSON response'; }
        throw err;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      var err = new Error('offline'); err.offline = true; err.cause = e;
      throw err;
    });
  }

  RM.api = {
    base: base,
    isNative: isNative,
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b || {}); },
    put: function (p, b) { return request('PUT', p, b || {}); },
    del: function (p) { return request('DELETE', p); },
  };
})();
