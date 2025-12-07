import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapUpdater({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, {
            duration: 2,
            easeLinearity: 0.25
        });
    }, [center, zoom, map]);
    return null;
}

const LifeMap = ({ activeEvent }) => {
    const position = activeEvent ? activeEvent.location : [51.505, -0.09];
    const zoom = activeEvent ? activeEvent.zoom : 13;

    return (
        <div className="map-container">
            <MapContainer
                center={position}
                zoom={zoom}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                {activeEvent && (
                    <Marker position={activeEvent.location}>
                        <Popup>
                            {activeEvent.title}
                        </Popup>
                    </Marker>
                )}
                <MapUpdater center={position} zoom={zoom} />
            </MapContainer>
            <div className="map-overlay-gradient"></div>
        </div>
    );
};

export default LifeMap;
