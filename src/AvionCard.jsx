import { useState, useEffect } from 'react';

export default function AvionCard({ hex, vuelo, altitud }) {
  const [foto, setFoto] = useState(null);
  // 1. Añadimos "aerolinea" a nuestro objeto de estado
  const [datosAvion, setDatosAvion] = useState({ 
    matricula: "N/A", 
    modelo: "N/A", 
    ruta: "Buscando...", 
    aerolinea: "Cargando..." 
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const buscarDatosAPI = async () => {
      try {
        let infoMatricula = "N/A";
        let infoModelo = "N/A";
        let infoRuta = "Ruta no disponible";
        let infoAerolinea = "Desconocida"; // Variable para la aerolínea

        // 1. Buscamos en HexDB (AQUÍ SACAMOS LA AEROLÍNEA)
        const resAvion = await fetch(`https://hexdb.io/api/v1/aircraft/${hex.toUpperCase()}`);
        if (resAvion.ok) {
          const info = await resAvion.json();
          infoMatricula = info.Registration || "N/A";
          infoModelo = info.ICAOTypeCode || info.Type || "N/A";
          // Usamos RegisteredOwners, y si está vacío, probamos con el código de operador
          infoAerolinea = info.RegisteredOwners || info.OperatorFlagCode || "Desconocida"; 
        }

        // 2. Buscamos la Ruta
        if (vuelo && vuelo !== "Desconocido") {
          const resRuta = await fetch(`https://hexdb.io/api/v1/route/icao/${vuelo}`);
          if (resRuta.ok) {
            const infoRt = await resRuta.json();
            if (infoRt.route) {
              infoRuta = infoRt.route.replace("-", " ➔ ");
            }
          }
        }

        // 3. Actualizamos el estado con la aerolínea incluida
        setDatosAvion({
          matricula: infoMatricula,
          modelo: infoModelo,
          ruta: infoRuta,
          aerolinea: infoAerolinea
        });

        // 4. Buscamos la foto
        const resFoto = await fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`);
        if (resFoto.ok) {
          const infoFoto = await resFoto.json();
          if (infoFoto.photos && infoFoto.photos.length > 0) {
            setFoto(infoFoto.photos[0].thumbnail_large.src);
          }
        }
      } catch (error) {
        console.error("Error al cargar datos de las APIs:", error);
      } finally {
        setCargando(false);
      }
    };

    if (hex) buscarDatosAPI();
  }, [hex, vuelo]);

  return (
    <div style={{ border: '1px solid #333', padding: '15px', borderRadius: '10px', backgroundColor: '#222', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* Cabecera con el Vuelo y la Matrícula */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <h3 style={{ margin: 0, color: '#61dafb' }}>{vuelo}</h3>
        <span style={{ backgroundColor: '#444', padding: '3px 8px', borderRadius: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
          {datosAvion.matricula}
        </span>
      </div>

      {/* RUTA */}
      <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #444' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
          {datosAvion.ruta}
        </span>
      </div>

      {/* INFORMACIÓN DEL AVIÓN */}
      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#aaa' }}>
        <strong>Aerolínea:</strong> <span style={{ color: '#eee' }}>{datosAvion.aerolinea}</span>
      </p>
      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#aaa' }}>
        <strong>Modelo:</strong> {datosAvion.modelo}
      </p>
      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#aaa' }}>
        <strong>HEX:</strong> {hex}
      </p>
      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#aaa' }}>
        <strong>Altitud:</strong> {altitud} pies
      </p>
      
      {/* Zona de la imagen */}
      <div style={{ marginTop: '15px', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', borderRadius: '5px', overflow: 'hidden' }}>
        {cargando ? (
          <p style={{ color: '#666' }}>Cargando datos...</p>
        ) : foto ? (
          <img src={foto} alt={`Avión ${hex}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <p style={{ color: '#666' }}>Sin foto</p>
        )}
      </div>
    </div>
  );
}