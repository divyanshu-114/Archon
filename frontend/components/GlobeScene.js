'use client';

import React from 'react';

// ── Timeline context (stripped to auto-loop only — no playback UI) ────────────
const TimelineContext = React.createContext({ time: 0, duration: 16 });
const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);

function AutoStage({ duration = 16, children }) {
  const [time, setTime] = React.useState(0);

  React.useEffect(() => {
    let lastTs = null;
    let rafId;
    const step = (ts) => {
      if (lastTs != null) {
        const dt = (ts - lastTs) / 1000;
        setTime((t) => (t + dt) % duration);
      }
      lastTs = ts;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  const ctx = React.useMemo(() => ({ time, duration }), [time, duration]);
  return (
    <TimelineContext.Provider value={ctx}>
      {children}
    </TimelineContext.Provider>
  );
}

// ── Math helpers ──────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;

function project(lat, lon, rotY) {
  const phi = lat * DEG;
  const lambda = (lon + rotY) * DEG;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);
  return { x, y, z, visible: z > -0.02 };
}

function greatCircle(lat1, lon1, lat2, lon2) {
  const p1 = latLonToVec(lat1, lon1);
  const p2 = latLonToVec(lat2, lon2);
  const dot = p1.x * p2.x + p1.y * p2.y + p1.z * p2.z;
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinO = Math.sin(omega);
  return (t) => {
    if (sinO < 1e-6) return { x: p1.x, y: p1.y, z: p1.z };
    const a = Math.sin((1 - t) * omega) / sinO;
    const b = Math.sin(t * omega) / sinO;
    return {
      x: a * p1.x + b * p2.x,
      y: a * p1.y + b * p2.y,
      z: a * p1.z + b * p2.z,
    };
  };
}

function latLonToVec(lat, lon) {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: Math.sin(phi),
    z: Math.cos(phi) * Math.cos(lambda),
  };
}

function rotateY(v, deg) {
  const r = deg * DEG;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: c * v.x + s * v.z, y: v.y, z: -s * v.x + c * v.z };
}

// ── Cities ────────────────────────────────────────────────────────────────────
const CITIES = {
  nyc:         { lat:  40.71, lon:  -74.01, name: 'NEW YORK' },
  london:      { lat:  51.51, lon:   -0.13, name: 'LONDON' },
  tokyo:       { lat:  35.68, lon:  139.69, name: 'TOKYO' },
  sydney:      { lat: -33.87, lon:  151.21, name: 'SYDNEY' },
  saopaulo:    { lat: -23.55, lon:  -46.63, name: 'SÃO PAULO' },
  cairo:       { lat:  30.04, lon:   31.24, name: 'CAIRO' },
  mumbai:      { lat:  19.08, lon:   72.88, name: 'MUMBAI' },
  moscow:      { lat:  55.75, lon:   37.62, name: 'MOSCOW' },
  sf:          { lat:  37.77, lon: -122.42, name: 'SAN FRANCISCO' },
  singapore:   { lat:   1.35, lon:  103.82, name: 'SINGAPORE' },
  lagos:       { lat:   6.52, lon:    3.38, name: 'LAGOS' },
  buenosaires: { lat: -34.61, lon:  -58.38, name: 'BUENOS AIRES' },
  capetown:    { lat: -33.92, lon:   18.42, name: 'CAPE TOWN' },
  reykjavik:   { lat:  64.13, lon:  -21.94, name: 'REYKJAVIK' },
  seoul:       { lat:  37.57, lon:  126.98, name: 'SEOUL' },
  dubai:       { lat:  25.20, lon:   55.27, name: 'DUBAI' },
  paris:       { lat:  48.86, lon:    2.35, name: 'PARIS' },
  berlin:      { lat:  52.52, lon:   13.40, name: 'BERLIN' },
  istanbul:    { lat:  41.01, lon:   28.98, name: 'ISTANBUL' },
  bangkok:     { lat:  13.76, lon:  100.50, name: 'BANGKOK' },
  mexico:      { lat:  19.43, lon:  -99.13, name: 'MEXICO CITY' },
  nairobi:     { lat:  -1.29, lon:   36.82, name: 'NAIROBI' },
  toronto:     { lat:  43.65, lon:  -79.38, name: 'TORONTO' },
  losangeles:  { lat:  34.05, lon: -118.24, name: 'LOS ANGELES' },
};

