import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { Task } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useMemo } from 'react';
import { GoogleMaps, AppleMaps, CameraPosition, Coordinates } from 'expo-maps';

interface MarketplaceMapProps {
  gigs: Task[];
  userLocation: { latitude: number; longitude: number } | null;
  onMarkerPress: (taskId: string) => void;
}

export function MarketplaceMap({ gigs, userLocation, onMarkerPress }: MarketplaceMapProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [cameraPosition, setCameraPosition] = useState<CameraPosition | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Filter out gigs with invalid locations
  const validGigs = useMemo(() => {
    const filtered = gigs.filter(gig => {
      if (!gig.location) {
        return false;
      }
      
      // Handle stringified JSON
      let location = gig.location;
      if (typeof location === 'string') {
        try {
          location = JSON.parse(location);
        } catch (e) {
          console.error('Failed to parse location string:', gig.id, location);
          return false;
        }
      }
      
      // Check if it's an object with latitude/longitude
      if (typeof location !== 'object' || location === null) {
        return false;
      }
      
      const lat = location.latitude;
      const lng = location.longitude;
      
      return typeof lat === 'number' && 
             typeof lng === 'number' &&
             !isNaN(lat) &&
             !isNaN(lng);
    });
    
    console.log(`Filtered ${filtered.length} valid gigs from ${gigs.length} total gigs`);
    return filtered;
  }, [gigs]);

  // Calculate initial camera position to show all markers
  useEffect(() => {
    if (validGigs.length === 0 && userLocation) {
      // If no gigs but we have user location, center on user
      setCameraPosition({
        coordinates: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        zoom: 15,
      });
    } else if (validGigs.length > 0) {
      // Calculate bounds to show all markers
      const latitudes: number[] = [];
      const longitudes: number[] = [];
      
      validGigs.forEach(gig => {
        let location = gig.location;
        if (typeof location === 'string') {
          try {
            location = JSON.parse(location);
          } catch (e) {
            return;
          }
        }
        if (location && typeof location === 'object' && location.latitude && location.longitude) {
          latitudes.push(location.latitude);
          longitudes.push(location.longitude);
        }
      });
      
      if (userLocation) {
        latitudes.push(userLocation.latitude);
        longitudes.push(userLocation.longitude);
      }

      if (latitudes.length > 0 && longitudes.length > 0) {
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        
        // Calculate zoom level based on span (rough approximation)
        const maxSpan = Math.max(latSpan, lngSpan);
        let zoom = 15;
        if (maxSpan > 0.1) zoom = 10;
        else if (maxSpan > 0.05) zoom = 11;
        else if (maxSpan > 0.02) zoom = 12;
        else if (maxSpan > 0.01) zoom = 13;
        else if (maxSpan > 0.005) zoom = 14;

        setCameraPosition({
          coordinates: {
            latitude: centerLat,
            longitude: centerLng,
          },
          zoom,
        });
      }
    } else {
      // Default to a reasonable location
      setCameraPosition({
        coordinates: {
          latitude: 39.8283,
          longitude: -98.5795,
        },
        zoom: 10,
      });
    }
  }, [validGigs.length, userLocation]);

  // Prepare markers for the map (gigs + user location)
  const markersForMap = useMemo(() => {
    const gigMarkers = validGigs.map(gig => {
      let gigLocation = gig.location;
      if (typeof gigLocation === 'string') {
        try {
          gigLocation = JSON.parse(gigLocation);
        } catch (e) {
          return null;
        }
      }
      
      if (!gigLocation || typeof gigLocation !== 'object' || gigLocation === null) {
        return null;
      }
      
      const gigLat = (gigLocation as any).latitude;
      const gigLng = (gigLocation as any).longitude;
      
      if (typeof gigLat !== 'number' || typeof gigLng !== 'number' || isNaN(gigLat) || isNaN(gigLng)) {
        return null;
      }

      if (Platform.OS === 'ios') {
        return {
          id: gig.id,
          coordinates: {
            latitude: gigLat,
            longitude: gigLng,
          },
          title: gig.title,
        } as AppleMaps.Marker;
      } else {
        return {
          id: gig.id,
          coordinates: {
            latitude: gigLat,
            longitude: gigLng,
          },
          title: gig.title,
          snippet: `$${gig.pay.toFixed(2)} - ${gig.address}`,
        } as GoogleMaps.Marker;
      }
    }).filter((marker): marker is NonNullable<typeof marker> => marker !== null);

    // Add user location marker if available
    const allMarkers = [...gigMarkers];
    if (userLocation) {
      if (Platform.OS === 'ios') {
        allMarkers.push({
          id: 'user-location',
          coordinates: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          title: 'Your Location',
          tintColor: '#73af17', // App theme color
        } as AppleMaps.Marker);
      } else {
        allMarkers.push({
          id: 'user-location',
          coordinates: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          title: 'Your Location',
        } as GoogleMaps.Marker);
      }
    }

    return allMarkers;
  }, [validGigs, userLocation]);

  // Show error state if map error
  if (mapError) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="map-outline"
            size={64}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.title, isDark && styles.titleDark]}>
            Map View Error
          </Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>
            {mapError}
          </Text>
        </View>
      </View>
    );
  }

  // Show loading state while calculating camera position
  if (!cameraPosition) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="map-outline"
            size={64}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.message, isDark && styles.messageDark]}>
            Loading map...
          </Text>
        </View>
      </View>
    );
  }

  const MapComponent = Platform.OS === 'ios' ? AppleMaps.View : GoogleMaps.View;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <MapComponent
        style={styles.map}
        cameraPosition={cameraPosition}
        markers={markersForMap}
        showsUserLocation={!!userLocation}
        onMarkerClick={(event) => {
          const markerId = event.nativeEvent.markerId;
          if (markerId) {
            onMarkerPress(markerId);
          }
        }}
        onError={(error) => {
          console.error('Map error:', error);
          setMapError(error.nativeEvent?.message || 'Map error occurred');
        }}
      />

      {/* Info overlay showing count */}
      {validGigs.length > 0 && (
        <View style={[styles.infoOverlay, isDark && styles.infoOverlayDark]}>
          <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
            {validGigs.length} {validGigs.length === 1 ? 'gig' : 'gigs'} nearby
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  messageDark: {
    color: '#9CA3AF',
  },
  infoOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoOverlayDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  infoTextDark: {
    color: '#F9FAFB',
  },
});
