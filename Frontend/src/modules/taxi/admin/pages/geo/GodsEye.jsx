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
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 font-sans animate-in fade-in duration-500">
      
      {/* Header Block */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Map</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">God's Eye</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">God's Eye</h1>
          <button 
             onClick={() => navigate('/admin/dashboard')}
             className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Filters Section (Card Pattern) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-700">
           <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Filter size={18} />
                 </div>
                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.1em]">Fleet Filtration</h3>
              </div>
              {loading && <RefreshCw size={16} className="text-indigo-400 animate-spin" />}
           </div>
           
           <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {/* Driver Select */}
                 <div className="space-y-2">
                    <label className={labelClass}>Drivers</label>
                    <div className="relative group">
                       <select value={driverMode} onChange={e => setDriverMode(e.target.value)} className={inputClass}>
                          <option value="all">All Modes</option>
                          <option value="online">Online Only</option>
                          <option value="on-ride">On Active Ride</option>
                       </select>
                       <User size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                    </div>
                 </div>

                 {/* Vehicle Select */}
                 <div className="space-y-2">
                    <label className={labelClass}>Vehicle Types</label>
                    <div className="relative group">
                       <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputClass}>
                          <option value="all">All Vehicles</option>
                          <option value="car">Cars Only</option>
                          <option value="bike">Bikes Only</option>
                          <option value="auto">Autos Only</option>
                       </select>
                       <Car size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                    </div>
                 </div>

                 {/* Refresh Select */}
                 <div className="space-y-2">
                    <label className={labelClass}>Refresh Method *</label>
                    <div className="relative group">
                       <select value={refreshMethod} onChange={e => setRefreshMethod(e.target.value)} className={inputClass}>
                          <option value="automatic">Automatic (30s)</option>
                          <option value="manual">Manual Refresh</option>
                       </select>
                       <Clock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 mt-8 pt-8 border-t border-gray-50">
                 <button onClick={fetchMapData} className="px-8 py-3 bg-[#00BFA5] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#00BFA5]/20 hover:scale-[1.02] transition-all">
                    Apply Grid
                 </button>
                 <button onClick={() => { setDriverMode('all'); setVehicleType('all'); }} className="px-8 py-3 bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:scale-[1.02] transition-all">
                    Reset Deck
                 </button>
              </div>
           </div>
        </div>

        {/* Map Canvas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-2">
           <div className="rounded-lg overflow-hidden relative">
              {loadError ? (
                 <div className="h-[400px] flex items-center justify-center bg-gray-50 uppercase font-semibold text-rose-500">Maps Load Failed</div>
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
                          <div className="p-3 bg-white min-w-[200px]">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{selectedMarker.type}</p>
                             <p className="text-sm font-black text-gray-900 mb-2">{selectedMarker.title}</p>
                             {selectedMarker.phone && (
                                <p className="text-[11px] font-semibold text-slate-500 mb-1">{selectedMarker.phone}</p>
                             )}
                             {selectedMarker.vehicleNumber && (
                                <p className="text-[11px] font-semibold text-slate-500 mb-1">Vehicle: {selectedMarker.vehicleNumber}</p>
                             )}
                             {selectedMarker.city && (
                                <p className="text-[11px] font-semibold text-slate-500 mb-1">City: {selectedMarker.city}</p>
                             )}
                             {selectedMarker.zoneName && (
                                <p className="text-[11px] font-semibold text-slate-500 mb-2">Zone: {selectedMarker.zoneName}</p>
                             )}
                             <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  selectedMarker.status === 'On Ride'
                                    ? 'bg-amber-500'
                                    : selectedMarker.status === 'Online'
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400'
                                }`} />
                                <span className="text-[11px] font-bold text-gray-600">{selectedMarker.status}</span>
                             </div>
                          </div>
                       </InfoWindow>
                    )}
                 </GoogleMap>
              ) : (
                 <div className="h-[400px] bg-slate-100 flex items-center justify-center">
                    <div className="text-center space-y-4">
                       <MapIcon size={40} className="mx-auto text-gray-300" />
                       <p className="text-xs font-black text-gray-300 uppercase tracking-[0.3em]">Command Grid Offline</p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Status Deck */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-12">
           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm"><Activity size={22} /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Fleet Connectivity</p><p className="text-xl font-black text-gray-900 tracking-tight leading-none">{onlineDriversCount} Online</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm"><Navigation size={22} /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Active Pockets</p><p className="text-xl font-black text-gray-900 tracking-tight leading-none">{zones.length} Localities</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm"><MousePointer2 size={22} /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Incoming Feed</p><p className="text-xl font-black text-amber-600 tracking-tight leading-none">{activeRideDriversCount} On Ride</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 border-l-4 border-l-indigo-500">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100"><Search size={22} /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Precision</p><p className="text-xl font-black text-gray-900 tracking-tight leading-none">{markers.length} Visible</p></div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default GodsEye;