const ARCS = [
  { from: 'nyc',         to: 'london',      start:  0.5, end:  2.5 },
  { from: 'london',      to: 'tokyo',       start:  1.2, end:  3.6 },
  { from: 'saopaulo',   to: 'lagos',        start:  2.0, end:  4.0 },
  { from: 'sf',          to: 'singapore',   start:  2.8, end:  5.0 },
  { from: 'mumbai',      to: 'moscow',      start:  3.6, end:  5.4 },
  { from: 'sydney',      to: 'seoul',       start:  4.2, end:  6.2 },
  { from: 'cairo',       to: 'paris',       start:  4.8, end:  6.4 },
  { from: 'dubai',       to: 'toronto',     start:  5.6, end:  7.8 },
  { from: 'buenosaires', to: 'capetown',    start:  6.4, end:  8.4 },
  { from: 'reykjavik',  to: 'nairobi',      start:  7.0, end:  8.8 },
  { from: 'istanbul',   to: 'bangkok',      start:  7.8, end:  9.6 },
  { from: 'mexico',     to: 'berlin',       start:  8.6, end: 10.4 },
  { from: 'losangeles', to: 'tokyo',        start:  9.2, end: 11.2 },
  { from: 'london',     to: 'mumbai',       start: 10.0, end: 11.8 },
  { from: 'nyc',        to: 'saopaulo',     start: 10.8, end: 12.6 },
  { from: 'seoul',      to: 'sydney',       start: 11.4, end: 13.2 },
  { from: 'paris',      to: 'dubai',        start: 12.0, end: 13.8 },
  { from: 'singapore',  to: 'capetown',     start: 12.8, end: 14.6 },
  { from: 'berlin',     to: 'moscow',       start: 13.4, end: 15.0 },
  { from: 'tokyo',      to: 'sf',           start: 14.0, end: 15.8 },
];

// ── Fibonacci sphere dot mesh ─────────────────────────────────────────────────
function fibonacciSphere(n) {
  const pts = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return pts;
}

// ── Graticule lines ───────────────────────────────────────────────────────────
function buildGraticule() {
  const lines = [];
  for (let lat = -60; lat <= 60; lat += 20) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 4) pts.push(latLonToVec(lat, lon));
    lines.push(pts);
  }
  for (let lon = -180; lon < 180; lon += 20) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVec(lat, lon));
    lines.push(pts);
  }
  return lines;
}

const GRATICULE = buildGraticule();

// ── Country outlines (TopoJSON decode) ────────────────────────────────────────
let COUNTRY_RINGS = [];
let LAND_LOADED = false;

function decodeTopology(topo) {
  const { transform, arcs } = topo;
  const { scale, translate } = transform;
  const absArcs = arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  const resolveArcs = (arcIdx) => {
    const pts = [];
    arcIdx.forEach((idx, i) => {
      let seg = idx < 0 ? absArcs[~idx].slice().reverse() : absArcs[idx];
      if (i > 0) seg = seg.slice(1);
      pts.push(...seg);
    });
    return pts;
  };

  const rings = [];
  const collect = (geom) => {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') geom.geometries.forEach(collect);
    else if (geom.type === 'Polygon') geom.arcs.forEach((ring) => rings.push(resolveArcs(ring)));
    else if (geom.type === 'MultiPolygon')
      geom.arcs.forEach((poly) => poly.forEach((ring) => rings.push(resolveArcs(ring))));
  };
  for (const key in topo.objects) collect(topo.objects[key]);
  return rings;
}

