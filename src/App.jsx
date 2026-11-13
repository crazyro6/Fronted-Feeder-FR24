import { useEffect, useMemo, useState } from "react";
import AvionCard from "./AvionCard";
import AvionModal from "./AvionModal";
import Mapa3D from "./Mapa3D";
import { normalizar, tienePos, distanciaKm, fmt } from "./datos";

// API pública del portfolio (mismo dominio en roypara.com/radar/; en dev la pasa el proxy de Vite).
// receiver.json da solo el centro APROXIMADO del radar: no pongas aquí nunca la posición de la antena.
const BASE = import.meta.env.VITE_RADAR_URL ?? "/api";
const URL_AVIONES = `${BASE}/aircraft.json`;
const URL_RECEPTOR = `${BASE}/receiver.json`;
const REFRESCO_MS = 5000; // el Worker cachea 5 s: leer más rápido no trae nada nuevo y gasta cuota
const MAX_PUNTOS = 400; // puntos de rastro por avión
const OLVIDAR_S = 300; // borrar rastro tras 5 min sin verlo

const ORDENES = {
  distancia: (a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9),
  altitud: (a, b) => (b.alt ?? -1) - (a.alt ?? -1),
  velocidad: (a, b) => (b.gs ?? -1) - (a.gs ?? -1),
  vuelo: (a, b) => (a.vuelo ?? "~" + a.hex).localeCompare(b.vuelo ?? "~" + b.hex),
  senal: (a, b) => (b.rssi ?? -99) - (a.rssi ?? -99),
};

