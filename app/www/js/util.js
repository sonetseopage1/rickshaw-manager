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
    /**
     * One entry per rickshaw per day: the entry id is derived from rickshaw + date, so two taps
     * (or two phones working offline) that create "today's entry" end up as the same record.
     */
    entryId: function (rickshawId, date) {
      var str = 'entry:' + rickshawId + ':' + date;
      var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
      for (var i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
      }
      h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
      h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
      h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
      var hex = function (n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); };
      var a = hex(h1), b = hex(h2), c = hex(h3), d = hex(h4);
      return a + '-' + b.slice(0, 4) + '-4' + b.slice(5, 8) + '-8' + c.slice(1, 4) + '-' + c.slice(4) + d;
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
