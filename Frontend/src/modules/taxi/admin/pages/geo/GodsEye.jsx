import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMap, MarkerF, InfoWindow } from '@react-google-maps/api';
import { 
  ChevronRight, 
  Map as MapIcon, 
  RefreshCw, 
  Filter,
  ArrowLeft,
  Activity,
  User,
  Car,
  Clock,
  Navigation,
  Search,
  MousePointer2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppGoogleMapsLoader, HAS_VALID_GOOGLE_MAPS_KEY } from '../../utils/googleMaps';
import { adminService } from '../../services/adminService';
import CarIcon from '@/assets/icons/car.png';
import BikeIcon from '@/assets/icons/bike.png';
import AutoIcon from '@/assets/icons/auto.png';

const INDIA_CENTER = { lat: 22.7196, lng: 75.8577 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '400px' };

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f9fafb' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e5e7eb' }] }
  ]
};

const getMapIconForVehicle = (iconType = '') => {
  const value = String(iconType || '').trim().toLowerCase();

  if (value.includes('bike')) return BikeIcon;
  if (value.includes('auto')) return AutoIcon;
  return CarIcon;
};

const hasUsableCoordinates = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
};

const GodsEye = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverMode, setDriverMode] = useState('all');
  const [vehicleType, setVehicleType] = useState('all');
  const [refreshMethod, setRefreshMethod] = useState('automatic');
  const [selectedMarker, setSelectedMarker] = useState(null);

  const { isLoaded, loadError } = useAppGoogleMapsLoader();

  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors appearance-none cursor-pointer";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-widest";

  const fetchMapData = async () => {
    setLoading(true);
    try {
      const [zonesResponse, driversResponse] = await Promise.all([
        adminService.getZones(),
        adminService.getDrivers(1, 500, {}),
      ]);

      const zoneResults = zonesResponse?.data?.results || zonesResponse?.data || [];
      const driverResults = driversResponse?.data?.results || driversResponse?.data || [];

      setZones(Array.isArray(zoneResults) ? zoneResults : []);
      setDrivers(Array.isArray(driverResults) ? driverResults : []);
    } catch (error) {
      console.error('Failed to fetch Gods Eye data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    if (refreshMethod === 'automatic') {
      const interval = setInterval(fetchMapData, 30000);
      return () => clearInterval(interval);
    }
  }, [refreshMethod]);

  const markers = useMemo(() => {
    return drivers
      .filter((driver) => hasUsableCoordinates(driver.latitude, driver.longitude))
      .filter((driver) => {
        if (driverMode === 'online') return Boolean(driver.isOnline);
        if (driverMode === 'on-ride') return Boolean(driver.isOnRide);
        return true;
      })
      .filter((driver) => {
        if (vehicleType === 'all') return true;
        const normalizedVehicleType = String(
          driver.vehicle_icon_type || driver.vehicle_type || driver.transport_type || '',
        ).trim().toLowerCase();
        return normalizedVehicleType.includes(vehicleType);
      })
      .map((driver) => ({
        id: driver._id || driver.id,
        type: 'driver',
        vehicleType: driver.vehicle_icon_type || driver.vehicle_type || driver.transport_type || 'car',
        pos: { lat: Number(driver.latitude), lng: Number(driver.longitude) },
        title: driver.name || driver.phone || 'Driver',
        status: driver.isOnRide ? 'On Ride' : driver.isOnline ? 'Online' : 'Offline',
        phone: driver.phone || '',
        vehicleNumber: driver.vehicle_number || '',
        zoneName: driver.zone_name || '',
        city: driver.service_location_name || driver.city || '',
      }));
  }, [drivers, driverMode, vehicleType]);

  const onlineDriversCount = useMemo(
    () => drivers.filter((driver) => Boolean(driver.isOnline)).length,
    [drivers],
  );

  const activeRideDriversCount = useMemo(
    () => drivers.filter((driver) => Boolean(driver.isOnRide)).length,
    [drivers],
  );

  const mapCenter = useMemo(() => {
    if (markers.length > 0) {
      return markers[0].pos;
    }

    const firstZonePoint = zones[0]?.coordinates?.[0]?.[0];
    if (Array.isArray(firstZonePoint) && firstZonePoint.length >= 2) {
      return { lat: Number(firstZonePoint[1]), lng: Number(firstZonePoint[0]) };
    }

    return INDIA_CENTER;
  }, [markers, zones]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 font-sans">
      
      {/* Header Block */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          <span>Map</span>
          <ChevronRight size={12} />
          <span className="text-gray-700 font-medium">God&apos;s Eye</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">God&apos;s Eye</h1>
          <button 
             onClick={() => navigate('/admin/dashboard')}
             className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Filters Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
           <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    <Filter size={15} />
                 </div>
                 <h3 className="text-sm font-bold text-gray-900">Fleet Filtration</h3>
              </div>
              {loading && <RefreshCw size={14} className="text-indigo-600 animate-spin" />}
           </div>
           
           <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Driver Select */}
                 <div className="space-y-1.5">
                    <label className={labelClass}>Drivers</label>
                    <div className="relative group">
                       <select value={driverMode} onChange={e => setDriverMode(e.target.value)} className={inputClass}>
                          <option value="all">All Modes</option>
                          <option value="online">Online Only</option>
                          <option value="on-ride">On Active Ride</option>
                       </select>
                       <User size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                 </div>

                 {/* Vehicle Select */}
                 <div className="space-y-1.5">
                    <label className={labelClass}>Vehicle Types</label>
                    <div className="relative group">
                       <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputClass}>
                          <option value="all">All Vehicles</option>
                          <option value="car">Cars Only</option>
                          <option value="bike">Bikes Only</option>
                          <option value="auto">Autos Only</option>
                       </select>
                       <Car size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                 </div>

                 {/* Refresh Select */}
                 <div className="space-y-1.5">
                    <label className={labelClass}>Refresh Method</label>
                    <div className="relative group">
                       <select value={refreshMethod} onChange={e => setRefreshMethod(e.target.value)} className={inputClass}>
                          <option value="automatic">Automatic (30s)</option>
                          <option value="manual">Manual Refresh</option>
                       </select>
                       <Clock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                 <button onClick={fetchMapData} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                    Apply Grid
                 </button>
                 <button onClick={() => { setDriverMode('all'); setVehicleType('all'); }} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                    Reset Filter
                 </button>
              </div>
           </div>
        </div>

        {/* Map Canvas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-1.5">
           <div className="rounded-lg overflow-hidden relative">
              {loadError ? (
                 <div className="h-[400px] flex items-center justify-center bg-gray-50 text-xs font-medium text-rose-600">Maps Load Failed</div>
              ) : HAS_VALID_GOOGLE_MAPS_KEY && isLoaded ? (
                 <GoogleMap
                    mapContainerStyle={MAP_CONTAINER_STYLE} center={mapCenter} zoom={12} options={mapOptions}
                 >
                    {markers.map((m) => (
                       <MarkerF 
                          key={m.id} position={m.pos} title={m.title}
                          onClick={() => setSelectedMarker(m)}
                          icon={{
                            url: getMapIconForVehicle(m.vehicleType),
                            scaledSize: new window.google.maps.Size(36, 36),
                            anchor: new window.google.maps.Point(18, 18),
                          }}
                       />
                    ))}

                    {selectedMarker && (
                       <InfoWindow position={selectedMarker.pos} onCloseClick={() => setSelectedMarker(null)}>
                          <div className="p-2.5 bg-white min-w-[180px]">
                             <span className="text-xs font-medium text-gray-500 block mb-0.5">{selectedMarker.type}</span>
                             <p className="text-sm font-bold text-gray-900 mb-1.5">{selectedMarker.title}</p>
                             {selectedMarker.phone && (
                                <p className="text-xs text-gray-600 mb-1">{selectedMarker.phone}</p>
                             )}
                             {selectedMarker.vehicleNumber && (
                                <p className="text-xs text-gray-600 mb-1">Vehicle: {selectedMarker.vehicleNumber}</p>
                             )}
                             {selectedMarker.city && (
                                <p className="text-xs text-gray-600 mb-1">City: {selectedMarker.city}</p>
                             )}
                             {selectedMarker.zoneName && (
                                <p className="text-xs text-gray-600 mb-2">Zone: {selectedMarker.zoneName}</p>
                             )}
                             <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${
                                  selectedMarker.status === 'On Ride'
                                    ? 'bg-amber-500'
                                    : selectedMarker.status === 'Online'
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400'
                                }`} />
                                <span className="text-xs font-medium text-gray-700">{selectedMarker.status}</span>
                             </div>
                          </div>
                       </InfoWindow>
                    )}
                 </GoogleMap>
              ) : (
                 <div className="h-[400px] bg-gray-50 flex items-center justify-center">
                    <div className="text-center space-y-3">
                       <MapIcon size={32} className="mx-auto text-gray-300" />
                       <p className="text-xs font-medium text-gray-400">Command Grid Offline</p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Status Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
           <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0"><Activity size={18} /></div>
              <div><span className="block text-xs font-medium text-gray-500 mb-0.5">Fleet Connectivity</span><span className="text-base font-bold text-gray-900">{onlineDriversCount} Online</span></div>
           </div>
           <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0"><Navigation size={18} /></div>
              <div><span className="block text-xs font-medium text-gray-500 mb-0.5">Active Pockets</span><span className="text-base font-bold text-gray-900">{zones.length} Localities</span></div>
           </div>
           <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0"><MousePointer2 size={18} /></div>
              <div><span className="block text-xs font-medium text-gray-500 mb-0.5">Incoming Feed</span><span className="text-base font-bold text-amber-600">{activeRideDriversCount} On Ride</span></div>
           </div>
           <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5 border-l-4 border-l-indigo-600">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 shadow-sm"><Search size={18} /></div>
              <div><span className="block text-xs font-medium text-gray-500 mb-0.5">Precision</span><span className="text-base font-bold text-gray-900">{markers.length} Visible</span></div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default GodsEye;
