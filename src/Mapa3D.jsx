import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, LineLayer, TextLayer, ScatterplotLayer } from "@deck.gl/layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { colorAltitud, ftAMetros, tienePos, useAvionInfo, fmt } from "./datos";

const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESTILOS = {
  oscuro: "https://tiles.openfreemap.org/styles/dark",
  claro: "https://tiles.openfreemap.org/styles/liberty",
  satelite: {
    version: 8,
    sources: { sat: { type: "raster", tiles: [SAT], tileSize: 256, maxzoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar" } },
    layers: [{ id: "sat", type: "raster", source: "sat" }],
  },
};
const DEM = {
  type: "raster-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 14,
  attribution: "Relieve: Mapzen / AWS Terrain Tiles",
};
const ANILLOS_KM = [25, 50, 100, 150, 200, 300];

const AVION = crearMallaAvion();

export default function Mapa3D({ aviones, rastros, receptor, seleccionado, onSeleccion }) {
  const contRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const avionesRef = useRef(aviones);
  const centrado = useRef(false);
  const [zoom, setZoom] = useState(8);
  const [listo, setListo] = useState(false);
  const [op, setOp] = useState({
    estilo: "oscuro",
    terreno: true,
    rastros: true,
    etiquetas: true,
    lineas: true,
    anillos: true,
    seguir: false,
  });
  const cambiar = (k, v) => setOp((o) => ({ ...o, [k]: v ?? !o[k] }));

  const sel = aviones.find((a) => a.hex === seleccionado);
  const infoSel = useAvionInfo(sel);

  useEffect(() => {
    avionesRef.current = aviones;
  });

  // --- Crear mapa una vez ---
  useEffect(() => {
    const map = new maplibregl.Map({
      container: contRef.current,
      style: ESTILOS.oscuro,
      center: [0, 30],
      zoom: 2,
      pitch: 55,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
      getTooltip: ({ object, layer }) =>
        object?.hex && layer?.id !== "rastros"
          ? {
              html: `<b>${object.vuelo ?? object.hex.toUpperCase()}</b><br>${fmt.alt(object)} · ${fmt.vel(object.gs)} · ${fmt.grados(object.track)}${
                object.dist != null ? `<br>${fmt.kmAprox(object.dist)} del centro` : ""
              }`,
              className: "tooltip-avion",
            }
          : null,
    });
    map.addControl(overlay);

    const onZoom = () => setZoom(Math.round(map.getZoom() * 4) / 4);
    map.on("zoom", onZoom);
    map.on("load", () => setListo(true));

    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Estilo + terreno + cielo ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    const aplicar = () => {
      if (!map.getSource("dem")) map.addSource("dem", DEM);
      if (!map.getSource("dem-sombra")) map.addSource("dem-sombra", DEM);
      if (!map.getLayer("relieve")) {
        const primerTexto = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
        map.addLayer(
          {
            id: "relieve",
            type: "hillshade",
            source: "dem-sombra",
            paint: { "hillshade-exaggeration": op.estilo === "satelite" ? 0.15 : 0.25, "hillshade-shadow-color": "#000" },
          },
          primerTexto,
        );
      }
      map.setTerrain(op.terreno ? { source: "dem", exaggeration: 1 } : null);
      map.setSky({
        "sky-color": op.estilo === "claro" ? "#8ec5ff" : "#07111f",
        "horizon-color": op.estilo === "claro" ? "#dceeff" : "#1b3550",
        "fog-color": op.estilo === "claro" ? "#dceeff" : "#0a1626",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.6,
        "fog-ground-blend": 0.3,
      });
    };
    if (map.isStyleLoaded()) aplicar();
    map.on("style.load", aplicar);
    return () => map.off("style.load", aplicar);
  }, [listo, op.terreno, op.estilo]);

  const cambiarEstilo = (e) => {
    const map = mapRef.current;
    if (!map || e === op.estilo) return;
    cambiar("estilo", e);
    // maplibre peta si cambias estilo con terreno activo; se vuelve a poner en style.load
    map.setTerrain(null);
    map.setStyle(ESTILOS[e], { diff: false });
  };

  // --- Centrar al principio ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || centrado.current) return;
    const conPos = aviones.filter(tienePos);
    const c = receptor ?? (conPos.length && {
      lat: conPos.reduce((s, a) => s + a.lat, 0) / conPos.length,
      lon: conPos.reduce((s, a) => s + a.lon, 0) / conPos.length,
    });
    if (!c) return;
    centrado.current = true;
    map.jumpTo({ center: [c.lon, c.lat], zoom: 8.5, pitch: 55, bearing: -15 });
  }, [aviones, receptor]);

  // --- Volar al seleccionado ---
  useEffect(() => {
    const a = avionesRef.current.find((x) => x.hex === seleccionado);
    if (!a || !tienePos(a) || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo({ center: [a.lon, a.lat], zoom: Math.max(map.getZoom(), 9), pitch: 60, duration: 1400 });
  }, [seleccionado]);

  // --- Seguir al seleccionado ---
  useEffect(() => {
    if (op.seguir && sel && tienePos(sel)) mapRef.current?.easeTo({ center: [sel.lon, sel.lat], duration: 1800 });
  }, [op.seguir, sel?.lat, sel?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Capas deck.gl ---
  const capas = useMemo(() => {
    const conPos = aviones.filter(tienePos);
    const lat = receptor?.lat ?? conPos[0]?.lat ?? 0;
    // tamaño ~40 px en pantalla sin importar el zoom
    const metrosPx = (156543 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
    const tam = Math.max(60, 40 * metrosPx);
    const pos = (a) => [a.lon, a.lat, ftAMetros(a.alt)];
    const click = ({ object }) => object?.hex && onSeleccion(object.hex);

    const lista = [];

    if (op.anillos && receptor) {
      lista.push(
        new PathLayer({
          id: "anillos",
          data: ANILLOS_KM.map((km) => ({ km, path: circulo(receptor, km) })),
          getPath: (d) => d.path,
          getColor: op.estilo === "claro" ? [30, 60, 100, 120] : [120, 180, 255, 70],
          widthMinPixels: 1,
        }),
        new TextLayer({
          id: "anillos-txt",
          data: ANILLOS_KM.map((km) => ({ km, p: circulo(receptor, km)[0] })),
          getPosition: (d) => d.p,
          getText: (d) => `${d.km} km`,
          getSize: 11,
          getColor: op.estilo === "claro" ? [30, 60, 100, 200] : [150, 200, 255, 160],
          getPixelOffset: [0, -8],
        }),
        // Mancha difusa de 2 km, no un punto: el centro es aproximado y no debe parecer la antena
        new ScatterplotLayer({
          id: "centro",
          data: [receptor],
          getPosition: (d) => [d.lon, d.lat],
          getRadius: 2000,
          radiusUnits: "meters",
          getFillColor: op.estilo === "claro" ? [30, 60, 100, 50] : [120, 180, 255, 45],
        }),
      );
    }

    if (op.rastros) {
      lista.push(
        new PathLayer({
          id: "rastros",
          data: Object.entries(rastros).map(([hex, pts]) => ({
            hex,
            path: pts.map((p) => [p[0], p[1], ftAMetros(p[2])]),
            colores: pts.map((p) => [...colorAltitud(p[4]), 230]),
          })),
          getPath: (d) => d.path,
          getColor: (d) => d.colores,
          getWidth: (d) => (d.hex === seleccionado ? 4 : 2),
          widthUnits: "pixels",
          billboard: true,
          jointRounded: true,
          capRounded: true,
          updateTriggers: { getWidth: seleccionado },
        }),
      );
    }

    if (op.lineas) {
      lista.push(
        new LineLayer({
          id: "lineas",
          data: conPos,
          getSourcePosition: pos,
          getTargetPosition: (a) => [a.lon, a.lat, 0],
          getColor: (a) => [...colorAltitud(a.alt), 90],
          getWidth: 1,
        }),
      );
    }

    // Ruta del seleccionado: origen -> avión -> destino
    if (sel && tienePos(sel) && infoSel?.origen?.latitude != null && infoSel?.destino?.latitude != null) {
      const o = [infoSel.origen.longitude, infoSel.origen.latitude, 0];
      const d = [infoSel.destino.longitude, infoSel.destino.latitude, 0];
      lista.push(
        new LineLayer({
          id: "ruta",
          data: [
            { s: o, t: pos(sel), c: [255, 255, 255, 200] },
            { s: pos(sel), t: d, c: [255, 210, 80, 200] },
          ],
          getSourcePosition: (x) => x.s,
          getTargetPosition: (x) => x.t,
          getColor: (x) => x.c,
          getWidth: 2,
        }),
        new TextLayer({
          id: "aeropuertos",
          data: [infoSel.origen, infoSel.destino],
          getPosition: (a) => [a.longitude, a.latitude],
          getText: (a) => a.iata || a.icao,
          getSize: 14,
          getColor: [255, 210, 80],
          background: true,
          getBackgroundColor: [10, 20, 35, 220],
          backgroundPadding: [4, 2],
          fontWeight: 700,
        }),
      );
    }

    lista.push(
      new SimpleMeshLayer({
        id: "aviones",
        data: conPos,
        mesh: AVION,
        sizeScale: tam,
        getPosition: pos,
        getOrientation: (a) => [0, -(a.track ?? 0), 0],
        getColor: (a) => (a.hex === seleccionado ? [255, 255, 255] : colorAltitud(a.alt)),
        pickable: true,
        onClick: click,
        material: { ambient: 0.55, diffuse: 0.6, shininess: 40, specularColor: [255, 255, 255] },
        updateTriggers: { getColor: seleccionado },
      }),
    );

    if (op.etiquetas) {
      lista.push(
        new TextLayer({
          id: "etiquetas",
          data: conPos,
          getPosition: pos,
          getText: (a) => `${a.vuelo ?? a.hex.toUpperCase()}\n${a.enSuelo ? "GND" : a.alt != null ? `${Math.round(a.alt / 100)}`.padStart(3, "0") : ""}`,
          getSize: (a) => (a.hex === seleccionado ? 14 : 12),
          getColor: (a) => (a.hex === seleccionado ? [255, 255, 255] : [...colorAltitud(a.alt), 255]),
          getPixelOffset: [0, -30],
          background: true,
          getBackgroundColor: [8, 14, 24, 200],
          backgroundPadding: [5, 3],
          fontFamily: "B612 Mono, monospace",
          fontWeight: 600,
          lineHeight: 1.1,
          pickable: true,
          onClick: click,
          updateTriggers: { getSize: seleccionado, getColor: seleccionado },
        }),
      );
    }
    return lista;
  }, [aviones, rastros, receptor, op, zoom, seleccionado, sel, infoSel, onSeleccion]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers: capas });
  }, [capas]);

  const vista = (pitch) => mapRef.current?.easeTo({ pitch, duration: 800 });
  const alCentro = () =>
    receptor && mapRef.current?.flyTo({ center: [receptor.lon, receptor.lat], zoom: 8.5, duration: 1200 });

  return (
    <div className="mapa">
      <div ref={contRef} className="mapa-lienzo" />

      <details className="mapa-panel" open>
        <summary>Opciones del mapa</summary>
        <div className="seg" role="group" aria-label="Estilo de mapa">
          {Object.keys(ESTILOS).map((e) => (
            <button key={e} className={op.estilo === e ? "on" : ""} onClick={() => cambiarEstilo(e)}>
              {{ oscuro: "Oscuro", claro: "Claro", satelite: "Satélite" }[e]}
            </button>
          ))}
        </div>
        <div className="seg">
          <button onClick={() => vista(60)}>3D</button>
          <button onClick={() => vista(0)}>Cenital</button>
          {receptor && <button onClick={alCentro}>Centro</button>}
        </div>
        <div className="toggles">
          {[
            ["terreno", "Relieve 3D"],
            ["rastros", "Rastros"],
            ["etiquetas", "Etiquetas"],
            ["lineas", "Líneas al suelo"],
            ["anillos", "Anillos de alcance"],
            ["seguir", "Seguir seleccionado"],
          ].map(([k, t]) => (
            <label key={k}>
              <input type="checkbox" checked={op[k]} onChange={() => cambiar(k)} disabled={k === "seguir" && !sel} />
              {t}
            </label>
          ))}
        </div>
      </details>

      <div className="leyenda" aria-label="Colores por altitud">
        <span className="leyenda-t">Altitud (ft)</span>
        <div className="leyenda-barra" />
        <div className="leyenda-marcas">
          {["0", "2k", "6k", "12k", "20k", "30k", "40k+"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="leyenda-nota">Distancias y anillos desde un centro aproximado (±1 km), no desde la antena.</p>
      </div>
      <p className="mapa-ayuda">Arrastra para mover · Clic derecho / Ctrl + arrastrar para rotar e inclinar · Clic en un avión para ver detalles</p>
    </div>
  );
}

function circulo({ lat, lon }, km) {
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * 2 * Math.PI;
    pts.push([lon + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(t), lat + (km / 111.32) * Math.cos(t)]);
  }
  return pts;
}

// Avión low-poly hecho a mano, morro hacia +Y (norte), largo ~1 unidad
function crearMallaAvion() {
  const pos = [];
  const nor = [];
  const tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1;
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) nor.push(n[0] / l, n[1] / l, n[2] / l);
  };
  const quad = (a, b, c, d) => (tri(a, b, c), tri(a, c, d));
  // ambas caras para que se vea desde abajo
  const lamina = (a, b, c, d) => (quad(a, b, c, d), quad(a, d, c, b));

  // fuselaje: morro, dos anillos, cola
  const w = 0.055;
  const anillo = (y, r, z = 0) => [
    [r, y, z],
    [0, y, z + r],
    [-r, y, z],
    [0, y, z - r],
  ];
  const morro = [0, 0.5, 0];
  const cola = [0, -0.5, 0.03];
  const a1 = anillo(0.32, w);
  const a2 = anillo(-0.3, w * 0.8, 0.01);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tri(morro, a1[j], a1[i]);
    quad(a1[i], a1[j], a2[j], a2[i]);
    tri(a2[i], a2[j], cola);
  }
  // alas
  lamina([0, 0.14, 0], [0.52, -0.1, 0.02], [0.52, -0.18, 0.02], [0, -0.08, 0]);
  lamina([0, -0.08, 0], [-0.52, -0.18, 0.02], [-0.52, -0.1, 0.02], [0, 0.14, 0]);
  // estabilizador horizontal
  lamina([0, -0.34, 0.02], [0.2, -0.46, 0.03], [0.2, -0.5, 0.03], [0, -0.47, 0.02]);
  lamina([0, -0.47, 0.02], [-0.2, -0.5, 0.03], [-0.2, -0.46, 0.03], [0, -0.34, 0.02]);
  // deriva
  lamina([0, -0.3, 0.04], [0, -0.42, 0.22], [0, -0.48, 0.22], [0, -0.5, 0.03]);

  return {
    positions: { value: new Float32Array(pos), size: 3 },
    normals: { value: new Float32Array(nor), size: 3 },
  };
}
