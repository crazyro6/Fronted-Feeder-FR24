import { useState, useEffect } from "react";

export default function AvionCard({ hex, vuelo, altitud }) {
  const [foto, setFoto] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Función para buscar la foto en Planespotters
    const buscarFoto = async () => {
      try {
        const respuesta = await fetch(
          `https://api.planespotters.net/pub/photos/hex/${hex}`,
        );
        const datos = await respuesta.json();

        if (datos.photos && datos.photos.length > 0) {
          setFoto(datos.photos[0].thumbnail_large.src);
        }
      } catch (error) {
        console.error("Error al cargar la foto:", error);
      } finally {
        setCargando(false); // Terminamos de cargar, haya error o no
      }
    };

    if (hex) buscarFoto();
  }, [hex]);

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "15px",
        borderRadius: "10px",
        width: "300px",
        backgroundColor: "#222",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0" }}>Vuelo: {vuelo || "N/A"}</h3>
      <p style={{ margin: "5px 0" }}>
        <strong>HEX:</strong> {hex}
      </p>
      <p style={{ margin: "5px 0" }}>
        <strong>Altitud:</strong> {altitud} pies
      </p>
      {/* Zona de la imagen */}
      <div
        style={{
          marginTop: "15px",
          minHeight: "150px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#333",
          borderRadius: "5px",
        }}
      >
        {cargando ? (
          <p>Buscando foto...</p>
        ) : foto ? (
          <img
            src={foto}
            alt={`Avión ${hex}`}
            style={{ width: "100%", borderRadius: "5px" }}
          />
        ) : (
          <p>Sin foto disponible</p>
        )}
      </div>
    </div>
  );
}
