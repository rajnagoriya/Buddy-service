import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
  Polygon,
} from "@react-google-maps/api";
import { Search, MapPin, Navigation, Loader2, AlertTriangle } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { sellerApi } from "../../modules/seller/services/sellerApi";

const libraries = ["places", "drawing", "geometry"];
const mapContainerStyle = {
  width: "100%",
  height: "340px",
};

const defaultCenter = {
  lat: 20.5937, // India center
  lng: 78.9629,
};

const ADDRESS_COMPONENT_PRIORITY = {
  locality: [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "locality",
    "administrative_area_level_3",
  ],
  city: [
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ],
  state: ["administrative_area_level_1"],
  pincode: ["postal_code"],
};

const getAddressComponent = (components = [], types = []) => {
  const match = components.find((component) =>
    types.some((type) => component.types?.includes(type)),
  );
  return match?.long_name || "";
};

const extractAddressDetails = (result) => {
  const components = result?.address_components || [];
  const locality =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.locality) || "";
  const city =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.city) || "";
  const state =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.state) || "";
  const pincode =
    getAddressComponent(components, ADDRESS_COMPONENT_PRIORITY.pincode) || "";

  return {
    locality,
    city,
    state,
    pincode,
  };
};

const MapPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation = null,
  initialRadius = 5,
  maxRadius = 20,
  preferCurrentLocationOnOpen = false,
  hideRadiusSlider = false,
  showZones = false,
}) => {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [marker, setMarker] = useState(initialLocation);
  const [radius, setRadius] = useState(initialRadius);
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneError, setZoneError] = useState("");
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const circleRef = useRef(null);

  const zonesRef = useRef([]);
  const showZonesRef = useRef(showZones);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    showZonesRef.current = showZones;
  }, [showZones]);

  useEffect(() => {
    if (isOpen && showZones) {
      fetchZones();
    }
  }, [isOpen, showZones]);

  const fetchZones = async () => {
    try {
      const response = await sellerApi.getPublicZones();
      if (response.data.success) {
        setZones(response.data.data.zones || []);
      }
    } catch (error) {
      console.error("Failed to fetch zones:", error);
    }
  };

  const clearCircleOverlay = useCallback(() => {
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
  }, []);

  const handleMapLoad = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const validateZone = useCallback((pos) => {
    const currentZones = zonesRef.current;
    const currentShowZones = showZonesRef.current;

    console.log("validateZone called with pos:", pos, "zones:", currentZones);
    if (!currentShowZones || !currentZones.length) {
      console.log("validateZone early exit: showZones =", currentShowZones, "zones.length =", currentZones.length);
      return;
    }

    let foundZone = null;
    
    // Manual fallback is actually more reliable than google maps geometrycontainsLocation for literal paths
    const isPointInPolygon = (lat, lng, polygon) => {
      if (!Array.isArray(polygon) || polygon.length < 3) return false;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = Number(polygon[i].longitude);
        const yi = Number(polygon[i].latitude);
        const xj = Number(polygon[j].longitude);
        const yj = Number(polygon[j].latitude);
        const intersect =
          yi > lat !== yj > lat &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    for (const zone of currentZones) {
      const contains = isPointInPolygon(pos.lat, pos.lng, zone.coordinates);
      console.log(`Checking zone ${zone.name || zone.zoneName}: contains = ${contains}`);
      if (contains) {
        foundZone = zone;
        break;
      }
    }

    if (foundZone) {
      console.log("validateZone found matching zone:", foundZone);
      setSelectedZone(foundZone);
      setZoneError("");
    } else {
      console.log("validateZone: No matching zone found for pos:", pos);
      setSelectedZone(null);
      setZoneError("Selected location is outside all operational zones.");
    }
  }, []);

  useEffect(() => {
    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
      if (showZones && zones.length > 0) {
        validateZone(initialLocation);
      }
    }
  }, [initialLocation, showZones, zones.length, validateZone]);

  useEffect(() => {
    if (!isOpen) return;

    setRadius(initialRadius);

    if (preferCurrentLocationOnOpen) {
      getCurrentLocation({ silent: true, fallbackToInitial: true });
      return;
    }

    if (initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
    } else {
      setCenter(defaultCenter);
      setMarker(null);
    }
  }, [isOpen, initialLocation, initialRadius, preferCurrentLocationOnOpen]);

  const onMapClick = useCallback((e) => {
    console.log("onMapClick event:", e);
    if (!e.latLng) {
      console.error("onMapClick: e.latLng is not defined!");
      return;
    }
    clearCircleOverlay();
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    console.log("onMapClick newPos:", newPos);
    setMarker(newPos);
    validateZone(newPos);
  }, [clearCircleOverlay, validateZone]);

  const onMarkerDragEnd = useCallback((e) => {
    clearCircleOverlay();
    const newPos = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };
    setMarker(newPos);
    validateZone(newPos);
  }, [clearCircleOverlay, validateZone]);

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        clearCircleOverlay();
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setCenter(newPos);
        setMarker(newPos);
        setAddress(place.formatted_address || "");
        validateZone(newPos);
      }
    }
  };

  const getCurrentLocation = ({
    silent = false,
    fallbackToInitial = false,
  } = {}) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearCircleOverlay();
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(newPos);
          setMarker(newPos);
          validateZone(newPos);
        },
        () => {
          if (fallbackToInitial && initialLocation) {
            setCenter(initialLocation);
            setMarker(initialLocation);
            return;
          }

          if (!silent) {
            alert("Unable to retrieve your location. Please select manually.");
          }
        },
      );
      return;
    }

    if (fallbackToInitial && initialLocation) {
      setCenter(initialLocation);
      setMarker(initialLocation);
      return;
    }

    if (!silent) {
      alert("Unable to retrieve your location. Please select manually.");
    }
  };

  useEffect(() => {
    return () => {
      clearCircleOverlay();
      mapRef.current = null;
    };
  }, [clearCircleOverlay]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) {
      return;
    }

    clearCircleOverlay();

    if (!marker || hideRadiusSlider) {
      return;
    }

    circleRef.current = new window.google.maps.Circle({
      map: mapRef.current,
      center: marker,
      radius: radius * 1000,
      fillColor: "var(--primary)",
      fillOpacity: 0.1,
      strokeColor: "var(--primary)",
      strokeOpacity: 0.5,
      strokeWeight: 2,
      clickable: false,
      editable: false,
      zIndex: 1,
    });

    return () => {
      clearCircleOverlay();
    };
  }, [isLoaded, marker, radius, clearCircleOverlay]);

  const handleConfirm = async () => {
    if (!marker) {
      alert("Please select a location on the map.");
      return;
    }

    setIsGeocoding(true);
    try {
      // Reverse geocode only on confirmation to save costs
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: marker }, (results, status) => {
          if (status === "OK") resolve(results[0]);
          else reject(status);
        });
      });

      onConfirm({
        ...marker,
        radius,
        address: result.formatted_address,
        zoneId: selectedZone?._id,
        zoneName: selectedZone?.name,
        ...extractAddressDetails(result),
      });
      onClose();
    } catch (error) {
      console.error("Geocoding failed:", error);
      // Fallback: confirm without address
      onConfirm({
        ...marker,
        radius,
        address: address || "Custom Location",
      });
      onClose();
    } finally {
      setIsGeocoding(false);
    }
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Select Location">
        <div className="p-8 text-center text-red-500">
          Failed to load Google Maps. Please check your API key and connection.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Shop Location"
      size="md"
      footer={
        <div className="flex justify-between w-full items-center">
          <div className="text-sm text-gray-500">
            {marker
              ? `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`
              : "No location selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!marker || isGeocoding || (showZones && !!zoneError)}
            >
              {isGeocoding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm Location
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isLoaded && (
              <Autocomplete
                onLoad={(ref) => (autocompleteRef.current = ref)}
                onPlaceChanged={handlePlaceChanged}
                options={{
                  componentRestrictions: { country: "IN" },
                  fields: ["geometry", "formatted_address"],
                }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search for your shop area..."
                    className="pl-10"
                  />
                </div>
              </Autocomplete>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={getCurrentLocation}
            title="Use current location">
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
          {!isLoaded ? (
            <div className="h-[340px] flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <GoogleMap
              onLoad={handleMapLoad}
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              onClick={onMapClick}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}>
              {marker && (
                <Marker
                  key={`${marker.lat.toFixed(6)}-${marker.lng.toFixed(6)}`}
                  position={marker}
                  draggable={true}
                  onDragEnd={onMarkerDragEnd}
                  animation={window.google.maps.Animation.DROP}
                />
              )}

              {showZones && zones.map((zone) => (
                <Polygon
                  key={zone._id}
                  paths={zone.coordinates.map(coord => ({
                    lat: Number(coord.latitude),
                    lng: Number(coord.longitude)
                  }))}
                  options={{
                    fillColor: selectedZone?._id === zone._id ? "#10b981" : "#64748b",
                    fillOpacity: 0.2,
                    strokeColor: selectedZone?._id === zone._id ? "#059669" : "#475569",
                    strokeWeight: 2,
                    clickable: true,
                  }}
                  onClick={onMapClick}
                />
              ))}
            </GoogleMap>
          )}
        </div>

        {showZones && (
          <div className="space-y-2">
            {zoneError ? (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-medium animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>{zoneError}</p>
              </div>
            ) : selectedZone ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-xs font-bold">
                <MapPin className="w-4 h-4 shrink-0" />
                <p>Selected Zone: {selectedZone.name}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>Please click inside an operational zone on the map.</p>
              </div>
            )}
          </div>
        )}

        {!hideRadiusSlider && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">
                Service Radius (km)
              </label>
              <span className="text-sm font-bold text-primary">{radius} km</span>
            </div>
            <input
              type="range"
              min="1"
              max={maxRadius}
              step="1"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1 km</span>
              <span>{maxRadius} km</span>
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Customers within this radius from your shop will be able to see and
              order from you.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MapPicker;

