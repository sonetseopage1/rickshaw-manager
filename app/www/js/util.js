(function () {
  var RM = window.RM;
  var pad = function (n) { return String(n).padStart(2, '0'); };

  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  RM.util = {
    uuid: function () {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    },
    pad: pad,
    ymd: ymd,
    parse: parse,
    today: function () { return ymd(new Date()); },
    addDays: function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); },
    addMonths: function (s, n) { var d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return ymd(d); },
    monthStart: function (s) { return s.slice(0, 7) + '-01'; },
    monthEnd: function (s) { var d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); },
    // Bangladesh week starts on Saturday.
    weekStart: function (s) { var d = parse(s); var back = (d.getDay() + 1) % 7; d.setDate(d.getDate() - back); return ymd(d); },
    daysBetween: function (a, b) { return Math.round((parse(b) - parse(a)) / 86400000); },
    locale: function (lang) { return lang === 'bn' ? 'bn-BD' : 'en-US'; },
    num: function (n, lang) {
      if (n === null || n === undefined || n === '' || isNaN(n)) return '';
      return new Intl.NumberFormat(RM.util.locale(lang), { maximumFractionDigits: 2 }).format(n);
    },
    money: function (n, lang) {
      var v = Math.round((n || 0) * 100) / 100;
      return (v < 0 ? '−' : '') + '৳' + RM.util.num(Math.abs(v), lang);
    },
    date: function (s, lang, style) {
      if (!s) return '';
      var o = style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : style === 'short' ? { day: 'numeric', month: 'short' }
        : style === 'month' ? { month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
      return new Intl.DateTimeFormat(RM.util.locale(lang), o).format(parse(s));
    },
    time: function (hhmm, lang) {
      if (!hhmm) return '';
      var p = hhmm.split(':').map(Number);
      var d = new Date(2000, 0, 1, p[0], p[1]);
      return new Intl.DateTimeFormat(RM.util.locale(lang), { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    },
    dateTime: function (iso, lang) {
      var d = new Date(iso);
      return new Intl.DateTimeFormat(RM.util.locale(lang), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    },
    natural: function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); },
    numOrNull: function (v) {
      if (v === '' || v === null || v === undefined) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    },
    ls: {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
      del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } },
    },
  };

  // Very small event bus.
  var handlers = {};
  RM.events = {
    on: function (n, f) { (handlers[n] = handlers[n] || []).push(f); },
    emit: function (n, p) { (handlers[n] || []).forEach(function (f) { f(p); }); },
  };
})();
