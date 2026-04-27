# 🛰️ Adison's Weather Watch

A high-performance, **Apple-inspired glassmorphic dashboard** for real-time disaster monitoring across the Indian subcontinent. This application aggregates data from over 10 global and local environmental APIs to provide a unified view of earthquakes, floods, heatwaves, and severe weather.

---

## ✨ Key Features

* **Real-time Data Aggregation:** Orchestrates concurrent fetches from NASA, USGS, GDACS, and Open-Meteo.
* **India-Centric Monitoring:** Hard-coded spatial fencing ensures focus remains on the Indian subcontinent (Lat: 6.0 to 37.5, Lon: 68.0 to 98.0).
* **Dynamic Severity Mapping:** Visual alerts categorized into **Critical**, **Warning**, and **Advisory** levels with pulsing map markers.
* **Auto-Locate:** Seamlessly centers the map on the user's live location within India.

---

## 🛠️ Integrated Data Sources

The "Master Orchestrator" handles data from the following feeds:

| Category | Source API | Details |
| :--- | :--- | :--- |
| **Seismic** | USGS Earthquake Catalog | Real-time global earthquake data (filtered for India). |
| **Global Disaster** | GDACS (via AllOrigins) | Cyclones, Floods, and Earthquakes with color-coded severity. |
| **Weather** | Open-Meteo | Live temperature, wind speed, and precipitation for major Indian metros. |
| **Environmental** | NASA Earthdata (EONET) | Wildfires and large-scale atmospheric events. |
| **Hydrological** | Open-Meteo Flood / Google | Monitoring river discharge and basin levels. |
| **Local Feeds** | SACHET / Ekagni (Simulated) | Integration points for NDMA and Indian forest fire monitoring. |

---

## 🚀 Tech Stack

* **Frontend:** HTML5, JavaScript (ES6+)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Maps:** [Leaflet.js](https://leafletjs.com/) with [CartoDB Dark Matter](https://carto.com/basemaps/) tiles.
* **Icons:** [Lucide Icons](https://lucide.dev/)
* **Typography:** Inter / Apple System San Francisco

---

## 📂 Installation & Usage

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/adisonray/maps.git
    ```
2.  **Open the file:**
    Simply open `index.html` in any modern web browser. No build steps or server environment required.
3.  **Permissions:**
    Grant **Location Access** when prompted to see alerts relative to your current city.

---

## 🏗️ Architecture Highlights

### The 5-Minute Sync
The app uses a `setInterval` loop to refresh all data sources every 300,000 milliseconds, ensuring the dashboard stays current without manual reloads.

### Spatial Fencing
```javascript
const indiaBounds = { n: 37.5, s: 6.0, w: 68.0, e: 98.0 };
const inIndia = (lat, lon) => lat >= indiaBounds.s && lat <= indiaBounds.n ...
```
All incoming API payloads are validated against these coordinates before being pushed to the global alert array.

