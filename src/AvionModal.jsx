import { useEffect, useRef, useState } from "react";
import {
  useAvionInfo,
  colorAltitud,
  rgb,
  fmt,
  distanciaKm,
  rumboHacia,
  puntoCardinal,
  SQUAWKS,
  CATEGORIAS,
} from "./datos";

export default function AvionModal({ avion, perdido, rastro, receptor, onCerrar }) {
  const ref = useRef(null);
  const info = useAvionInfo(avion);
  const [fotoIdx, setFotoIdx] = useState(0);
  const foto = info?.fotos[fotoIdx];
  const color = rgb(colorAltitud(avion.alt));

  useEffect(() => {
    // sin close() en cleanup: StrictMode lo dispararía y cerraría el modal al abrir
    if (!ref.current.open) ref.current.showModal();
  }, []);

  // receptor = centro aproximado del radar (±1 km), así que distancia y dirección son aproximadas
  const conPos = avion.lat != null && avion.lon != null;
  const distRx = receptor && conPos ? distanciaKm(receptor.lat, receptor.lon, avion.lat, avion.lon) : null;
  const rumboRx = receptor && conPos ? rumboHacia(receptor.lat, receptor.lon, avion.lat, avion.lon) : null;

  const fase =
    avion.enSuelo ? "En tierra" : avion.vrate > 256 ? "Ascenso" : avion.vrate < -256 ? "Descenso" : "Crucero / nivelado";
  const sqInfo = avion.squawk && SQUAWKS[avion.squawk];
  const emergencia = ["7500", "7600", "7700"].includes(avion.squawk);
  const fuente = avion.mlat ? "MLAT" : avion.tisb ? "TIS-B" : avion.tipoFuente ?? "ADS-B";
  // la descripción de la Pi ya suele empezar por el fabricante («AIRBUS A-320neo»)
  const fab = info?.fabricante;
  const modeloCompleto =
    fab && !info.modelo?.toLowerCase().startsWith(fab.toLowerCase()) ? [fab, info.modelo].filter(Boolean).join(" ") : info?.modelo;

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      style={{ "--alt": color }}
      aria-labelledby="modal-titulo"
    >
      <div className="modal-caja">
        <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>

        {/* ---------- Cabecera ---------- */}
        <header className="m-hero">
          <div className="m-foto">
            {foto ? (
              <>
                <img src={foto.grande || foto.peque} alt={`Foto de ${info.matricula ?? avion.hex}`} />
                <a className="credito" href={foto.enlace} target="_blank" rel="noreferrer">
                  © {foto.autor} · Planespotters.net
                </a>
                {info.fotos.length > 1 && (
                  <div className="m-fotos-nav">
                    {info.fotos.map((_, i) => (
                      <button key={i} className={i === fotoIdx ? "on" : ""} onClick={() => setFotoIdx(i)} aria-label={`Foto ${i + 1}`} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span className="sin-foto">{info ? "Sin foto disponible" : "Cargando foto…"}</span>
            )}
          </div>

          <div className="m-titulo">
            <div className="m-chips">
              <span className="chip fuente">{fuente}</span>
              {perdido && <span className="chip rojo">Señal perdida</span>}
              {emergencia && <span className="chip rojo">⚠ {sqInfo}</span>}
              {avion.enSuelo && <span className="chip">En tierra</span>}
            </div>
            <h2 id="modal-titulo">{avion.vuelo ?? avion.hex.toUpperCase()}</h2>
            <p className="m-aerolinea">{info?.propietario ?? (info ? "Operador desconocido" : "Cargando…")}</p>
            <p className="m-modelo">
              {modeloCompleto || "Modelo desconocido"}
              {info?.matricula && <span className="reg">{info.matricula}</span>}
            </p>

            <div className="m-kpis">
              <Kpi t="Altitud" v={fmt.alt(avion)} s={fmt.altM(avion.alt)} color={color} />
              <Kpi t="Velocidad" v={fmt.vel(avion.gs)} s={fmt.velKmh(avion.gs)} />
              <Kpi t="Rumbo" v={fmt.grados(avion.track)} s={puntoCardinal(avion.track)} />
              <Kpi t="V. vertical" v={fmt.vrate(avion.vrate)} s={fase} />
            </div>
          </div>
        </header>

        <div className="m-grid">
          {/* ---------- Ruta ---------- */}
          <Seccion titulo="Ruta" className="span2">
            <Ruta info={info} avion={avion} />
          </Seccion>

          {/* ---------- Vuelo ---------- */}
          <Seccion titulo="Datos de vuelo">
            <Filas
              filas={[
                ["Altitud barométrica", fmt.alt(avion)],
                ["Altitud geométrica (GPS)", avion.altGeom != null ? `${avion.altGeom.toLocaleString("es")} ft` : null],
                ["Altitud seleccionada (piloto)", avion.navAlt != null ? `${avion.navAlt.toLocaleString("es")} ft` : null],
                ["Velocidad respecto al suelo", `${fmt.vel(avion.gs)} · ${fmt.velKmh(avion.gs)}`],
                ["Velocidad indicada (IAS)", avion.ias != null ? fmt.vel(avion.ias) : null],
                ["Velocidad verdadera (TAS)", avion.tas != null ? fmt.vel(avion.tas) : null],
                ["Mach", avion.mach != null ? avion.mach.toFixed(3) : null],
                ["Velocidad vertical", fmt.vrate(avion.vrate)],
                ["Fase", fase],
                ["Rumbo seleccionado", avion.navRumbo != null ? fmt.grados(avion.navRumbo) : null],
                ["QNH", avion.qnh != null ? `${avion.qnh.toFixed(1)} hPa` : null],
                ["Viento", avion.viento ? `${avion.viento.dir}° a ${avion.viento.vel} kt` : null],
                ["Temperatura exterior", avion.oat != null ? `${avion.oat} °C` : null],
              ]}
            />
          </Seccion>

          {/* ---------- Brújula y posición ---------- */}
          <Seccion titulo="Posición">
            <div className="m-pos">
              <Brujula rumbo={avion.track} />
              <Filas
                filas={[
                  ["Latitud", fmt.coord(avion.lat)],
                  ["Longitud", fmt.coord(avion.lon)],
                  ["Distancia al centro (aprox.)", fmt.kmAprox(distRx)],
                  ["Dirección desde el centro (aprox.)", rumboRx != null ? `≈ ${fmt.grados(rumboRx)} ${puntoCardinal(rumboRx)}` : "—"],
                  ["Squawk", avion.squawk ? `${avion.squawk}${sqInfo ? ` · ${sqInfo}` : ""}` : "—"],
                ]}
              />
            </div>
          </Seccion>

          {/* ---------- Perfil ---------- */}
          <Seccion titulo="Perfil de altitud y velocidad" className="span2">
            <Perfil rastro={rastro} color={color} />
          </Seccion>

          {/* ---------- Aeronave ---------- */}
          <Seccion titulo="Aeronave">
            <Filas
              filas={[
                ["Matrícula", info?.matricula ?? "—"],
                ["Fabricante", info?.fabricante ?? "—"],
                ["Modelo", info?.modelo ?? "—"],
                ["Código tipo ICAO", info?.tipoIcao ?? "—"],
                ["Propietario / operador", info?.propietario ?? "—"],
                ["Código operador", info?.operador ?? "—"],
                ["Categoría", avion.categoria ? `${avion.categoria} · ${CATEGORIAS[avion.categoria] ?? ""}` : "—"],
                ["Dirección Mode S (hex)", avion.hex.toUpperCase()],
              ]}
            />
          </Seccion>

          {/* ---------- Recepción ---------- */}
          <Seccion titulo="Recepción">
            <Filas
              filas={[
                ["Fuente", fuente],
                ["Señal (RSSI)", avion.rssi != null ? <Senal rssi={avion.rssi} /> : "—"],
                ["Mensajes recibidos", avion.mensajes?.toLocaleString("es") ?? "—"],
                ["Último mensaje hace", fmt.seg(avion.visto)],
                ["Última posición hace", fmt.seg(avion.vistoPos)],
                ["Puntos de rastro", rastro.length],
              ]}
            />
          </Seccion>

          {/* ---------- Enlaces ---------- */}
          <Seccion titulo="Ver en otras webs" className="span2">
            <div className="m-enlaces">
              {avion.vuelo && (
                <a href={`https://www.flightradar24.com/${avion.vuelo}`} target="_blank" rel="noreferrer">
                  Flightradar24
                </a>
              )}
              <a href={`https://globe.adsbexchange.com/?icao=${avion.hex}`} target="_blank" rel="noreferrer">
                ADS-B Exchange
              </a>
              {avion.vuelo && (
                <a href={`https://flightaware.com/live/flight/${avion.vuelo}`} target="_blank" rel="noreferrer">
                  FlightAware
                </a>
              )}
              {info?.matricula && (
                <a href={`https://www.planespotters.net/search?q=${info.matricula}`} target="_blank" rel="noreferrer">
                  Planespotters
                </a>
              )}
            </div>
          </Seccion>
        </div>
      </div>
    </dialog>
  );
}

function Seccion({ titulo, className = "", children }) {
  return (
    <section className={`m-sec ${className}`}>
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

function Kpi({ t, v, s, color }) {
  return (
    <div className="kpi" style={color ? { "--c": color } : undefined}>
      <span>{t}</span>
      <strong>{v}</strong>
      <small>{s}</small>
    </div>
  );
}

function Filas({ filas }) {
  return (
    <dl className="filas">
      {filas
        .filter(([, v]) => v != null)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

function Ruta({ info, avion }) {
  if (!info) return <p className="tenue">Buscando ruta…</p>;
  const { origen, destino } = info;
  if (!origen || !destino) return <p className="tenue">No hay ruta registrada para este vuelo en HexDB.</p>;

  const coords = (x) => x.latitude != null && x.longitude != null;
  let progreso = null;
  if (coords(origen) && coords(destino) && avion.lat != null) {
    const hecho = distanciaKm(origen.latitude, origen.longitude, avion.lat, avion.lon);
    const falta = distanciaKm(avion.lat, avion.lon, destino.latitude, destino.longitude);
    const total = distanciaKm(origen.latitude, origen.longitude, destino.latitude, destino.longitude);
    const min = avion.gs > 50 ? (falta / (avion.gs * 1.852)) * 60 : null;
    progreso = { hecho, falta, total, pct: Math.min(100, (hecho / (hecho + falta)) * 100), min };
  }

  const eta = progreso?.min != null && avion.ahora ? new Date((avion.ahora ?? 0) * 1000 + progreso.min * 60000) : null;

  return (
    <div className="ruta">
      <Aeropuerto a={origen} etiqueta="Origen" />
      <div className="ruta-centro">
        {progreso ? (
          <>
            <div className="ruta-barra">
              <div style={{ width: `${progreso.pct}%` }} />
              <span className="ruta-avion" style={{ left: `${progreso.pct}%` }}>
                ✈
              </span>
            </div>
            <div className="ruta-datos">
              <span>{fmt.km(progreso.hecho)} recorridos</span>
              <span>{fmt.km(progreso.total)} total</span>
              <span>{fmt.km(progreso.falta)} restantes</span>
            </div>
            {eta && (
              <p className="ruta-eta">
                Llegada estimada{" "}
                <b>{eta.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</b> (≈
                {Math.round(progreso.min)} min a velocidad actual)
              </p>
            )}
          </>
        ) : (
          <div className="ruta-barra" />
        )}
      </div>
      <Aeropuerto a={destino} etiqueta="Destino" />
    </div>
  );
}

function Aeropuerto({ a, etiqueta }) {
  return (
    <div className="aeropuerto">
      <span className="tenue">{etiqueta}</span>
      <strong>{a.iata || a.icao}</strong>
      <span>{a.airport ?? a.icao}</span>
      <small>{[a.region_name, a.country_code].filter(Boolean).join(", ")}</small>
    </div>
  );
}

function Brujula({ rumbo }) {
  return (
    <svg className="brujula" viewBox="-50 -50 100 100" role="img" aria-label={`Rumbo ${Math.round(rumbo ?? 0)} grados`}>
      <circle r="46" className="b-aro" />
      {Array.from({ length: 36 }, (_, i) => (
        <line key={i} y1={-46} y2={i % 9 === 0 ? -38 : -42} transform={`rotate(${i * 10})`} className="b-marca" />
      ))}
      {["N", "E", "S", "O"].map((l, i) => (
        <text key={l} transform={`rotate(${i * 90}) translate(0 -28) rotate(${-i * 90})`} className="b-letra">
          {l}
        </text>
      ))}
      {rumbo != null && (
        <path
          d="M0 -22 L5 6 L18 12 L18 16 L4 12 L3 22 L8 26 L8 28 L0 26 L-8 28 L-8 26 L-3 22 L-4 12 L-18 16 L-18 12 L-5 6 Z"
          transform={`rotate(${rumbo})`}
          className="b-avion"
        />
      )}
    </svg>
  );
}

function Senal({ rssi }) {
  // RSSI de readsb va de ~ -50 (débil) a 0 dBFS (fuerte)
  const pct = Math.max(0, Math.min(100, ((rssi + 40) / 40) * 100));
  return (
    <span className="senal">
      <span className="senal-barra">
        <span style={{ width: `${pct}%` }} />
      </span>
      {rssi.toFixed(1)} dBFS
    </span>
  );
}

function Perfil({ rastro, color }) {
  const pts = rastro.filter((p) => p[4] != null);
  if (pts.length < 2) return <p className="tenue">Aún no hay suficientes datos. El perfil se dibuja mientras lo recibes.</p>;

  const W = 600;
  const H = 140;
  const t0 = pts[0][3];
  const t1 = pts.at(-1)[3];
  const maxAlt = Math.max(...pts.map((p) => p[4]), 1000);
  const maxVel = Math.max(...pts.map((p) => p[5] ?? 0), 100);
  const x = (t) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const lineaAlt = pts.map((p) => `${x(p[3]).toFixed(1)},${(H - (p[4] / maxAlt) * H).toFixed(1)}`).join(" ");
  const lineaVel = pts
    .filter((p) => p[5] != null)
    .map((p) => `${x(p[3]).toFixed(1)},${(H - (p[5] / maxVel) * H).toFixed(1)}`)
    .join(" ");
  const min = Math.round((t1 - t0) / 60);

  return (
    <div className="perfil">
      <div className="perfil-leyenda">
        <span style={{ color }}>■ Altitud (máx. {maxAlt.toLocaleString("es")} ft)</span>
        <span className="vel">■ Velocidad (máx. {Math.round(maxVel)} kt)</span>
        <span className="tenue">Últimos {min || "<1"} min</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="perfil-guia" />
        ))}
        <polygon points={`0,${H} ${lineaAlt} ${W},${H}`} fill={color} opacity="0.15" />
        <polyline points={lineaAlt} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polyline points={lineaVel} fill="none" className="perfil-vel" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
