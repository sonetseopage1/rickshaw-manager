// Tiny SVG bar chart: <svg class="chart" data-chart='[{"label":"01-02","value":10}]' data-color="#0f766e">
(function () {
  function bars(svg) {
    var data = JSON.parse(svg.getAttribute('data-chart') || '[]');
    var color = svg.getAttribute('data-color') || '#0f766e';
    var W = 600, H = 190, pad = { l: 8, r: 8, t: 12, b: 24 };
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (!data.length) { svg.innerHTML = '<text x="300" y="95" text-anchor="middle">No data</text>'; return; }
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var bw = (W - pad.l - pad.r) / data.length;
    var out = '<line x1="0" x2="' + W + '" y1="' + (H - pad.b) + '" y2="' + (H - pad.b) + '" stroke="currentColor" opacity=".15"/>';
    var every = Math.ceil(data.length / 8);
    data.forEach(function (d, i) {
      var h = (H - pad.t - pad.b) * d.value / max;
      var x = pad.l + i * bw + bw * 0.15, y = H - pad.b - h;
      out += '<rect x="' + x + '" y="' + y + '" width="' + bw * 0.7 + '" height="' + Math.max(h, d.value ? 2 : 0) + '" rx="3" fill="' + color + '"><title>' + d.label + ': ' + d.value + '</title></rect>';
      if (i % every === 0) out += '<text x="' + (x + bw * 0.35) + '" y="' + (H - 8) + '" text-anchor="middle">' + d.label + '</text>';
    });
    svg.innerHTML = out;
  }
  document.querySelectorAll('svg.chart[data-chart]').forEach(bars);
})();
