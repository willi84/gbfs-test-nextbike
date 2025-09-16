// api/nextbike/[file].js
export default async function handler(req, res) {
    // Allow CORS (adjust origin if you want to restrict)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
  
    const { file } = req.query; // expected: "station_information" | "station_status"
    const ALLOWED = {
      station_information: 'https://gbfs.nextbike.net/gbfs/2.2/de/station_information.json',
      station_status:      'https://gbfs.nextbike.net/gbfs/2.2/de/station_status.json',
      // wenn du weitere Länder/Feeds brauchst, hier explizit whitelisten
    };
  
    const upstream = ALLOWED[file];
    if (!upstream) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'invalid file param' });
    }
  
    try {
      const r = await fetch(upstream, {
        // Optional: Header setzen, wenn Anbieter strenger prüft
        headers: { 'User-Agent': 'nextbike-proxy/1.0 (+vercel)' },
        // Kein „mode: cors“ nötig, läuft serverseitig
      });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
  
      const data = await r.json();
  
      // Caching + CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  
      return res.status(200).json(data);
    } catch (err) {
      console.error(err);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({ error: 'upstream fetch failed' });
    }
  }
  