function densifyRing(ring, maxDeg = 3) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    out.push({ lat: lat1, lon: lon1 });
    const dLon = Math.abs(((lon2 - lon1 + 540) % 360) - 180);
    const dLat = Math.abs(lat2 - lat1);
    const d = Math.max(dLon, dLat);
    if (d > maxDeg) {
      const n = Math.min(40, Math.ceil(d / maxDeg));
      let lon2adj = lon2;
      if (lon2 - lon1 > 180) lon2adj = lon2 - 360;
      else if (lon2 - lon1 < -180) lon2adj = lon2 + 360;
      const slerp = greatCircle(lat1, lon1, lat2, lon2adj);
      for (let k = 1; k < n; k++) {
        const v = slerp(k / n);
        out.push({
          lat: Math.asin(v.y) * 180 / Math.PI,
          lon: Math.atan2(v.x, v.z) * 180 / Math.PI,
        });
      }
    }
  }
  const last = ring[ring.length - 1];
  out.push({ lat: last[1], lon: last[0] });
  return out;
}

// ── Globe SVG component ───────────────────────────────────────────────────────
function Globe({ cx, cy, r, rotY }) {
  const gratPaths = GRATICULE.map((line, li) => {
    const segments = [];
    let cur = [];
    for (const p of line) {
      const rp = rotateY(p, rotY);
      if (rp.z >= 0) {
        cur.push({ x: cx + rp.x * r, y: cy - rp.y * r, z: rp.z });
      } else {
        if (cur.length > 1) segments.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) segments.push(cur);
    return segments.map((seg, si) => {
      const d = seg.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');
      const avgZ = seg.reduce((s, pt) => s + pt.z, 0) / seg.length;
      return (
        <path key={`${li}-${si}`} d={d} stroke="#ffffff" strokeWidth={0.5} fill="none" opacity={0.04 + avgZ * 0.08} />
      );
    });
  });

  const landFills = [];
  const landStrokes = [];
  for (let ri = 0; ri < COUNTRY_RINGS.length; ri++) {
    const ring = COUNTRY_RINGS[ri];
    let cur = [];
    const segs = [];
    for (let i = 0; i < ring.length; i++) {
      const v = latLonToVec(ring[i].lat, ring[i].lon);
      const rp = rotateY(v, rotY);
      if (rp.z >= 0) {
        cur.push({ x: cx + rp.x * r, y: cy - rp.y * r, z: rp.z });
      } else {
        if (cur.length > 1) segs.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) segs.push(cur);

    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      const d = seg.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
      const avgZ = seg.reduce((s, pt) => s + pt.z, 0) / seg.length;
      landStrokes.push(
        <path
          key={`ls-${ri}-${si}`}
          d={d}
          stroke="#ffffff"
          strokeWidth={0.75}
          fill="none"
          opacity={0.35 + avgZ * 0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
      if (segs.length === 1 && seg.length > 3) {
        landFills.push(
          <path key={`lf-${ri}`} d={d + ' Z'} fill="#ffffff" opacity={0.04} stroke="none" />
        );
      }
    }
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 14} fill="url(#gs-glow)" opacity={0.5} />
      <circle cx={cx} cy={cy} r={r} fill="#000000" />
      <circle cx={cx} cy={cy} r={r} fill="url(#gs-bodyShade)" />
      {gratPaths}
      {landFills}
      {landStrokes}
      <circle cx={cx} cy={cy} r={r} fill="url(#gs-limbShade)" />
<circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeWidth={0.8} opacity={0.45} />
      <circle
        cx={cx} cy={cy} r={r - 0.4}
        fill="none"
        stroke="url(#gs-rimLight)"
        strokeWidth={1.4}
        opacity={0.9}
      />
    </g>
  );
}

// ── Arc ───────────────────────────────────────────────────────────────────────
function Arc({ fromKey, toKey, rotY, cx, cy, r, progress }) {
  const from = CITIES[fromKey];
  const to = CITIES[toKey];
  if (!from || !to) return null;

  const N = 48;
  const slerp = React.useMemo(
    () => greatCircle(from.lat, from.lon, to.lat, to.lon),
    [fromKey, toKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const base = slerp(t);
    const lift = 1 + 0.35 * Math.sin(Math.PI * t);
    pts.push({ x: base.x * lift, y: base.y * lift, z: base.z * lift });
  }

  const proj = pts.map((p) => {
    const r3 = rotateY({ x: p.x, y: p.y, z: p.z }, rotY);
    return { px: cx + r3.x * r, py: cy - r3.y * r, z: r3.z };
  });

  const visFlags = pts.map((p, i) => {
    const factor = 1 + 0.35 * Math.sin(Math.PI * (i / N));
    const r3 = rotateY({ x: p.x / factor, y: p.y, z: p.z / factor }, rotY);
    return r3.z > -0.15;
  });

  const segs = [];
  let cur = [];
  for (let i = 0; i < proj.length; i++) {
    if (visFlags[i]) cur.push(proj[i]);
    else { if (cur.length > 1) segs.push(cur); cur = []; }
  }
  if (cur.length > 1) segs.push(cur);

  const paths = segs.map((seg) =>
    seg.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.px.toFixed(2)},${pt.py.toFixed(2)}`).join(' ')
  );

  const head = Math.min(1, progress / 0.55);
  const tailCut = progress > 0.55 ? (progress - 0.55) / 0.45 : 0;

  const fromP = rotateY(latLonToVec(from.lat, from.lon), rotY);
  const toP   = rotateY(latLonToVec(to.lat, to.lon), rotY);
  const fromVisible = fromP.z > -0.05;
  const toVisible   = toP.z > -0.05;

  let opacity = 1;
  if (progress < 0.08) opacity = progress / 0.08;
  else if (progress > 0.85) opacity = Math.max(0, 1 - (progress - 0.85) / 0.15);

  return (
    <g>
      {paths.map((d, i) => (
        <React.Fragment key={i}>
          <path d={d} stroke="#ffffff" strokeWidth={2.4} fill="none" opacity={opacity * 0.12}
            strokeLinecap="round" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - head} />
          <path d={d} stroke="#ffffff" strokeWidth={0.9} fill="none" opacity={opacity * 0.95}
            strokeLinecap="round" pathLength="1"
            strokeDasharray={`${Math.max(0, head - tailCut)} 1`}
            strokeDashoffset={-tailCut} />
        </React.Fragment>
      ))}
      {fromVisible && progress > 0.02 && progress < 0.95 && (
        <CityPin
          x={cx + fromP.x * r} y={cy - fromP.y * r} z={fromP.z}
          label={from.name} opacity={opacity}
          pulse={progress < 0.18 ? 1 - progress / 0.18 : 0}
        />
      )}
      {toVisible && head > 0.95 && progress < 0.95 && (
        <CityPin
          x={cx + toP.x * r} y={cy - toP.y * r} z={toP.z}
          label={to.name} opacity={opacity} pulse={1} arrived
        />
      )}
    </g>
  );
}

function CityPin({ x, y, z, label, opacity, pulse, arrived }) {
  const baseR = 2.2 + z * 0.6;
  const ringR = baseR + 4 + pulse * 8;
  return (
    <g opacity={opacity}>
      {pulse > 0 && (
        <circle cx={x} cy={y} r={ringR} fill="none" stroke="#ffffff" strokeWidth={0.9} opacity={(1 - pulse) * 0.7} />
      )}
      <circle cx={x} cy={y} r={baseR} fill="#ffffff" />
      <circle cx={x} cy={y} r={baseR + 1.4} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={0.35} />
      {arrived && (
        <text x={x + 8} y={y - 6} fill="#ffffff" fontSize={9}
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          letterSpacing="0.14em" opacity={0.85}>
          {label}
        </text>
      )}
    </g>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
const STARS = (() => {
  const arr = [];
  let s = 42;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 160; i++) {
    arr.push({ x: rand() * 1920, y: rand() * 1080, r: rand() * 0.9 + 0.2, o: rand() * 0.35 + 0.05 });
  }
  return arr;
})();

function Stars() {
  return (
    <g>
      {STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#ffffff" opacity={st.o} />
      ))}
    </g>
  );
}

// ── Chrome corner marks ───────────────────────────────────────────────────────
function Chrome() {
  const tick = { stroke: '#ffffff', strokeWidth: 1, opacity: 0.35 };
  const mono = "'JetBrains Mono', ui-monospace, monospace";
  return (
    <g>
      <g transform="translate(60, 60)">
        <path d="M0 0 L24 0 M0 0 L0 24" {...tick} />
        <text x={0} y={44} fill="#ffffff" fontSize="11" fontFamily={mono} letterSpacing="0.22em" opacity="0.6">
          GLOBAL · NETWORK
        </text>
      </g>
      <g transform="translate(1860, 60)">
        <path d="M0 0 L-24 0 M0 0 L0 24" {...tick} />
        <text x={0} y={44} textAnchor="end" fill="#ffffff" fontSize="11" fontFamily={mono} letterSpacing="0.22em" opacity="0.6">
          LIVE · 24H
        </text>
      </g>
      <g transform="translate(60, 1020)">
        <path d="M0 0 L24 0 M0 0 L0 -24" {...tick} />
        <text x={0} y={-16} fill="#ffffff" fontSize="10" fontFamily={mono} letterSpacing="0.22em" opacity="0.45">
          LAT / LON · MERCATOR
        </text>
      </g>
      <g transform="translate(1860, 1020)">
        <path d="M0 0 L-24 0 M0 0 L0 -24" {...tick} />
        <text x={0} y={-16} textAnchor="end" fill="#ffffff" fontSize="10" fontFamily={mono} letterSpacing="0.22em" opacity="0.45">
          00.00 · 00.00
        </text>
      </g>
    </g>
  );
}

// ── Inner scene (reads time from context) ─────────────────────────────────────
function GlobeInner() {
  const time = useTime();
  const { duration } = useTimeline();

  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('land-loaded', on);
    return () => window.removeEventListener('land-loaded', on);
  }, []);

  const rotY = (time / duration) * 360;
  const cx = 960, cy = 540, r = 360;

  const activeArcs = ARCS
    .map((a, i) => {
      if (time < a.start || time > a.end) return null;
      return { ...a, progress: (time - a.start) / (a.end - a.start), key: i };
    })
    .filter(Boolean);

  return (
    <svg
      width="100%" height="100%"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, display: 'block' }}
    >
      <defs>
        <radialGradient id="gs-glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="85%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gs-bodyShade" cx="35%" cy="32%" r="75%">
          <stop offset="0%"   stopColor="#2a2a2a" stopOpacity="1" />
          <stop offset="35%"  stopColor="#0f0f0f" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="gs-limbShade" cx="50%" cy="50%" r="50%">
          <stop offset="72%"  stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id="gs-shine" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gs-hotspot" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gs-rimLight" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="25%"  stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="55%"  stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gs-bgVignette" cx="50%" cy="50%" r="75%">
          <stop offset="0%"   stopColor="#0a0a0a" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="1920" height="1080" fill="#000000" />
      <rect x="0" y="0" width="1920" height="1080" fill="url(#gs-bgVignette)" />

      <Stars />

      {/* Remap gradient IDs used inside Globe/Arc */}
      <Globe cx={cx} cy={cy} r={r} rotY={rotY} />

      {activeArcs.map((a) => (
        <Arc
          key={a.key}
          fromKey={a.from}
          toKey={a.to}
          rotY={rotY}
          cx={cx} cy={cy} r={r}
          progress={a.progress}
        />
      ))}

      <Chrome />
    </svg>
  );
}

// ── Land data loader (runs once) ──────────────────────────────────────────────
let landFetchStarted = false;
function ensureLandLoaded() {
  if (landFetchStarted) return;
  landFetchStarted = true;
  fetch('/countries-110m.json')
    .then((r) => r.json())
    .then((topo) => {
      COUNTRY_RINGS = decodeTopology(topo).map((ring) => densifyRing(ring, 2.5));
      LAND_LOADED = true;
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('land-loaded'));
    })
    .catch((err) => console.warn('globe: land load failed', err));
}

// ── Exported component ────────────────────────────────────────────────────────
export default function GlobeScene() {
  React.useEffect(() => { ensureLandLoaded(); }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <AutoStage duration={16}>
        <GlobeInner />
      </AutoStage>
    </div>
  );
}
