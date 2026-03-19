# Fronted-Feeder-FR24

Un frontend moderno y reactivo para receptores ADS-B (dump1090), diseñado para reemplazar la interfaz clásica con tarjetas de vuelo ricas en datos y fotos en tiempo real. 


## Sobre el proyecto

Este proyecto nace con la idea de mejorar visualmente la experiencia de monitorizar el espacio aéreo desde un receptor propio (Raspberry Pi + RTL-SDR). En lugar de depender de la antigua interfaz de mapa de `dump1090`, este frontend en React consume los datos JSON de la antena en tiempo real y los cruza de forma asíncrona con APIs externas para enriquecer la visualización.

**Características principales:**
* **Datos en vivo:** Consume el archivo `aircraft.json` de dump1090 sin recargar la página.
* **Fotos al instante:** Integración con la API de [Planespotters.net](https://www.planespotters.net/) mediante código HEX.
* **Información detallada:** Cruce de datos con la API de [HexDB](https://hexdb.io/) para obtener matrícula, aerolínea, modelo de avión y ruta de vuelo (Origen ➔ Destino).
* **Responsive Design:** Diseño adaptativo usando CSS Grid.

---

## Stack Tecnológico

* **Frontend Framework:** React (Vite)
* **Estilos:** CSS puro (Layout con Flexbox y CSS Grid)
* **APIs Externas:** Fetch API asíncrona (HexDB, Planespotters)
* **Hardware Origen:** Raspberry Pi + Antena SDR (FlightRadar24 Feeder)
