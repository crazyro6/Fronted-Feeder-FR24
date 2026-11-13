import { useEffect, useState } from "react";

const FT_M = 0.3048;
const KT_KMH = 1.852;

// dump1090 viejo usa altitude/speed/vert_rate; readsb usa alt_baro/gs/baro_rate
export function normalizar(a) {
  const altRaw = a.alt_baro ?? a.altitude;
  const enSuelo = altRaw === "ground";
  const alt = enSuelo ? 0 : num(altRaw ?? a.alt_geom);
  return {
    hex: a.hex.toLowerCase(),
    vuelo: a.flight?.trim() || null,
    alt,
    altGeom: num(a.alt_geom),
    enSuelo,
    gs: num(a.gs ?? a.speed),
    ias: num(a.ias),
    tas: num(a.tas),
    mach: num(a.mach),
    track: num(a.track ?? a.true_heading ?? a.mag_heading),
    vrate: num(a.baro_rate ?? a.geom_rate ?? a.vert_rate),
    squawk: a.squawk || null,
    emergencia: a.emergency && a.emergency !== "none" ? a.emergency : null,
    categoria: a.category || null,
    lat: num(a.lat),
    lon: num(a.lon),
    rssi: num(a.rssi),
    mensajes: num(a.messages),
    visto: num(a.seen),
    vistoPos: num(a.seen_pos),
    mlat: a.type === "mlat" || (Array.isArray(a.mlat) && a.mlat.length > 0),
    tisb: a.type?.startsWith("tisb") || (Array.isArray(a.tisb) && a.tisb.length > 0),
    tipoFuente: FUENTES[a.type] ?? a.type ?? null,
    navAlt: num(a.nav_altitude_mcp ?? a.nav_altitude_fms),
    navRumbo: num(a.nav_heading),
    qnh: num(a.nav_qnh),
    viento: a.wd != null ? { dir: a.wd, vel: a.ws } : null,
    oat: num(a.oat),
  };
}

