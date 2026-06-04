import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
} from "@react-google-maps/api";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  MapPin,
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Save,
  X,
  Compass,
  Map,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { zoneApi } from "../services/adminApi";

const libraries = ["places", "drawing", "geometry"];
const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 20.5937, // India center
  lng: 78.9629,
};

const ZoneManagement = () => {
  const { showToast } = useToast();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    country: "India",
    unit: "kilometer",
    isActive: true,
  });
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Map refs
  const mapRef = useRef(null);
  const [modalMap, setModalMap] = useState(null);
  const drawingManagerRef = useRef(null);
  const polygonRef = useRef(null);
  const markersRef = useRef([]);
  const listMapRef = useRef(null);
  const listPolygonsRef = useRef([]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const response = await zoneApi.getZones({ limit: 1000 });
      if (response.data?.success && response.data.data?.zones) {
        setZones(response.data.data.zones);
      }
    } catch (error) {
      showToast("Failed to fetch zones", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (zone) => {
    try {
      const updatedStatus = !zone.isActive;
      await zoneApi.updateZone(zone._id || zone.id, { isActive: updatedStatus });
      showToast(`Zone ${updatedStatus ? "activated" : "deactivated"} successfully`, "success");
      fetchZones();
    } catch (error) {
      showToast("Failed to update status", "error");
    }
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm("Are you sure you want to delete this zone? This action is irreversible.")) {
      return;
    }
    try {
      await zoneApi.deleteZone(id);
      showToast("Zone deleted successfully", "warning");
      fetchZones();
    } catch (error) {
      showToast("Failed to delete zone", "error");
    }
  };

  const handleOpenAddModal = () => {
    setSelectedZone(null);
    setFormData({
      name: "",
      country: "India",
      unit: "kilometer",
      isActive: true,
    });
    setCoordinates([]);
    setIsDrawingMode(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (zone) => {
    setSelectedZone(zone);
    setFormData({
      name: zone.name || "",
      country: zone.country || "India",
      unit: zone.unit || "kilometer",
      isActive: zone.isActive !== false,
    });
    setCoordinates(zone.coordinates || []);
    setIsDrawingMode(false);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (zone) => {
    setSelectedZone(zone);
    setIsViewModalOpen(true);
  };

  const clearDrawing = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    setCoordinates([]);
  };

  // List Map initialization: Render all zones
  const onListMapLoad = useCallback((map) => {
    listMapRef.current = map;
  }, []);

  useEffect(() => {
    if (!isLoaded || !listMapRef.current || zones.length === 0) return;

    // Clear previous polygons
    listPolygonsRef.current.forEach(p => p.setMap(null));
    listPolygonsRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    zones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return;

      const path = zone.coordinates.map(c => ({
        lat: Number(c.latitude),
        lng: Number(c.longitude)
      }));

      path.forEach(pt => bounds.extend(pt));
      hasPoints = true;

      const polygon = new window.google.maps.Polygon({
        paths: path,
        strokeColor: zone.isActive ? "#f43f5e" : "#94a3b8", // Rose for active, Slate for inactive
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: zone.isActive ? "#f43f5e" : "#94a3b8",
        fillOpacity: 0.2,
        map: listMapRef.current,
      });

      listPolygonsRef.current.push(polygon);

      // Info window setup
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div class="p-2 text-left">
          <strong class="text-slate-900">${zone.name}</strong><br/>
          <span class="text-xs text-slate-500">Unit: ${zone.unit} | Status: ${zone.isActive ? "Active" : "Inactive"}</span>
        </div>`
      });

      polygon.addListener("click", (event) => {
        infoWindow.setPosition(event.latLng);
        infoWindow.open(listMapRef.current);
      });
    });

    if (hasPoints) {
      listMapRef.current.fitBounds(bounds);
    }
  }, [isLoaded, zones]);

  // Modal Map initialization for drawing/editing
  const onModalMapLoad = useCallback((map) => {
    mapRef.current = map;
    setModalMap(map);
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      setModalMap(null);
      mapRef.current = null;
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isLoaded || !modalMap || !isModalOpen) return;

    // Clean previous objects
    clearDrawing();

    const google = window.google;

    // Setup Drawing Manager
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON]
      },
      polygonOptions: {
        fillColor: "#f43f5e",
        fillOpacity: 0.35,
        strokeWeight: 2,
        strokeColor: "#f43f5e",
        clickable: false,
        editable: true,
        zIndex: 1
      }
    });

    drawingManager.setMap(modalMap);
    drawingManagerRef.current = drawingManager;

    // Event listener: Overlay complete
    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        const polygon = event.overlay;
        if (polygonRef.current) polygonRef.current.setMap(null);

        polygonRef.current = polygon;
        drawingManager.setDrawingMode(null);
        setIsDrawingMode(false);

        // Extract path coordinates
        updateCoordinatesFromPath(polygon.getPath());

        // Listen for path changes
        const path = polygon.getPath();
        google.maps.event.addListener(path, 'set_at', () => updateCoordinatesFromPath(path));
        google.maps.event.addListener(path, 'insert_at', () => updateCoordinatesFromPath(path));
        google.maps.event.addListener(path, 'remove_at', () => updateCoordinatesFromPath(path));
      }
    });

    // If edit mode with coordinates, draw the existing polygon
    if (selectedZone && coordinates.length >= 3) {
      const path = coordinates.map(c => new google.maps.LatLng(Number(c.latitude), Number(c.longitude)));
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#f43f5e",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: "#f43f5e",
        fillOpacity: 0.35,
        editable: true,
        map: modalMap
      });

      polygonRef.current = polygon;
      drawingManager.setDrawingMode(null);

      // Listen for path changes
      const p = polygon.getPath();
      google.maps.event.addListener(p, 'set_at', () => updateCoordinatesFromPath(p));
      google.maps.event.addListener(p, 'insert_at', () => updateCoordinatesFromPath(p));
      google.maps.event.addListener(p, 'remove_at', () => updateCoordinatesFromPath(p));

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      path.forEach(pt => bounds.extend(pt));
      modalMap.fitBounds(bounds);
    } else {
      modalMap.setCenter(defaultCenter);
      modalMap.setZoom(5);
    }
  }, [isLoaded, isModalOpen, modalMap]);

  const updateCoordinatesFromPath = (path) => {
    const coords = [];
    for (let i = 0; i < path.getLength(); i++) {
      const latLng = path.getAt(i);
      coords.push({
        latitude: parseFloat(latLng.lat().toFixed(6)),
        longitude: parseFloat(latLng.lng().toFixed(6))
      });
    }
    setCoordinates(coords);
  };

  const handleSaveZone = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast("Zone Name is required", "error");
      return;
    }

    if (coordinates.length < 3) {
      showToast("Please draw a polygon with at least 3 points on the map", "error");
      return;
    }

    try {
      const zonePayload = {
        ...formData,
        coordinates
      };

      if (selectedZone) {
        await zoneApi.updateZone(selectedZone._id || selectedZone.id, zonePayload);
        showToast("Zone updated successfully", "success");
      } else {
        await zoneApi.createZone(zonePayload);
        showToast("Zone created successfully", "success");
      }

      setIsModalOpen(false);
      fetchZones();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to save zone", "error");
    }
  };

  const filteredZones = zones.filter(zone =>
    zone.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="ds-h1 flex items-center gap-3 text-2xl font-bold text-slate-900">
            Zone Management
            <div className="p-2 bg-rose-100 rounded-xl">
              <MapPin className="h-5 w-5 text-rose-600" />
            </div>
          </h1>
          <p className="ds-description mt-1 text-sm text-slate-600">
            Configure delivery coverage areas and service polygon zones.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg active:scale-95 shadow-rose-200"
        >
          <Plus className="h-4 w-4" />
          ADD SERVICE ZONE
        </button>
      </div>

      {/* Grid: Map and List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Visualization */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Map className="h-4 w-4 text-rose-500" /> Coverage Map Visualizer
            </h3>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={5}
                onLoad={onListMapLoad}
                options={{
                  streetViewControl: false,
                  mapTypeControl: true,
                  fullscreenControl: true,
                }}
              />
            ) : (
              <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400">Loading coverage map...</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Panel: Zones list */}
        <div className="space-y-4">
          {/* Search bar */}
          <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100/50 bg-white/80 backdrop-blur-xl rounded-xl flex items-center">
            <div className="flex-1 relative group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
              <input
                type="text"
                placeholder="Search zones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500/10 transition-all"
              />
            </div>
          </Card>

          {/* List */}
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading service zones...</div>
            ) : filteredZones.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No zones mapped.</div>
            ) : (
              filteredZones.map((zone) => (
                <Card
                  key={zone._id || zone.id}
                  className="p-4 bg-white border-none shadow-sm ring-1 ring-slate-100 hover:ring-rose-200 transition-all rounded-xl text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{zone.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={zone.isActive ? "success" : "secondary"} className="text-[8px] font-black uppercase">
                          {zone.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-semibold">{zone.coordinates?.length || 0} vertices</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(zone)}
                        className={`p-1.5 rounded-lg transition-colors ${zone.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-50"}`}
                        title={zone.isActive ? "Deactivate Zone" : "Activate Zone"}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(zone)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Edit Zone"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone._id || zone.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Zone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drawing / Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedZone ? `Edit Zone: ${selectedZone.name}` : "Create New Zone"}
        size="xl"
      >
        <form onSubmit={handleSaveZone} className="space-y-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Zone Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. South Delhi, Bandra West"
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/10 transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Country</label>
                <input
                  type="text"
                  readOnly
                  value={formData.country}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-bold outline-none text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Service Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/10 transition-all cursor-pointer"
                >
                  <option value="kilometer">Kilometers (km)</option>
                  <option value="miles">Miles (mi)</option>
                </select>
              </div>
              <div className="pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Vertices Selected</span>
                <div className="p-3 bg-rose-50 rounded-xl flex items-center justify-between border border-rose-100">
                  <span className="text-xs text-rose-800 font-bold">{coordinates.length} Points</span>
                  {coordinates.length > 0 && (
                    <button
                      type="button"
                      onClick={clearDrawing}
                      className="text-[9px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-wider"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Map Canvas */}
            <div className="md:col-span-2 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Draw Polygon Boundary *
              </label>
              {isLoaded ? (
                <div className="relative rounded-2xl overflow-hidden shadow-inner border border-slate-100">
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "500px" }}
                    center={defaultCenter}
                    zoom={5}
                    onLoad={onModalMapLoad}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
                    }}
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-100 text-[10px] text-slate-600 font-semibold flex items-center gap-2">
                    <Compass className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>Click the polygon icon at the top center, then click on the map to place vertices. Complete the loop to define the zone.</span>
                  </div>
                </div>
              ) : (
                <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs">Loading map canvas...</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" /> Save Zone
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ZoneManagement;
