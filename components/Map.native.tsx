import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion } from 'react-native-maps';

export default function Map({ location, destLatNum, destLngNum }: any) {
    const mapRef = useRef<MapView>(null);
    const markerRef = useRef<any>(null);
    
    // Smooth animation state for the partner marker
    const [coordinate] = useState(
        new AnimatedRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        })
    );

    const hasDestination = !isNaN(destLatNum) && !isNaN(destLngNum);

    useEffect(() => {
        // Animate the marker to the new location smoothly (Swiggy-style moving marker)
        if (Platform.OS === 'android') {
            if (markerRef.current) {
                markerRef.current.animateMarkerToCoordinate(location, 1000);
            }
        } else {
            coordinate.timing({
                latitude: location.latitude,
                longitude: location.longitude,
                duration: 1000,
                useNativeDriver: false,
            }).start();
        }

        // Auto-zoom to fit both the partner and the destination
        if (hasDestination && mapRef.current) {
            mapRef.current.fitToCoordinates(
                [
                    { latitude: location.latitude, longitude: location.longitude },
                    { latitude: destLatNum, longitude: destLngNum }
                ],
                {
                    edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
                    animated: true
                }
            );
        } else if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 1000);
        }
    }, [location.latitude, location.longitude, destLatNum, destLngNum]);

    return (
        <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }}
            showsUserLocation={false}
        >
            {/* The Polyline drawing the path between Partner and Destination */}
            {hasDestination && (
                <Polyline
                    coordinates={[
                        { latitude: location.latitude, longitude: location.longitude },
                        { latitude: destLatNum, longitude: destLngNum }
                    ]}
                    strokeColor="#059669" // Emerald green to match app theme
                    strokeWidth={4}
                    lineDashPattern={[10, 10]} // Dotted line for a modern Swiggy-like route vibe
                />
            )}

            {/* Smooth Moving Partner Marker */}
            <Marker.Animated
                ref={markerRef}
                coordinate={coordinate as any}
                title="Provider"
                description="Provider is on the way"
                anchor={{ x: 0.5, y: 0.5 }}
                // Note: to make it even more Swiggy-like, you could add:
                // image={require('../assets/bike-icon.png')}
            />

            {/* Destination Pin */}
            {hasDestination && (
                <Marker
                    coordinate={{ latitude: destLatNum, longitude: destLngNum }}
                    title="Destination"
                    description="Customer Location"
                    pinColor="#0F172A" // Deep navy pin
                />
            )}
        </MapView>
    );
}
