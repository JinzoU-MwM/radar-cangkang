/* Radar Cangkang — modul visualisasi (SVG generators murni).
   Kontrak: semua fungsi (data) → string SVG/HTML, tanpa DOM, tanpa state.
   Warna mengikuti tema via CSS custom properties (var(--...)).
   Bisa diuji dengan node tanpa browser. */

// ---------- util ----------
export const s = v => String(v ?? "");

const SVG_OPEN = (w, h, cls, label) =>
  `<svg class="${s(cls)}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${s(label)}">`;

// ---------- 1. Donut / ring komposisi ----------
// data: [{ label, value, color }] → donut dengan legend.
export function donut(items, { size = 180, thickness = 26, title = "", center = "" } = {}) {
  const data = (items || []).filter(d => +d.value > 0);
  const total = data.reduce((t, d) => t + +d.value, 0);
  if (!total) return `<div class="viz-empty">${s(title) || "Belum ada data"}</div>`;
  const R = (size - thickness) / 2, C = 2 * Math.PI * R;
  let off = 0;
  const segs = data.map(d => {
    const frac = +d.value / total, len = frac * C;
    const seg = `<circle r="${R}" cx="${size / 2}" cy="${size / 2}" fill="none"
      stroke="${d.color || "var(--accent)"}" stroke-width="${thickness}"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"><title>${s(d.label)}: ${d.value} (${(frac * 100).toFixed(0)}%)</title></circle>`;
    off += len;
    return seg;
  }).join("");
  const legend = data.map(d => `<li><i style="background:${d.color || "var(--accent)"}"></i>${s(d.label)} <b>${d.value}</b> <span>${(+d.value / total * 100).toFixed(0)}%</span></li>`).join("");
  return `<div class="viz-donut">${SVG_OPEN(size, size, "", title || "Komposisi")}${segs}
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="viz-donut-c">${s(center || total)}</text></svg>
    <ul class="viz-legend">${legend}</ul></div>`;
}

// ---------- 2. Horizontal bar (ranking) ----------
// data: [{ label, value, max?, color?, sub? }]
export function hbar(items, { width = 420, barH = 22, unit = "", color = "var(--accent)" } = {}) {
  const data = (items || []).filter(d => d.value != null);
  if (!data.length) return `<div class="viz-empty">Belum ada data</div>`;
  const max = Math.max(...data.map(d => +d.value), 1);
  const rows = data.map(d => {
    const w = (+d.value / max * 72).toFixed(2);
    return `<div class="viz-hbar-row"${d.color ? ` style="--bar:${d.color}"` : ""}>
      <span class="viz-hbar-l" title="${s(d.label)}">${s(d.label)}</span>
      <span class="viz-hbar-t"><i style="width:${w}%"></i></span>
      <span class="viz-hbar-v">${d.value}${s(unit)}${d.sub ? ` <small>${s(d.sub)}</small>` : ""}</span></div>`;
  }).join("");
  return `<div class="viz-hbar" style="max-width:${width}px">${rows}</div>`;
}

// ---------- 3. Timeline horizontal (milestone/gantt ringkas) ----------
// data: [{ label, start: "YYYY-MM-DD", end?: "YYYY-MM-DD", color? }], today otomatis.
export function timeline(rows, { daysBack = 120, daysFwd = 90, height = 34 } = {}) {
  const items = (rows || []).filter(r => r.start);
  if (!items.length) return `<div class="viz-empty">Belum ada jadwal</div>`;
  const dates = items.flatMap(r => [r.start, r.end].filter(Boolean)).sort();
  const min = new Date(dates[0] + "T00:00:00"), max = new Date(dates[dates.length - 1] + "T00:00:00");
  const today = new Date();
  const span = Math.max(1, (max - min) / 864e5);
  const W = 600, H = Math.max(height * items.length + 20, 40);
  const x = d => ((d - min) / 864e5 / span * (W - 8) + 4).toFixed(1);
  const todayX = (today >= min && today <= max) ? x(today) : null;
  const bars = items.map((r, i) => {
    const y = i * height + 6;
    const x1 = x(new Date(r.start + "T00:00:00"));
    const x2 = r.end ? x(new Date(r.end + "T00:00:00")) : x1 + 8;
    return `<g><title>${s(r.label)}: ${r.start}${r.end ? " → " + r.end : ""}</title>
      <text x="4" y="${y + 11}" class="viz-tl-l">${s(r.label)}</text>
      <rect x="${x1}" y="${y}" width="${Math.max(2, x2 - x1).toFixed(1)}" height="${height - 12}" rx="3" fill="${r.color || "var(--accent)"}" fill-opacity=".8"></rect></g>`;
  }).join("");
  return SVG_OPEN(W, H, "viz-tl", "Timeline") + bars +
    (todayX ? `<line x1="${todayX}" y1="0" x2="${todayX}" y2="${H}" class="viz-tl-today"><title>Hari ini</title></line>` : "") + "</svg>";
}

// ---------- 4. Heat grid (matriks intensitas) ----------
// cols: [{ id, label }], rowsData: [{ label, cells: { colId: 0..1 } }]
export function heatGrid(cols, rowsData, { cell = 18, gap = 3 } = {}) {
  if (!rowsData || !cols) return `<div class="viz-empty">Belum ada data</div>`;
  const W = 110 + cols.length * (cell + gap), H = 20 + rowsData.length * (cell + gap);
  const heads = cols.map((c, i) =>
    `<text x="${110 + i * (cell + gap) + cell / 2}" y="12" text-anchor="middle" class="viz-hg-c">${s(c.label)}</text>`).join("");
  const cells = rowsData.map((r, ri) => {
    const y = 20 + ri * (cell + gap);
    const lab = `<text x="106" y="${y + cell / 2 + 4}" text-anchor="end" class="viz-hg-r">${s(r.label)}</text>`;
    const cs = cols.map((c, ci) => {
      const v = Math.min(1, Math.max(0, +(r.cells?.[c.id] ?? 0)));
      return `<rect x="${110 + ci * (cell + gap)}" y="${y}" width="${cell}" height="${cell}" rx="2"
        fill="var(--accent)" fill-opacity="${(0.08 + v * 0.85).toFixed(2)}"><title>${s(r.label)} · ${s(c.label)}: ${(v * 100).toFixed(0)}%</title></rect>`;
    }).join("");
    return lab + cs;
  }).join("");
  return SVG_OPEN(W, H, "viz-hg", "Matriks") + heads + cells + "</svg>";
}

// ---------- 5. KPI strip (angka besar + delta) ----------
export function kpi(items) {
  return `<div class="viz-kpi">${(items || []).map(k =>
    `<div class="viz-kpi-c"><b>${s(k.value)}</b><span>${s(k.label)}</span>${k.delta != null ? `<small class="${+k.delta >= 0 ? "up" : "down"}">${+k.delta >= 0 ? "▲" : "▼"} ${Math.abs(+k.delta).toFixed(1)}%</small>` : ""}</div>`
  ).join("")}</div>`;
}