export default function App() {
  const [radar, setRadar] = useState({ aviones: [], rastros: {}, msgSeg: 0, ok: null });
  const [receptor, setReceptor] = useState(null); // centro aproximado, no la antena
  const [selHex, setSelHex] = useState(null);
  const [modalAvion, setModalAvion] = useState(null);
  const [busca, setBusca] = useState("");
  const [orden, setOrden] = useState("distancia");
  const [soloConVuelo, setSoloConVuelo] = useState(false);

  useEffect(() => {
    fetch(URL_RECEPTOR)
      .then((r) => r.json())
      .then((d) => d.lat != null && d.lon != null && setReceptor({ lat: d.lat, lon: d.lon }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const rastros = {};
    let previo = null;

    const leer = async () => {
      try {
        const res = await fetch(URL_AVIONES);
        if (!res.ok) throw new Error(`HTTP ${res.status}`); // 503 = la antena no responde
        const datos = await res.json();
        const ahora = datos.now ?? Date.now() / 1000;
        const aviones = datos.aircraft
          .filter((a) => a.hex && (a.seen ?? 0) < 60)
          .map((a) => ({ ...normalizar(a), ahora }));

        for (const a of aviones) {
          if (!tienePos(a) || (a.vistoPos ?? 0) > 30) continue;
          const r = (rastros[a.hex] ??= []);
          const ult = r.at(-1);
          if (!ult || ult[0] !== a.lon || ult[1] !== a.lat || ult[4] !== a.alt) {
            r.push([a.lon, a.lat, a.alt ?? 0, ahora - (a.vistoPos ?? 0), a.alt, a.gs]);
            if (r.length > MAX_PUNTOS) r.shift();
          }
        }
        for (const hex in rastros) {
          if (ahora - rastros[hex].at(-1)[3] > OLVIDAR_S) delete rastros[hex];
        }

        const msgSeg =
          previo && datos.messages >= previo.m && ahora > previo.t
            ? (datos.messages - previo.m) / (ahora - previo.t)
            : 0;
        previo = { m: datos.messages, t: ahora };

        setRadar((s) => ({
          aviones,
          rastros: { ...rastros },
          msgSeg: msgSeg || s.msgSeg,
          ok: true,
        }));
      } catch (error) {
        console.error("Error leyendo el radar:", error);
        setRadar((s) => ({ ...s, ok: false }));
      }
    };

    // Con la pestaña oculta no se pide nada: la cuota del Worker es compartida.
    let intervalo;
    const arrancar = () => {
      clearInterval(intervalo);
      if (document.hidden) return;
      leer();
      intervalo = setInterval(leer, REFRESCO_MS);
    };
    arrancar();
    document.addEventListener("visibilitychange", arrancar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", arrancar);
    };
  }, []);

  const aviones = useMemo(
    () =>
      radar.aviones.map((a) => ({
        ...a,
        dist: receptor && tienePos(a) ? distanciaKm(receptor.lat, receptor.lon, a.lat, a.lon) : null,
      })),
    [radar.aviones, receptor],
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return aviones
      .filter((a) => !soloConVuelo || a.vuelo)
      .filter((a) => !q || a.hex.includes(q) || a.vuelo?.toLowerCase().includes(q) || a.squawk?.includes(q))
      .sort(ORDENES[orden]);
  }, [aviones, busca, orden, soloConVuelo]);

  const stats = useMemo(() => {
    const conPos = aviones.filter(tienePos);
    const alto = aviones.reduce((m, a) => (a.alt != null && a.alt > (m?.alt ?? -1) ? a : m), null);
    const lejos = aviones.reduce((m, a) => (a.dist != null && a.dist > (m?.dist ?? -1) ? a : m), null);
    const rapido = aviones.reduce((m, a) => (a.gs != null && a.gs > (m?.gs ?? -1) ? a : m), null);
    return { conPos: conPos.length, alto, lejos, rapido, mlat: aviones.filter((a) => a.mlat).length };
  }, [aviones]);

  const emergencias = aviones.filter((a) => ["7500", "7600", "7700"].includes(a.squawk) || a.emergencia);

  const abrir = (hex) => {
    setSelHex(hex);
    setModalAvion(aviones.find((a) => a.hex === hex) ?? null);
  };
  const avionModalVivo = modalAvion && (aviones.find((a) => a.hex === modalAvion.hex) ?? modalAvion);

  return (
    <div className="app">
      <header className="topbar">
        <div className="marca">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
            <path d="M12 12 L12 2" stroke="currentColor" strokeWidth="2" className="barrido" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          </svg>
          <div>
            <h1>Radar ADS-B</h1>
            <a className="volver" href="https://roypara.com/">
              ← roypara.com
            </a>
            <span className={`estado ${radar.ok === false ? "mal" : radar.ok ? "bien" : ""}`}>
              {radar.ok === false ? "Sin conexión con la antena" : radar.ok ? "En vivo · readsb" : "Conectando…"}
            </span>
          </div>
        </div>

        <div className="stats">
          <Stat titulo="Aviones" valor={aviones.length} sub={`${stats.conPos} con posición`} />
          <Stat titulo="Mensajes/s" valor={Math.round(radar.msgSeg)} sub={`${stats.mlat} por MLAT`} />
          <Stat
            titulo="Más alto"
            valor={stats.alto ? fmt.alt(stats.alto) : "—"}
            sub={stats.alto?.vuelo ?? stats.alto?.hex}
            onClick={stats.alto && (() => abrir(stats.alto.hex))}
          />
          <Stat
            titulo="Más lejano"
            valor={fmt.kmAprox(stats.lejos?.dist)}
            sub={stats.lejos ? stats.lejos.vuelo ?? stats.lejos.hex : receptor ? "" : "Sin centro del radar"}
            onClick={stats.lejos && (() => abrir(stats.lejos.hex))}
          />
          <Stat
            titulo="Más rápido"
            valor={stats.rapido ? fmt.velKmh(stats.rapido.gs) : "—"}
            sub={stats.rapido?.vuelo ?? stats.rapido?.hex}
            onClick={stats.rapido && (() => abrir(stats.rapido.hex))}
          />
        </div>
      </header>

      {emergencias.length > 0 && (
        <div className="alerta" role="alert">
          ⚠ Squawk de emergencia:{" "}
          {emergencias.map((a) => (
            <button key={a.hex} onClick={() => abrir(a.hex)}>
              {a.vuelo ?? a.hex} ({a.squawk ?? a.emergencia})
            </button>
          ))}
        </div>
      )}

      <main className="layout">
        <section className="mapa-wrap">
          <Mapa3D
            aviones={aviones}
            rastros={radar.rastros}
            receptor={receptor}
            seleccionado={selHex}
            onSeleccion={abrir}
          />
        </section>

        <aside className="lista">
          <div className="lista-barra">
            <input
              type="search"
              placeholder="Buscar vuelo, hex o squawk…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar avión"
            />
            <div className="lista-opciones">
              <label>
                Orden
                <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                  <option value="distancia">Distancia</option>
                  <option value="altitud">Altitud</option>
                  <option value="velocidad">Velocidad</option>
                  <option value="vuelo">Vuelo</option>
                  <option value="senal">Señal</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={soloConVuelo} onChange={(e) => setSoloConVuelo(e.target.checked)} />
                Solo con nº de vuelo
              </label>
              <span className="contador">{lista.length}</span>
            </div>
          </div>

          <div className="tarjetas">
            {lista.length > 0 ? (
              lista.map((avion) => (
                <AvionCard
                  key={avion.hex}
                  avion={avion}
                  seleccionado={avion.hex === selHex}
                  onClick={() => abrir(avion.hex)}
                />
              ))
            ) : (
              <p className="vacio">
                {radar.ok === false ? "No llegan datos de la Raspberry." : "Escaneando el cielo…"}
              </p>
            )}
          </div>
        </aside>
      </main>

      {avionModalVivo && (
        <AvionModal
          avion={avionModalVivo}
          perdido={!aviones.some((a) => a.hex === avionModalVivo.hex)}
          rastro={radar.rastros[avionModalVivo.hex] ?? []}
          receptor={receptor}
          onCerrar={() => setModalAvion(null)}
        />
      )}
    </div>
  );
}

function Stat({ titulo, valor, sub, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="stat" onClick={onClick || undefined}>
      <span className="stat-t">{titulo}</span>
      <strong>{valor}</strong>
      {sub && <small>{sub}</small>}
    </Tag>
  );
}
