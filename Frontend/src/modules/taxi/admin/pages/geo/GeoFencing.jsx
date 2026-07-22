import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Autocomplete, GoogleMap, MarkerF, Polygon } from '@react-google-maps/api';
import { adminService } from '../../services/adminService';
import { HAS_VALID_GOOGLE_MAPS_KEY, useAppGoogleMapsLoader } from '../../utils/googleMaps';

const DEFAULT_CENTER = { lat: 22.7196, lng: 75.8577 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_ZOOM = 12;

const GEO_NAV_ITEMS = [
  { label: 'Heat Map', path: '/admin/geo/heatmap' },
  { label: "God's Eye", path: '/admin/geo/gods-eye' },
  { label: 'Peak Zone', path: '/admin/geo/peak-zone' }
];

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
  streetViewControl: false,
  clickableIcons: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f9fafb' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0e7ff' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] }
  ]
};

const zonePalette = [
  { fill: '#2563EB', stroke: '#1D4ED8', marker: '#2563EB' },
  { fill: '#F97316', stroke: '#EA580C', marker: '#F97316' },
  { fill: '#10B981', stroke: '#059669', marker: '#10B981' },
  { fill: '#E11D48', stroke: '#BE123C', marker: '#E11D48' },
  { fill: '#7C3AED', stroke: '#6D28D9', marker: '#7C3AED' }
];

const toLatLng = (point) => {
  if (Array.isArray(point) && point.length >= 2) {
    return { lat: Number(point[1]), lng: Number(point[0]) };
  }

  if (point && typeof point === 'object') {
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.longitude ?? point.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

const normalizeCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return [];
  }

  if (coordinates.length > 0 && Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
    return coordinates[0].map(toLatLng).filter(Boolean);
  }

  return coordinates.map(toLatLng).filter(Boolean);
};

const getPolygonCenter = (path) => {
  if (!path.length) {
    return DEFAULT_CENTER;
  }

  const total = path.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / path.length,
    lng: total.lng / path.length
  };
};

const formatZone = (zone, index) => {
  const coordinates = normalizeCoordinates(zone.coordinates);
  const center = coordinates.length ? getPolygonCenter(coordinates) : DEFAULT_CENTER;
  const palette = zonePalette[index % zonePalette.length];
  const isActive = zone.status === 1 || zone.status === 'active' || zone.active === true;

  return {
    id: zone._id || zone.id || `zone-${index}`,
    name: zone.name || zone.zone_name || 'Unnamed Zone',
    surge: Number(zone.surge_multiplier || zone.peak_zone_surge_percentage || 1).toFixed(1),
    status: isActive ? 'Active' : 'Inactive',
    type: zone.type || 'Main',
    center,
    coordinates,
    palette
  };
};

const createFleetMarkers = (zones) =>
  zones.slice(0, 12).flatMap((zone, index) => {
    const offsetBase = (index % 4) * 0.006 + 0.004;
    return [
      {
        id: `${zone.id}-driver`,
        label: `Driver near ${zone.name}`,
        position: {
          lat: zone.center.lat + offsetBase,
          lng: zone.center.lng - offsetBase * 0.7
        },
        kind: 'driver'
      },
      {
        id: `${zone.id}-rider`,
        label: `Demand in ${zone.name}`,
        position: {
          lat: zone.center.lat - offsetBase * 0.5,
          lng: zone.center.lng + offsetBase * 0.55
        },
        kind: 'demand'
      }
    ];
  });

const ZoneCard = ({ zone, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(zone)}
    className={`w-full p-3.5 rounded-xl border text-left transition-all ${
      selected
        ? 'border-indigo-200 bg-indigo-50/60 shadow-sm'
        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
    }`}
  >
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: zone.palette.marker }}
        />
        <span className="text-xs font-semibold text-gray-900 truncate">{zone.name}</span>
      </div>
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
        {zone.type}
      </span>
    </div>

    <div className="flex items-center justify-between text-xs">
      <div>
        <span className="text-gray-500 block mb-0.5 font-medium">Surge</span>
        <div className="flex items-center gap-1 font-semibold text-gray-900">
          <TrendingUp size={13} className="text-indigo-600" />
          <span>{zone.surge}x</span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-gray-500 block mb-0.5 font-medium">Status</span>
        <span className={zone.status === 'Active' ? 'text-emerald-600 font-semibold' : 'text-gray-400 font-medium'}>
          {zone.status}
        </span>
      </div>
    </div>
  </button>
);

