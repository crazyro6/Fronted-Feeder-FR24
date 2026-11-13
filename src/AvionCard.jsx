import { useAvionInfo, colorAltitud, rgb, fmt } from "./datos";

export default function AvionCard({ avion, seleccionado, onClick }) {
  const info = useAvionInfo(avion);
  const foto = info?.fotos[0];
  const emergencia = ["7500", "7600", "7700"].includes(avion.squawk);
  const ruta = info?.origen && info?.destino;

  return (
    <button
      className={`card${seleccionado ? " sel" : ""}${emergencia ? " emerg" : ""}`}
      style={{ "--alt": rgb(colorAltitud(avion.alt)) }}
      onClick={onClick}
    >
      <div className="card-foto">
        {foto ? (
          <img src={foto.peque || foto.grande} alt="" loading="lazy" />
        ) : (
          <span className="sin-foto">{info ? "Sin foto" : "…"}</span>
        )}
        {avion.mlat && <span className="badge">MLAT</span>}
      </div>

      <div className="card-body">
        <div className="card-top">
          <span className="callsign">{avion.vuelo ?? avion.hex.toUpperCase()}</span>
          <span className="reg">{info?.matricula ?? avion.hex.toUpperCase()}</span>
        </div>

        <div className="card-ruta">
          {ruta ? (
            <>
              <b title={info.origen.airport}>{info.origen.iata || info.origen.icao}</b>
              <span className="flecha">→</span>
              <b title={info.destino.airport}>{info.destino.iata || info.destino.icao}</b>
            </>
          ) : (
            <span className="tenue">{info ? "Ruta desconocida" : "Buscando ruta…"}</span>
          )}
        </div>

        <div className="card-sub" title={info?.propietario ?? ""}>
          {[info?.tipoIcao, info?.propietario].filter(Boolean).join(" · ") || " "}
        </div>

        <div className="card-stats">
          <span title="Altitud">
            <i className="dot" /> {fmt.alt(avion)}
          </span>
          <span title="Velocidad">{fmt.vel(avion.gs)}</span>
          <span title="Velocidad vertical" className={avion.vrate > 256 ? "sube" : avion.vrate < -256 ? "baja" : ""}>
            {avion.vrate > 256 ? "▲" : avion.vrate < -256 ? "▼" : "▬"}
          </span>
          <span title="Distancia aproximada al centro del radar">
            {avion.dist != null ? fmt.kmAprox(avion.dist) : avion.lat == null ? "sin pos." : ""}
          </span>
          {avion.squawk && <span className={`sq${emergencia ? " rojo" : ""}`}>{avion.squawk}</span>}
        </div>
      </div>
    </button>
  );
}
