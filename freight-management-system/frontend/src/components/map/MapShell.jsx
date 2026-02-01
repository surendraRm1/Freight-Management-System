import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultCenter = [20.5937, 78.9629]; // India centroid
const defaultZoom = 5;

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapViewport = ({ markers = [], polyline = [], driverPosition }) => {
  const map = useMap();

  const bounds = useMemo(() => {
    const coords = [
      ...markers.map((marker) => marker.position),
      ...polyline,
      driverPosition,
    ].filter(Boolean);

    if (coords.length === 0) return null;
    return L.latLngBounds(coords);
  }, [markers, polyline, driverPosition]);

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView(defaultCenter, defaultZoom);
    }
  }, [bounds, map]);

  return null;
};

const MapShell = ({ markers = [], polyline = [], driverPosition, className }) => (
  <div className={`relative h-full min-h-[360px] w-full overflow-hidden rounded-3xl shadow-inner ${className ?? ''}`}>
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport markers={markers} polyline={polyline} driverPosition={driverPosition} />

      {markers.map((marker) => (
        <Marker key={marker.label} position={marker.position} />
      ))}

      {polyline.length > 1 && (
        <Polyline positions={polyline} color="#2563eb" weight={4} opacity={0.75} />
      )}

      {driverPosition && (
        <CircleMarker
          center={driverPosition}
          radius={10}
          pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            Driver location
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  </div>
);

export default MapShell;

