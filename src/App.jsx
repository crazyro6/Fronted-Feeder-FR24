import { useState, useEffect } from "react";
import AvionCard from "./AvionCard";

function App() {
  const [aviones, setAviones] = useState([]);

  useEffect(() => {
    const obtenerDatosRadar = async () => {
      try {
        // Gracias al proxy, esta petición va directo a tu Raspberry sin error de CORS
        const respuesta = await fetch("/dump1090/data/aircraft.json");
        const datos = await respuesta.json();

        // Filtramos para mostrar solo los aviones que ya han transmitido su Hex y su número de Vuelo
        const avionesValidos = datos.aircraft.filter(
          (avion) => avion.hex && avion.flight && avion.flight.trim() !== "",
        );

        setAviones(avionesValidos);
      } catch (error) {
        console.error("Error leyendo el radar:", error);
      }
    };

    // Llamamos a la antena nada más abrir la web
    obtenerDatosRadar();

    // Configuramos un bucle para que pida datos cada 2 segundos (2000 ms)
    const intervalo = setInterval(obtenerDatosRadar, 2000);

    // Limpieza de seguridad
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div style={{ padding: "20px", minHeight: "100vh" }}>
      {/* HEADER FLEX: Alinea título y contador horizontalmente y arregla el superpuesto */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          borderBottom: "1px solid #333",
          paddingBottom: "15px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Mi Radar FR24 Custom ✈️</h1>
        <span
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            padding: "5px 15px",
            borderRadius: "20px",
            fontSize: "1rem",
            fontWeight: "bold",
          }}
        >
          {aviones.length} aviones detectados
        </span>
      </header>

      {/* CONTENEDOR GRID O FLEX: Esto hará que las tarjetas ocupen el ancho de la página */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", // Grid automático y responsive
          gap: "20px",
        }}
      >
        {aviones.length > 0 ? (
          aviones.map((avion) => (
            <AvionCard
              key={avion.hex}
              hex={avion.hex}
              vuelo={avion.flight ? avion.flight.trim() : "Desconocido"}
              // AQUÍ ESTÁ LA MAGIA: Le pasamos la primera altitud que encuentre,
              // y si todas están vacías, le pasamos "Desconocida"
              altitud={
                avion.alt_baro ||
                avion.alt_geom ||
                avion.altitude ||
                "Desconocida"
              }
            />
          ))
        ) : (
          <p
            style={{
              fontSize: "1.2rem",
              color: "#999",
              textAlign: "center",
              gridColumn: "1 / -1",
            }}
          >
            Escaneando el cielo... 📡
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
