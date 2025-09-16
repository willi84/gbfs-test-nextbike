import { useEffect, useMemo, useState } from "react";

// Erweiterte Version: zeigt die untersuchten Nextbike-Standorte inkl. Adresse in der Liste.

const FALLBACK_STATION_INFO = "/api/nextbike/station_information";
const FALLBACK_STATION_STATUS = "/api/nextbike/station_status";

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function kmToStr(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

interface StationInfo {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
}

interface StationStatus {
  station_id: string;
  num_bikes_available: number;
  num_docks_available?: number;
  is_installed?: number;
  is_renting?: number;
  is_returning?: number;
}

interface MergedStation extends StationInfo, StationStatus {
  distanceKm: number;
}

export default function NextbikeNearMe() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stationInfo, setStationInfo] = useState<StationInfo[] | null>(null);
  const [stationStatus, setStationStatus] = useState<StationStatus[] | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState(5);

  useEffect(() => {
    setLoadingGeo(true);
    if (!navigator.geolocation) {
      setError("Geolocation wird nicht unterstützt.");
      setLoadingGeo(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoadingGeo(false);
      },
      () => {
        setError("Standortabfrage abgelehnt oder fehlgeschlagen.");
        setLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadGbfs() {
      try {
        const [infoRes, statusRes] = await Promise.all([
          fetch(FALLBACK_STATION_INFO),
          fetch(FALLBACK_STATION_STATUS),
        ]);
        const infoJson = await infoRes.json();
        const statusJson = await statusRes.json();
        if (cancelled) return;

        const info: StationInfo[] =
          infoJson?.data?.stations?.map((s: any) => ({
            station_id: String(s.station_id),
            name: s.name,
            lat: s.lat,
            lon: s.lon,
            address: s.address,
          })) || [];

        const status: StationStatus[] =
          statusJson?.data?.stations?.map((s: any) => ({
            station_id: String(s.station_id),
            num_bikes_available: s.num_bikes_available ?? 0,
            num_docks_available: s.num_docks_available,
            is_installed: s.is_installed,
            is_renting: s.is_renting,
            is_returning: s.is_returning,
          })) || [];

        setStationInfo(info);
        setStationStatus(status);
      } catch {
        setError("Fehler beim Laden der GBFS-Daten (Proxy).");
      }
    }
    loadGbfs();
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = useMemo<MergedStation[]>(() => {
    if (!stationInfo || !stationStatus) return [];
    const statusById = new Map(stationStatus.map((s) => [s.station_id, s]));
    return stationInfo
      .map((si) => {
        const st = statusById.get(si.station_id);
        const base: MergedStation = {
          ...si,
          num_bikes_available: st?.num_bikes_available ?? 0,
          num_docks_available: st?.num_docks_available,
          is_installed: st?.is_installed,
          is_renting: st?.is_renting,
          is_returning: st?.is_returning,
          distanceKm: coords ? haversineKm(coords, { lat: si.lat, lon: si.lon }) : Number.POSITIVE_INFINITY,
        };
        return base;
      })
      .filter((s) => (coords ? s.distanceKm <= maxDistanceKm : true))
      .sort((a, b) => a.distanceKm - b.distanceKm || b.num_bikes_available - a.num_bikes_available);
  }, [stationInfo, stationStatus, coords, maxDistanceKm]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Nextbike – freie Räder in deiner Nähe</h1>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-2">Standort</h2>
            {coords ? (
              <p className="text-sm">lat {coords.lat.toFixed(5)}, lon {coords.lon.toFixed(5)}</p>
            ) : (
              <p className="text-sm">Noch kein Standort gesetzt.</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
                onClick={() => {
                  setLoadingGeo(true);
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => {
                      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                      setLoadingGeo(false);
                    },
                    () => {
                      setError("Standortabfrage fehlgeschlagen.");
                      setLoadingGeo(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                disabled={loadingGeo}
              >
                {loadingGeo ? "Ermittle…" : "Standort verwenden"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-2">Filter</h2>
            <label className="text-sm flex items-center gap-2">
              <span>Max. Distanz</span>
              <input
                className="border rounded-xl px-2 py-1 w-24"
                type="number"
                step={0.5}
                min={0.5}
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(Math.max(0.5, Number(e.target.value)))}
              />
              <span>km</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-800 rounded-2xl p-4 mb-4">
            <p className="font-semibold">Fehler</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <section className="bg-white rounded-2xl shadow divide-y">
          <div className="p-4 flex items-center justify-between">
            <h2 className="font-semibold">Stationen in der Nähe</h2>
            <span className="text-sm text-gray-600">{merged.length} Treffer</span>
          </div>
          {merged.length === 0 && (
            <div className="p-4 text-sm text-gray-600">Keine Stationen gefunden. Prüfe Standort oder erhöhe die Distanz.</div>
          )}
          {merged.map((s) => (
            <div key={s.station_id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                {s.address && <div className="text-sm text-gray-700">{s.address}</div>}
                <div className="text-sm text-gray-600">{coords ? kmToStr(s.distanceKm) : "Distanz unbekannt"}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{s.num_bikes_available}</div>
                <div className="text-xs text-gray-600">freie Räder</div>
              </div>
            </div>
          ))}
        </section>

        <footer className="text-xs text-gray-500 mt-6">Hinweis: Datenquelle GBFS (Nextbike by TIER) via Proxy. Beispiel-App.</footer>
      </div>
    </div>
  );
}