// campo "type" de readsb
const FUENTES = {
  adsb_icao: "ADS-B",
  adsb_icao_nt: "ADS-B (no transponder)",
  adsr_icao: "ADS-R",
  adsb_other: "ADS-B (no ICAO)",
  adsr_other: "ADS-R (no ICAO)",
  mode_s: "Mode S",
  adsc: "ADS-C",
  other: "Otro",
  unknown: "Desconocida",
};

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const tienePos = (a) => a.lat != null && a.lon != null;

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function rumboHacia(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x =
    Math.cos(lat1 * r) * Math.sin(lat2 * r) -
    Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

// Escala de color por altitud (naranja bajo -> verde -> azul -> morado alto)
const ESCALA = [
  [0, [255, 120, 40]],
  [2000, [255, 190, 40]],
  [6000, [180, 230, 60]],
  [12000, [40, 210, 140]],
  [20000, [40, 180, 240]],
  [30000, [90, 110, 255]],
  [40000, [200, 80, 255]],
];
export function colorAltitud(ft) {
  if (ft == null) return [150, 150, 150];
  if (ft <= 0) return ESCALA[0][1];
  for (let i = 1; i < ESCALA.length; i++) {
    const [a1, c1] = ESCALA[i];
    const [a0, c0] = ESCALA[i - 1];
    if (ft <= a1) {
      const t = (ft - a0) / (a1 - a0);
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
    }
  }
  return ESCALA.at(-1)[1];
}
export const rgb = (c) => `rgb(${c.join(",")})`;

export const fmt = {
  alt: (a) => (a.enSuelo ? "En tierra" : a.alt != null ? `${a.alt.toLocaleString("es")} ft` : "—"),
  altM: (ft) => (ft != null ? `${Math.round(ft * FT_M).toLocaleString("es")} m` : "—"),
  vel: (kt) => (kt != null ? `${Math.round(kt)} kt` : "—"),
  velKmh: (kt) => (kt != null ? `${Math.round(kt * KT_KMH)} km/h` : "—"),
  vrate: (v) => (v != null ? `${v > 0 ? "+" : ""}${v.toLocaleString("es")} ft/min` : "—"),
  grados: (g) => (g != null ? `${Math.round(g)}°` : "—"),
  km: (d) => (d != null ? `${d < 10 ? d.toFixed(1) : Math.round(d)} km` : "—"),
  seg: (s) => (s != null ? `${s.toFixed(1)} s` : "—"),
  coord: (v) => (v != null ? v.toFixed(5) : "—"),
};

export const ftAMetros = (ft) => (ft ?? 0) * FT_M;

const PUNTOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const puntoCardinal = (g) => (g == null ? "" : PUNTOS[Math.round(g / 45) % 8]);

export const SQUAWKS = {
  7500: "Secuestro",
  7600: "Fallo de radio",
  7700: "Emergencia general",
  7000: "VFR (Europa)",
  2000: "Sin asignar (IFR)",
  1200: "VFR (América)",
};

export const CATEGORIAS = {
  A0: "Sin información",
  A1: "Ligero (< 7 t)",
  A2: "Pequeño (7–34 t)",
  A3: "Grande (34–136 t)",
  A4: "Vórtice alto (B757)",
  A5: "Pesado (> 136 t)",
  A6: "Alto rendimiento",
  A7: "Helicóptero",
  B1: "Planeador",
  B2: "Globo / dirigible",
  B3: "Paracaidista",
  B4: "Ultraligero",
  B6: "Dron (UAV)",
  B7: "Espacial",
  C1: "Vehículo de emergencia",
  C2: "Vehículo de servicio",
  C3: "Obstáculo",
};

// ---------- Info externa (HexDB + Planespotters), cacheada por hex/vuelo ----------
const cache = new Map();

async function getJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const txt = await r.text();
    // HexDB a veces responde "n/a" en texto plano
    return txt.startsWith("{") || txt.startsWith("[") ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

async function cargarInfo(hex, vuelo) {
  const [avion, ruta, fotos] = await Promise.all([
    getJson(`https://hexdb.io/api/v1/aircraft/${hex.toUpperCase()}`),
    vuelo ? getJson(`https://hexdb.io/api/v1/route/icao/${vuelo}`) : null,
    getJson(`https://api.planespotters.net/pub/photos/hex/${hex}`),
  ]);

  const [codOrigen, codDestino] = ruta?.route?.split("-") ?? [];
  const [origen, destino] = await Promise.all(
    [codOrigen, codDestino].map((c) =>
      c ? getJson(`https://hexdb.io/api/v1/airport/icao/${c}`).then((x) => x ?? { icao: c }) : null,
    ),
  );

  return {
    matricula: avion?.Registration || null,
    fabricante: avion?.Manufacturer || null,
    modelo: avion?.Type || null,
    tipoIcao: avion?.ICAOTypeCode || null,
    propietario: avion?.RegisteredOwners || null,
    operador: avion?.OperatorFlagCode || null,
    origen,
    destino,
    fotos: (fotos?.photos ?? []).map((p) => ({
      peque: p.thumbnail?.src,
      grande: p.thumbnail_large?.src,
      enlace: p.link,
      autor: p.photographer,
    })),
  };
}

export function useAvionInfo(hex, vuelo) {
  const clave = `${hex}|${vuelo ?? ""}`;
  const [, forzar] = useState(0);

  useEffect(() => {
    if (!hex) return;
    let vivo = true;
    if (!cache.has(clave)) {
      cache.set(clave, cargarInfo(hex, vuelo).then((info) => (cache.set(clave, info), info)));
    }
    const v = cache.get(clave);
    if (v instanceof Promise) v.then(() => vivo && forzar((n) => n + 1));
    return () => {
      vivo = false;
    };
  }, [clave, hex, vuelo]);

  const v = cache.get(clave);
  return v && !(v instanceof Promise) ? v : null;
}
