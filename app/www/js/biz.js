// Business rules: assignments, occupancy and the accounting maths.
(function () {
  var RM = window.RM;
  var U = RM.util;
  var D = RM.data;

  function num(v) { return v === null || v === undefined ? 0 : Number(v) || 0; }

  function rickshaws() {
    return D.memo('rickshaws', ['rickshaws'], function () {
      return D.list('rickshaws').slice().sort(function (a, b) { return U.natural(a.number, b.number); });
    });
  }

  function assignmentIndex() {
    return D.memo('assignIdx', ['assignments'], function () {
      var idx = {};
      D.list('assignments').forEach(function (a) { (idx[a.rickshaw_id] = idx[a.rickshaw_id] || []).push(a); });
      return idx;
    });
  }

  function active(a, date) {
    return a.start_date <= date && (!a.end_date || a.end_date >= date);
  }

  function assignmentOn(rid, date) {
    var best = null;
    (assignmentIndex()[rid] || []).forEach(function (a) {
      if (active(a, date) && (!best || a.start_date > best.start_date)) best = a;
    });
    return best;
  }

  function driverOn(rid, date) {
    var a = assignmentOn(rid, date);
    return a ? D.get('drivers', a.driver_id) || null : null;
  }

  /** free | occupied | maintenance | inactive */
  function statusOn(r, date) {
    if (r.status === 'maintenance') return 'maintenance';
    if (r.status === 'inactive') return 'inactive';
    return assignmentOn(r.id, date) ? 'occupied' : 'free';
  }

  function expectedRent(r, date) {
    var a = assignmentOn(r.id, date);
    if (a && a.expected_rent !== null && a.expected_rent !== undefined) return a.expected_rent;
    return r.default_rent === undefined ? null : r.default_rent;
  }

  function net(e) { return num(e.deposit) - num(e.expense) - num(e.garage_charge); }

  function emptyTotals() { return { deposit: 0, expense: 0, charge: 0, net: 0, count: 0 }; }
  function add(t, e) {
    t.deposit += num(e.deposit); t.expense += num(e.expense); t.charge += num(e.garage_charge);
    t.net += net(e); t.count++;
    return t;
  }
  function totals(entries) { return entries.reduce(add, emptyTotals()); }

  function entriesOn(date) {
    return D.list('entries').filter(function (e) { return e.entry_date === date; });
  }

  /** Another assignment of this rickshaw overlapping [start, end]? */
  function overlap(rid, start, end, exceptId) {
    var hi = end || '9999-12-31';
    return (assignmentIndex()[rid] || []).find(function (a) {
      return a.id !== exceptId && a.start_date <= hi && (!a.end_date || a.end_date >= start);
    }) || null;
  }

  function driverBusy(did, start, end, exceptId) {
    var hi = end || '9999-12-31';
    return D.list('assignments').find(function (a) {
      return a.id !== exceptId && a.driver_id === did && a.start_date <= hi && (!a.end_date || a.end_date >= start);
    }) || null;
  }

  function nameOf(table, id, field) {
    var r = D.get(table, id);
    return r ? r[field] : '';
  }

  function bucketKey(date, monthly) { return monthly ? date.slice(0, 7) : date; }

  function summarize(from, to) {
    var es = D.list('entries').filter(function (e) { return e.entry_date >= from && e.entry_date <= to; });
    var all = totals(es);
    var days = U.daysBetween(from, to) + 1;
    var monthly = days > 62;

    var byDay = {}, byRickshaw = {}, byOwner = {}, byDriver = {}, expTypes = {};
    es.forEach(function (e) {
      add(byDay[bucketKey(e.entry_date, monthly)] = byDay[bucketKey(e.entry_date, monthly)] || emptyTotals(), e);
      add(byRickshaw[e.rickshaw_id] = byRickshaw[e.rickshaw_id] || emptyTotals(), e);
      var rk = D.get('rickshaws', e.rickshaw_id);
      var ok = e.owner_id || (rk && rk.owner_id) || '';
      add(byOwner[ok] = byOwner[ok] || emptyTotals(), e);
      var dk = e.driver_id || '';
      add(byDriver[dk] = byDriver[dk] || emptyTotals(), e);
      if (num(e.expense) > 0) {
        var ty = e.expense_type || 'other';
        expTypes[ty] = (expTypes[ty] || 0) + num(e.expense);
      }
    });

    // The garage's own costs (rent, electricity...) per chart bucket.
    var utilBy = {};
    D.list('garage_expenses').forEach(function (x) {
      if (x.expense_date >= from && x.expense_date <= to) {
        var uk = bucketKey(x.expense_date, monthly);
        utilBy[uk] = (utilBy[uk] || 0) + num(x.amount);
      }
    });

    // Chart series covering every day (or month) of the period, zero where nothing happened.
    var series = [];
    if (monthly) {
      var m = U.monthStart(from);
      while (m <= to) {
        var k = m.slice(0, 7), v = byDay[k] || emptyTotals();
        series.push({ key: k, date: m, deposit: v.deposit, expense: v.expense, charge: v.charge, net: v.net, util: utilBy[k] || 0 });
        m = U.addMonths(m, 1);
      }
    } else {
      for (var i = 0; i < days; i++) {
        var d = U.addDays(from, i), x = byDay[d] || emptyTotals();
        series.push({ key: d, date: d, deposit: x.deposit, expense: x.expense, charge: x.charge, net: x.net, util: utilBy[d] || 0 });
      }
    }

    var util = D.list('garage_expenses').filter(function (x) { return x.expense_date >= from && x.expense_date <= to; });
    var utilTotal = 0, utilCat = {};
    util.forEach(function (x) {
      utilTotal += num(x.amount);
      utilCat[x.category] = (utilCat[x.category] || 0) + num(x.amount);
    });

    return {
      from: from, to: to, days: days, monthly: monthly, totals: all, series: series,
      byRickshaw: byRickshaw, byOwner: byOwner, byDriver: byDriver, expenseTypes: expTypes,
      utility: { total: utilTotal, byCategory: utilCat, list: util },
      garageProfit: all.charge - utilTotal,
    };
  }

  RM.biz = {
    rickshaws: rickshaws, assignmentOn: assignmentOn, driverOn: driverOn, statusOn: statusOn,
    expectedRent: expectedRent, net: net, totals: totals, entriesOn: entriesOn, overlap: overlap,
    driverBusy: driverBusy, summarize: summarize, num: num,
    ownerName: function (id) { return nameOf('owners', id, 'name'); },
    driverName: function (id) { return nameOf('drivers', id, 'name'); },
    rickshawNumber: function (id) { return nameOf('rickshaws', id, 'number'); },
  };
})();