const GeoFencing = () => {
  const location = useLocation();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  const currentView = useMemo(() => {
    if (location.pathname.includes('/peak-zone')) return 'peak-zone';
    if (location.pathname.includes('/heatmap')) return 'heatmap';
    return 'gods-eye';
  }, [location.pathname]);

  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  const fetchZones = async () => {
    setLoading(true);
    try {
      const response = await adminService.getZones();
      const rawZones = response?.data?.results || response?.data || [];
      const mappedZones = (Array.isArray(rawZones) ? rawZones : []).map(formatZone);
      setZones(mappedZones);
      setSelectedZoneId((current) => current || mappedZones[0]?.id || null);
    } catch (error) {
      console.error('Failed to fetch zones', error);
      setZones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const filteredZones = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return zones;
    }

    return zones.filter((zone) => zone.name.toLowerCase().includes(query));
  }, [searchValue, zones]);

  const selectedZone =
    filteredZones.find((zone) => zone.id === selectedZoneId) ||
    zones.find((zone) => zone.id === selectedZoneId) ||
    filteredZones[0] ||
    zones[0] ||
    null;

  const mapCenter = selectedZone?.center || zones[0]?.center || DEFAULT_CENTER;

  const fleetMarkers = useMemo(() => createFleetMarkers(zones), [zones]);
  const onlineCount = fleetMarkers.filter((marker) => marker.kind === 'driver').length;
  const activeZoneCount = zones.filter((zone) => zone.status === 'Active').length;
  const averageSurge =
    zones.length > 0
      ? (zones.reduce((sum, zone) => sum + Number(zone.surge || 1), 0) / zones.length).toFixed(1)
      : '1.0';

  const fitZoneBounds = (zone) => {
    if (!mapRef || !zone?.coordinates?.length || !window.google?.maps) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    zone.coordinates.forEach((point) => bounds.extend(point));
    mapRef.fitBounds(bounds, 80);
  };

  useEffect(() => {
    if (selectedZone) {
      fitZoneBounds(selectedZone);
    }
  }, [selectedZone, mapRef]);

  const handlePlaceChanged = () => {
    if (!autocomplete || !mapRef) {
      return;
    }

    const place = autocomplete.getPlace();
    if (!place?.geometry?.location) {
      return;
    }

    mapRef.panTo({
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    });
    mapRef.setZoom(14);
  };

  const renderMarkers = currentView === 'gods-eye';
  const polygonOpacity = currentView === 'heatmap' ? 0.18 : 0.28;

  const renderMapCanvas = () => {
    if (loadError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={22} />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Google Maps Failed to Load</h3>
            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
              Check the API key, allowed referrers, and whether the Maps JavaScript API is enabled.
            </p>
          </div>
        </div>
      );
    }

    if (HAS_VALID_GOOGLE_MAPS_KEY && isLoaded) {
      return (
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          options={mapOptions}
          onLoad={setMapRef}
        >
          {zones.map((zone) =>
            zone.coordinates.length ? (
              <Polygon
                key={zone.id}
                paths={zone.coordinates}
                options={{
                  fillColor: zone.palette.fill,
                  fillOpacity: polygonOpacity,
                  strokeColor: zone.palette.stroke,
                  strokeOpacity: zone.id === selectedZone?.id ? 1 : 0.7,
                  strokeWeight: zone.id === selectedZone?.id ? 3 : 2,
                  zIndex: zone.id === selectedZone?.id ? 3 : 2
                }}
                onClick={() => setSelectedZoneId(zone.id)}
              />
            ) : null
          )}

          {zones.map((zone) => (
            <MarkerF
              key={`${zone.id}-label`}
              position={zone.center}
              onClick={() => setSelectedZoneId(zone.id)}
              title={zone.name}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: zone.id === selectedZone?.id ? 9 : 7,
                fillColor: zone.palette.marker,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }}
            />
          ))}

          {renderMarkers &&
            fleetMarkers.map((marker) => (
              <MarkerF
                key={marker.id}
                position={marker.position}
                title={marker.label}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: marker.kind === 'driver' ? 6 : 5,
                  fillColor: marker.kind === 'driver' ? '#10B981' : '#F97316',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }}
              />
            ))}
        </GoogleMap>
      );
    }

    return (
      <div className="h-full w-full bg-gray-50/80 flex items-center justify-center p-8">
        <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <MapIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Google Maps API Ready</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Set a valid `VITE_GOOGLE_MAPS_API_KEY` in frontend environment variables to render the live interactive map.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2.5 text-left">
            <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
              <span className="block text-[11px] font-medium text-gray-500">Zones</span>
              <span className="text-sm font-bold text-gray-900 mt-0.5 block">{zones.length}</span>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
              <span className="block text-[11px] font-medium text-gray-500">Selected</span>
              <span className="text-xs font-bold text-gray-900 truncate mt-0.5 block">{selectedZone?.name || 'None'}</span>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-200">
              <span className="block text-[11px] font-medium text-gray-500">Center</span>
              <span className="text-[11px] font-medium text-gray-700 mt-0.5 block font-mono">
                {mapCenter.lat.toFixed(2)}, {mapCenter.lng.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (currentView === 'gods-eye') {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[300px,minmax(0,1fr),280px] gap-6 min-h-[calc(100vh-120px)] bg-gray-50/50 p-6">
        <aside className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col overflow-hidden">
          <div className="space-y-1 mb-5 border-b border-gray-100 pb-4">
            <span className="text-xs font-medium text-indigo-600">Geo Deck</span>
            <h1 className="text-lg font-bold text-gray-900">God&apos;s Eye</h1>
            <p className="text-xs text-gray-500 leading-relaxed">Live map for zone monitoring and fleet spread.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3.5">
              <span className="block text-xs font-medium text-gray-500 mb-1">Online Fleet</span>
              <div className="flex items-center gap-2">
                <Users size={14} className="text-emerald-600" />
                <span className="text-lg font-bold text-gray-900">{onlineCount}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3.5">
              <span className="block text-xs font-medium text-gray-500 mb-1">Active Zones</span>
              <span className="text-lg font-bold text-gray-900">{activeZoneCount}</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3.5 flex items-center justify-between mb-5">
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-0.5">Avg Surge</span>
              <span className="text-lg font-bold text-indigo-600">{averageSurge}x</span>
            </div>
            <button
              type="button"
              onClick={fetchZones}
              className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center shadow-sm"
              aria-label="Refresh zones"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 flex items-center mb-4">
            <Search size={14} className="text-gray-400 ml-2.5" />
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search zone..."
              className="w-full bg-transparent border-none text-xs px-2.5 py-1.5 focus:ring-0 outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loading ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-xs font-medium text-gray-500">
                Loading zones...
              </div>
            ) : filteredZones.length > 0 ? (
              filteredZones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  selected={zone.id === selectedZoneId}
                  onSelect={(nextZone) => setSelectedZoneId(nextZone.id)}
                />
              ))
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-xs font-medium text-gray-500">No zones available</p>
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm relative min-h-[calc(100vh-120px)] flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between z-10">
            <div>
              <div className="flex items-center gap-2">
                <Crosshair size={15} className="text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-900">City-Wide Zone Intelligence</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitor zone boundaries, fleet distribution, and surge pockets across locations.
              </p>
            </div>

            <div className="w-full sm:w-72">
              {HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                    <input
                      type="text"
                      placeholder="Search city or locality..."
                      className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </Autocomplete>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  Set VITE_GOOGLE_MAPS_API_KEY in .env
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 relative">
            {renderMapCanvas()}

            <div className="absolute left-4 bottom-4 z-20 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fitZoneBounds(selectedZone)}
                className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <LocateFixed size={14} className="text-gray-500" />
                Focus Zone
              </button>
              <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                Fleet + zone overlay
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div>
              <span className="text-xs font-medium text-gray-500">Live Focus</span>
              <h3 className="text-sm font-bold text-gray-900 mt-0.5">{selectedZone?.name || 'No zone selected'}</h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>

          <div className="space-y-3 mb-5">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <span className="block text-xs font-medium text-gray-500 mb-1">Selected Zone</span>
              <span className="text-sm font-bold text-gray-900">{selectedZone?.name || 'None'}</span>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <span className="block text-xs font-medium text-gray-500 mb-1">Current Surge</span>
              <span className="text-sm font-bold text-indigo-600">{selectedZone?.surge || averageSurge}x</span>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <span className="block text-xs font-medium text-gray-500 mb-1">Map Center</span>
              <span className="text-xs font-medium text-gray-700 font-mono">
                {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4 mb-5">
            <div className="flex items-center gap-2 mb-1.5 text-indigo-900 font-semibold text-xs">
              <ShieldAlert size={14} className="text-indigo-600" />
              <span>Ops Note</span>
            </div>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Monitor zone overlap and verify surge pricing updates against live driver coverage.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5">
            {filteredZones.slice(0, 5).map((zone) => (
              <ZoneCard
                key={`focus-${zone.id}`}
                zone={zone}
                selected={zone.id === selectedZoneId}
                onSelect={(nextZone) => setSelectedZoneId(nextZone.id)}
              />
            ))}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 bg-gray-50/50 p-6">
      <div className="w-80 shrink-0 flex flex-col space-y-5 overflow-y-auto pb-6">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-gray-900">Geo Operations</h1>
          <p className="text-gray-500 font-medium text-xs leading-relaxed">
            Live spatial view for zones, demand, and fleet coverage.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm">
          <div className="grid grid-cols-3 gap-1">
            {GEO_NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-2.5 py-2 rounded-lg text-center text-xs font-medium transition-all ${
                    isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
            <span className="block text-xs font-medium text-gray-500 mb-1">Online Fleet</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-lg font-bold text-gray-900">{onlineCount}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
            <span className="block text-xs font-medium text-gray-500 mb-1">Active Zones</span>
            <span className="text-lg font-bold text-gray-900">{activeZoneCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-0.5">Avg Surge</span>
            <span className="text-lg font-bold text-indigo-600">{averageSurge}x</span>
          </div>
          <button
            type="button"
            onClick={fetchZones}
            className="h-8 w-8 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center border border-gray-200"
            aria-label="Refresh zones"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="bg-white p-1.5 rounded-xl border border-gray-200 flex items-center shadow-sm">
          <Search size={14} className="text-gray-400 ml-2.5" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search zone..."
            className="w-full bg-transparent border-none text-xs px-2.5 py-1.5 focus:ring-0 placeholder:text-gray-400 outline-none text-gray-700"
          />
        </div>

        <div className="flex-1 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-gray-500">
              Zone Watchlist ({filteredZones.length})
            </span>
          </div>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-xs font-medium text-gray-500">
              Loading map data...
            </div>
          ) : filteredZones.length > 0 ? (
            filteredZones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                selected={zone.id === selectedZoneId}
                onSelect={(nextZone) => setSelectedZoneId(nextZone.id)}
              />
            ))
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-xs font-medium text-gray-500">No zones match your search</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex flex-col gap-3 md:flex-row md:items-center md:justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {currentView === 'peak-zone' ? <TrendingUp size={18} /> : currentView === 'heatmap' ? <Layers size={18} /> : <Navigation size={18} />}
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500">
                {currentView === 'gods-eye' ? 'God\'s Eye View' : currentView === 'heatmap' ? 'Heat Map View' : 'Peak Zone View'}
              </span>
              <h2 className="text-sm font-bold text-gray-900 mt-0.5">
                {selectedZone?.name || 'Live geo coverage'}
              </h2>
            </div>
          </div>

          <div className="w-full md:w-72">
            {HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
              <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <input
                    type="text"
                    placeholder="Search city or locality..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </Autocomplete>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm">
                Set VITE_GOOGLE_MAPS_API_KEY in .env
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          {renderMapCanvas()}

          <div className="absolute left-4 bottom-4 z-10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fitZoneBounds(selectedZone)}
              className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <LocateFixed size={14} className="text-gray-500" />
              Focus Zone
            </button>
            <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-medium text-gray-700 flex items-center gap-1.5">
              {currentView === 'peak-zone' ? <TrendingUp size={14} className="text-indigo-600" /> : <Layers size={14} className="text-indigo-600" />}
              {currentView === 'gods-eye' ? 'Fleet + zone overlay' : currentView === 'heatmap' ? 'Demand intensity overlay' : 'Peak pricing overlay'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeoFencing;
