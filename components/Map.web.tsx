import React from 'react';
import { View } from 'react-native';

export default function Map({ location, destLatNum, destLngNum }: any) {
    const hasDestination = !isNaN(destLatNum) && !isNaN(destLngNum);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body { margin: 0; padding: 0; background: #f8fafc; } 
            #map { width: 100vw; height: 100vh; }
            .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
            
            /* Premium Swiggy-style Pulsing Marker for Provider */
            .provider-pulse {
                width: 18px;
                height: 18px;
                background: #F97316; /* Swiggy Orange vibe */
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 10px rgba(249, 115, 22, 0.4);
                position: relative;
            }
            .provider-pulse::after {
                content: '';
                width: 40px;
                height: 40px;
                background: rgba(249, 115, 22, 0.4);
                border-radius: 50%;
                position: absolute;
                top: -14px;
                left: -14px;
                animation: pulse 1.5s infinite ease-out;
            }

            /* Destination Pin */
            .dest-pin {
                width: 16px;
                height: 16px;
                background: #0F172A;
                border-radius: 50%;
                border: 4px solid white;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            }

            @keyframes pulse {
                0% { transform: scale(0.3); opacity: 1; }
                100% { transform: scale(1.5); opacity: 0; }
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            var start = [${location.latitude}, ${location.longitude}];
            var end = [${destLatNum || 0}, ${destLngNum || 0}];

            // Carto Light (Very clean, premium map base)
            var map = L.map('map', { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView(start, 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
            }).addTo(map);

            var providerIcon = L.divIcon({
                className: '',
                html: "<div class='provider-pulse'></div>",
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            L.marker(start, { icon: providerIcon }).addTo(map);

            if (${hasDestination ? 'true' : 'false'}) {
                var destIcon = L.divIcon({
                    className: '',
                    html: "<div class='dest-pin'></div>",
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });
                L.marker(end, { icon: destIcon }).addTo(map);

                // Swiggy-like smooth dashed curve simulation
                var polyline = L.polyline([start, end], {
                    color: '#0F172A', 
                    weight: 3,
                    dashArray: '6, 8',
                    opacity: 0.6,
                    lineCap: 'round'
                }).addTo(map);
                
                map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 16 });
            }
        </script>
    </body>
    </html>
    `;

    return (
        <View style={{ flex: 1 }}>
            <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                srcDoc={html}
            />
        </View>
    );
}
