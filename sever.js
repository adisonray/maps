const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // for parsing JSON bodies if needed

const indiaBounds = { n: 37.5, s: 6.0, w: 68.0, e: 98.0 };
const inIndia = (lat, lon) => lat >= indiaBounds.s && lat <= indiaBounds.n && lon >= indiaBounds.w && lon <= indiaBounds.e;

const monitoredCities = [
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 }, { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 }, { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 }, { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 }, { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
  { name: 'Srinagar', lat: 34.0837, lon: 74.7973 }, { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 }, { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245 }, { name: 'Kochi', lat: 9.9312, lon: 76.2673 }
];

async function fetchUSGS() {
  try {
    const res = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
    const data = res.data;
    return data.features
      .filter(f => inIndia(f.geometry.coordinates[1], f.geometry.coordinates[0]))
      .map(f => ({
        id: f.id, type: 'earthquake',
        severity: f.properties.mag >= 5.5 ? 'critical' : f.properties.mag >= 4.5 ? 'warning' : 'advisory',
        title: `Mag ${f.properties.mag.toFixed(1)} Earthquake`,
        location: f.properties.place,
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        time: new Date(f.properties.time), source: 'Earthquake Catalog API'
      }));
  } catch (e) { return []; }
}

async function fetchGDACS() {
  try {
    const targetUrl = encodeURIComponent('https://www.gdacs.org/geojson/rss.geojson');
    const res = await axios.get(`https://api.allorigins.win/raw?url=${targetUrl}`);
    const data = res.data;
    return data.features
      .filter(f => inIndia(f.geometry.coordinates[1], f.geometry.coordinates[0]))
      .map(f => {
        const props = f.properties;
        let type = 'alert';
        const evt = (props.eventtype || '').toLowerCase();
        if (evt.includes('eq')) type = 'earthquake';
        else if (evt.includes('tc')) type = 'cyclone';
        else if (evt.includes('fl')) type = 'flood';
        
        let sev = { 'red': 'critical', 'orange': 'warning', 'green': 'advisory' };
        return {
          id: f.id || Math.random().toString(), type: type,
          severity: sev[(props.alertlevel || 'green').toLowerCase()] || 'warning',
          title: props.name || 'GDACS Alert', location: props.description || 'Regional Alert',
          lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
          time: new Date(props.fromdate), source: 'GDACS Global Disasters'
        };
      }).filter(a => a.severity !== 'advisory');
  } catch (e) { return []; }
}

async function fetchEONET() {
  try {
    const res = await axios.get('https://eonet.gsfc.nasa.gov/api/v2.1/events');
    const data = res.data;
    return data.events
      .filter(e => e.geometries.some(g => inIndia(g.coordinates[1], g.coordinates[0])))
      .map(e => {
        const geom = e.geometries[0]; // take first geometry
        return {
          id: e.id, type: 'environmental',
          severity: 'warning', // EONET events are generally warnings
          title: e.title,
          location: e.description || 'Environmental Event',
          lat: geom.coordinates[1], lon: geom.coordinates[0],
          time: new Date(geom.date), source: 'NASA EONET'
        };
      });
  } catch (e) { return []; }
}

async function fetchWeather() {
  const lats = monitoredCities.map(c => c.lat).join(',');
  const lons = monitoredCities.map(c => c.lon).join(',');
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,precipitation,wind_speed_10m,weathercode&timezone=auto`;
    const res = await axios.get(url);
    const data = res.data;
    // Assuming single location for simplicity, but API supports multiple
    // For multiple, data.current is array
    return monitoredCities.map((city, i) => ({
      city: city.name,
      lat: city.lat,
      lon: city.lon,
      temperature: data.current.temperature_2m[i] || data.current.temperature_2m,
      precipitation: data.current.precipitation[i] || data.current.precipitation,
      wind_speed: data.current.wind_speed_10m[i] || data.current.wind_speed_10m,
      weathercode: data.current.weathercode[i] || data.current.weathercode,
      time: new Date(data.current.time)
    }));
  } catch (e) { return []; }
}

const cache = new NodeCache({ stdTTL: 3600 });


const tileUrlTemplate = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

app.get('/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;

  const zoom = parseInt(z);
  const tileX = parseInt(x);
  const tileY = parseInt(y);

  if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY) || zoom < 0 || zoom > 19 || tileX < 0 || tileY < 0) {
    return res.status(400).send('Invalid tile coordinates');
  }

  const cacheKey = `${z}/${x}/${y}`;

  // Check cache
  let tileData = cache.get(cacheKey);
  if (tileData) {
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600'
    });
    return res.send(tileData);
  }

  try {
    
    const url = tileUrlTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    tileData = response.data;

    cache.set(cacheKey, tileData);

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600'
    });
    res.send(tileData);
  } catch (error) {
    console.error('Error fetching tile:', error.message);
    res.status(500).send('Error fetching tile');
  }
});

// API Routes
app.get('/alerts', async (req, res) => {
  const cacheKey = 'alerts';
  let alerts = cache.get(cacheKey);
  if (alerts) {
    return res.json(alerts);
  }

  try {
    const [usgs, gdacs, eonet] = await Promise.all([fetchUSGS(), fetchGDACS(), fetchEONET()]);
    alerts = [...usgs, ...gdacs, ...eonet];
    cache.set(cacheKey, alerts, 600); // cache for 10 minutes
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.get('/weather', async (req, res) => {
  const cacheKey = 'weather';
  let weather = cache.get(cacheKey);
  if (weather) {
    return res.json(weather);
  }

  try {
    weather = await fetchWeather();
    cache.set(cacheKey, weather, 1800); // cache for 30 minutes
    res.json(weather);
  } catch (error) {
    console.error('Error fetching weather:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Tile server running at http://localhost:${port}`);
});