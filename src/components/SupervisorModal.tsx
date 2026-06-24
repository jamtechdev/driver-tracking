import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Platform,
    Pressable,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DirectionalArrow from '@/components/DirectionalArrow';
import VehicleMapMarkerContent from '@/components/map/VehicleMapMarkerContent';
import VehicleInfoMapOverlay from '@/components/map/VehicleInfoMapOverlay';
import { useMapVehicleMarkerPress } from '@/hooks/useMapVehicleMarkerPress';
import { useVehicleInfoWindow } from '@/hooks/useVehicleInfoWindow';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../theme/colors';
import { useDriverData } from '@/context/DriverDataContext';
import { useAuth } from '@/context/AuthContext';
import { useMapLocation } from '@/context/MapLocationContext';
import { useDriverModel } from '@/context/DriverModelContext';
import { useEmergency } from '@/context/EmergencyContext';
import { useMapAssignment } from '@/hooks/useMapAssignment';
import { useReportIncidentModal } from '@/context/ReportIncidentModalContext';
import { assignVehicle, getAllVehicles } from '@/api/vehicle.api';
import {
    buildStopMarkerId,
    isStopMarkerId,
    vehicleMarkerImage,
    vehicleMarkerTracksViewChanges,
} from '@/config/mapMarkers';
import { buildTabletMarkerKey, buildVehicleMarkerKey } from '@/utils/mapMarkerKeys';
import { handleStopMarkerPress, handleVehicleMarkerPress } from '@/utils/mapMarkerPress';
import {
    createVehicleHeadingResolver,
    getVehicleRouteColor,
    isAssignedRouteId,
    isVehicleLocationFresh,
    parseRoutePoints,
    parseVehicleCourse,
    parseVehicleLatLng,
    shouldAnimateVehicleArrow,
    isVehicleEmergencyAlertActive,
    getTabletMarkerBlinkMode,
    isEmergencyAlertActive,
} from '@/utils/helpers';
import { useIncomingMessages } from '@/context/IncomingMessagesContext';
import Toast from 'react-native-toast-message';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const WheelPicker = ({ data, selectedIndex, onSelect, labelExtractor }: {
    data: any[],
    selectedIndex: number,
    onSelect: (index: number) => void,
    labelExtractor: (item: any) => string
}) => {
    const scrollViewRef = useRef<ScrollView>(null);

    const onMomentumScrollEnd = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        onSelect(index);
    };

    useEffect(() => {
        if (scrollViewRef.current && selectedIndex >= 0) {
            scrollViewRef.current.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
        }
    }, []);

    return (
        <View style={styles.pickerContainer}>
            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                snapToAlignment="center"
                decelerationRate="fast"
                onMomentumScrollEnd={onMomentumScrollEnd}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
            >
                {/* Top Padding */}
                <View style={{ height: ITEM_HEIGHT }} />

                {data.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                                onSelect(index);
                                if (scrollViewRef.current) {
                                    scrollViewRef.current.scrollTo({
                                        y: index * ITEM_HEIGHT,
                                        animated: true
                                    });
                                }
                            }}
                            style={[styles.pickerItem, { height: ITEM_HEIGHT }]}
                        >
                            <Text style={[
                                styles.pickerText,
                                isSelected && styles.pickerTextSelected,
                            ]}>
                                {labelExtractor(item)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {/* Bottom Padding */}
                <View style={{ height: ITEM_HEIGHT }} />
            </ScrollView>
            <View style={styles.pickerHighlighter} pointerEvents="none" />
        </View>
    );
};

interface SupervisorModalProps {
    visible: boolean;
    onClose: () => void;
}

const SupervisorModal: React.FC<SupervisorModalProps> = ({ visible, onClose }) => {
    const { agency, vehicles, routes, drivers, stops } = useDriverData();
    // console.log("agency", agency);
    const { logout, driver } = useAuth();
    const { location, heading } = useMapLocation();
    const { lastLocation, serverAlert } = useDriverModel();
    const { emergencyActivated } = useEmergency();
    const { effectiveRouteId, hasMapAssignment } = useMapAssignment();
    const { open: openReportIncidentModal } = useReportIncidentModal();

    const tabletHeading = lastLocation?.heading ?? heading ?? 0;
    const tabletAlertActive = isEmergencyAlertActive(serverAlert) || emergencyActivated;
    const tabletBlinkMode = getTabletMarkerBlinkMode(hasMapAssignment, tabletAlertActive);
    const tabletRouteColor = useMemo(() => {
        const route = routes.find(r => String(r.routeID) === String(effectiveRouteId));
        return route?.color ? `#${route.color}` : COLORS.background;
    }, [routes, effectiveRouteId]);

    const onlyDrivers = drivers.filter(driver => driver.supervisor !== '1');
    const [polledVehicles, setPolledVehicles] = useState<any[]>([]);
    const resolveVehicleHeading = useRef(createVehicleHeadingResolver()).current;
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'list' | 'assign'>('list');
    const [showIncomingMessages, setShowIncomingMessages] = useState(false);
    const [arrowBlink, setArrowBlink] = useState<0 | 1>(0);
    const mapRef = useRef<MapView>(null);
    const [mapReady, setMapReady] = useState(false);
    const [mapRegionTick, setMapRegionTick] = useState(0);
    const [mapLayout, setMapLayout] = useState({ width: 1, height: 1 });
    const [currentRegion, setCurrentRegion] = useState(() => ({
        latitude: agency?.latitude ? parseFloat(agency.latitude) : 0,
        longitude: agency?.longitude ? parseFloat(agency.longitude) : 0,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    }));
    const {
        selectedVehicle: mapInfoVehicle,
        showVehicleInfo,
        dismissVehicleInfo,
        isVehicleInfoVisible,
    } = useVehicleInfoWindow();
    // Assignment States
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
    const [selectedDriverIndex, setSelectedDriverIndex] = useState(0);
    const [selectedHourIndex, setSelectedHourIndex] = useState(0);
    const [selectedMinuteIndex, setSelectedMinuteIndex] = useState(0);
    const [selectedAmPmIndex, setSelectedAmPmIndex] = useState(0);


    const { messages: incomingMessages } = useIncomingMessages();

    const routesWithOOS = useMemo(() => [
        { routeID: '0', shortName: 'Out of Service', longName: 'Out of Service', points: '', color: '000000' },
        ...routes
    ], [routes]);

    const routeColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        routes.forEach(r => {
            map[String(r.routeID)] = r.color ? `#${r.color}` : COLORS.primary;
        });
        return map;
    }, [routes]);

    const getRouteStops = useCallback((route: Record<string, unknown> | null | undefined) => {
        const rStops = route?.routeStops;
        if (!rStops || !Array.isArray(rStops) || stops.length === 0) return [];
        return stops.filter(stop =>
            rStops.some((id: unknown) => String(id) === String(stop.stopID)),
        );
    }, [stops]);

    /** All valid routes with parsed polyline points (shown by default). */
    const allRoutesWithPoints = useMemo(
        () =>
            routes
                .filter(r => isAssignedRouteId(r.routeID) && r.points)
                .map(r => ({
                    routeID: String(r.routeID),
                    color: r.color ? `#${r.color}` : COLORS.primary,
                    points: parseRoutePoints(r.points as string),
                }))
                .filter(r => r.points.length > 0),
        [routes],
    );

    /** Route focused after table selection or assign picker (zoom target). */
    const focusedRouteId = useMemo(() => {
        if (viewMode === 'assign' && routesWithOOS[selectedRouteIndex]) {
            const id = routesWithOOS[selectedRouteIndex].routeID;
            return isAssignedRouteId(id) ? String(id) : null;
        }
        if (selectedVehicleForAssign && isAssignedRouteId(selectedVehicleForAssign.routeID)) {
            return String(selectedVehicleForAssign.routeID);
        }
        return null;
    }, [viewMode, selectedRouteIndex, routesWithOOS, selectedVehicleForAssign]);

    const focusedRoutePoints = useMemo(() => {
        if (!focusedRouteId) return [];
        return allRoutesWithPoints.find(r => r.routeID === focusedRouteId)?.points ?? [];
    }, [focusedRouteId, allRoutesWithPoints]);

    const focusedRouteStops = useMemo(() => {
        if (!focusedRouteId) return [];
        const route = routes.find(r => String(r.routeID) === focusedRouteId);
        return getRouteStops(route as Record<string, unknown> | undefined);
    }, [focusedRouteId, routes, getRouteStops]);

    const focusedRouteColor = useMemo(() => {
        if (!focusedRouteId) return COLORS.primary;
        if (selectedVehicleForAssign && String(selectedVehicleForAssign.routeID) === focusedRouteId) {
            const fromVehicle = getVehicleRouteColor(selectedVehicleForAssign, routeColorMap);
            if (fromVehicle) return fromVehicle;
        }
        return routeColorMap[focusedRouteId] ?? COLORS.primary;
    }, [focusedRouteId, selectedVehicleForAssign, routeColorMap]);

    const freshVehicles = useMemo(
        () => polledVehicles.filter(isVehicleLocationFresh),
        [polledVehicles],
    );

    const liveInfoVehicle = useMemo(() => {
        if (!mapInfoVehicle) return null;
        const id = String(mapInfoVehicle.vehicleID);
        return polledVehicles.find(v => String(v.vehicleID) === id) ?? mapInfoVehicle;
    }, [mapInfoVehicle, polledVehicles]);

    const infoVehicle = liveInfoVehicle ?? mapInfoVehicle;

    const infoMapCoordinate = useMemo(() => {
        if (!infoVehicle) return null;
        const coord = parseVehicleLatLng(infoVehicle);
        if (!coord) return null;
        return { latitude: coord.lat, longitude: coord.lng };
    }, [infoVehicle]);

    const handleMapLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setMapLayout({ width, height });
        }
    }, []);

    const infoBubbleCoordinate = useMemo(() => {
        if (infoMapCoordinate) return infoMapCoordinate;
        if (!mapInfoVehicle) return null;
        const parsed = parseVehicleLatLng(mapInfoVehicle);
        if (parsed) return { latitude: parsed.lat, longitude: parsed.lng };
        return null;
    }, [infoMapCoordinate, mapInfoVehicle]);

    const handleMapVehiclePress = useCallback(
        (vehicle: Record<string, unknown>) => {
            mapRef.current?.hideCallout?.();
            showVehicleInfo(vehicle);
            setMapRegionTick(t => t + 1);
        },
        [showVehicleInfo],
    );

    const { onMapMarkerPress, onVehicleMarkerPress } = useMapVehicleMarkerPress(
        freshVehicles,
        handleMapVehiclePress,
        undefined,
        location,
        { onStopMarkerPress: dismissVehicleInfo },
    );

    const handleMapMarkerPress = useCallback(
        (event: { nativeEvent?: { id?: string; identifier?: string } }) => {
            const rawId = event.nativeEvent?.identifier ?? event.nativeEvent?.id;
            if (isStopMarkerId(rawId != null ? String(rawId) : null)) {
                dismissVehicleInfo();
                return;
            }
            mapRef.current?.hideCallout?.();
            onMapMarkerPress(event);
        },
        [onMapMarkerPress, dismissVehicleInfo],
    );

    useEffect(() => {
        if (isVehicleInfoVisible) {
            setMapRegionTick(t => t + 1);
        }
    }, [isVehicleInfoVisible, mapInfoVehicle?.vehicleID]);

    useEffect(() => {
        if (!isVehicleInfoVisible || !infoBubbleCoordinate) return;
        setMapRegionTick(t => t + 1);
    }, [
        isVehicleInfoVisible,
        infoBubbleCoordinate?.latitude,
        infoBubbleCoordinate?.longitude,
    ]);

    useEffect(() => {
        const timer = setInterval(() => {
            setArrowBlink(p => (p === 0 ? 1 : 0));
        }, 600);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!visible || !mapRef.current) return;
        const zoomCoords =
            focusedRoutePoints.length > 0
                ? focusedRoutePoints
                : allRoutesWithPoints.flatMap(r => r.points);
        if (zoomCoords.length === 0) return;

        const t = setTimeout(() => {
            mapRef.current?.fitToCoordinates(zoomCoords, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }, focusedRouteId ? 300 : 600);
        return () => clearTimeout(t);
    }, [visible, focusedRouteId, focusedRoutePoints, allRoutesWithPoints, selectedVehicleForAssign?.vehicleID, selectedRouteIndex]);

    const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
    const ampm = useMemo(() => ['AM', 'PM'], []);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const fetchData = async () => {
            try {
                const data = await getAllVehicles();
                if (data && data.length > 0) {
                    setPolledVehicles([...data]);
                }
            } catch (err) {
                console.warn('[SupervisorModal] Failed to fetch vehicles:', err);
            }
        };

        if (visible) {
            fetchData();
            interval = setInterval(fetchData, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [visible]);

    const handleVehiclePress = (item: any) => {
        if (item.vehicleNumber === '-') return;
        setSelectedVehicleForAssign(item);

        const rIdx = routesWithOOS.findIndex(r => String(r.routeID) === String(item.routeID));
        if (rIdx !== -1) {
            setSelectedRouteIndex(rIdx);
        } else if (!isAssignedRouteId(item.routeID)) {
            setSelectedRouteIndex(0);
        }

        // Initialize assignment time to now
        const now = new Date();
        const currentHour = now.getHours();
        setSelectedHourIndex((currentHour % 12 || 12) - 1);
        setSelectedMinuteIndex(now.getMinutes());
        setSelectedAmPmIndex(currentHour >= 12 ? 1 : 0);

        setViewMode('assign');
    };

    const handleAssign = async () => {
        if (!selectedVehicleForAssign) return;

        const route = routesWithOOS[selectedRouteIndex];
        const driver = drivers[selectedDriverIndex];

        if (!route || !driver) {
            onClose();
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a route and driver' });
            return;
        }

        const selectedHour = hours[selectedHourIndex];
        const selectedMinute = parseInt(minutes[selectedMinuteIndex]);
        const selectedAmPm = ampm[selectedAmPmIndex];

        const now = new Date();
        let h = selectedAmPm === 'PM' ? (selectedHour % 12) + 12 : selectedHour % 12;
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, selectedMinute, 0);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);

        setIsAssigning(true);
        try {
            const params = {
                routeID: route.routeID,
                driverID: onlyDrivers[selectedDriverIndex].driverID,
                vehicleID: selectedVehicleForAssign.vehicleID,
                end: endTimestamp,
            };

            const result = await assignVehicle(params);
            console.log('Assignment result:', result);

            if (result.success) {
                Toast.show({ type: 'success', text1: 'Success', text2: 'Vehicle assigned successfully' });
                onClose();
                setViewMode('list');
            } else {
                onClose();
                Alert.alert('Error', (result.message as any)?.errormsg || 'Assignment failed');
            }
        } catch (error) {
            console.error('Assignment catch error:', error);
            Alert.alert('Error', 'An unexpected error occurred during assignment');
        } finally {
            setIsAssigning(false);
        }
    };

    // Create some dummy rows if needed to match the reference look
    const tableData = useMemo(() => {
        const list = polledVehicles.length > 0 ? [...polledVehicles] : [...vehicles];
        while (list.length < 12) {
            list.push({ vehicleID: `dummy-${list.length}`, vehicleNumber: '-', vehicleName: '-' } as any);
        }
        return list;
    }, [polledVehicles, vehicles]);


    const renderVehicleItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.tableRow}
            onPress={() => handleVehiclePress(item)}
            activeOpacity={item.vehicleNumber === '-' ? 1 : 0.6}
        >
            <Text style={[styles.cell, styles.vehicleCell, { borderRightWidth: 1, borderRightColor: '#EEE' }]}>
                {item.vehicleName || item.vehicleNumber}
            </Text>
            <Text style={styles.cell}>{item?.routeShortName || '-'}</Text>
            <Text style={styles.cell}>{item.minsLate || '-'}</Text>
            <Text style={[styles.cell, styles.greenText]}>{item?.APCPercentage || (item.vehicleNumber !== '-' ? '0' : '-')}</Text>
            <Text style={styles.cell}>{item.speed >0 ? item.speed : '0'}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={Platform.OS === 'android'}
            presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
            supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
        >
            <View style={styles.backdrop}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                />
                <View
                    style={styles.modalCard}
                    onStartShouldSetResponder={() => true}
                >
                    {/* Main Content Area */}
                    <View style={styles.topSection}>
                        {/* Left Column: Map & Messages */}
                        <View style={styles.mapColumn}>
                            <View style={[styles.mapContent, showIncomingMessages && { flex: 0.80 }]}>
                                <View style={styles.mapHost} onLayout={handleMapLayout}>
                                <MapView
                                    ref={mapRef}
                                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                                    style={StyleSheet.absoluteFill}
                                    onMapReady={() => setMapReady(true)}
                                    onRegionChange={(region) => {
                                        setCurrentRegion(region);
                                        setMapRegionTick(t => t + 1);
                                    }}
                                    onRegionChangeComplete={setCurrentRegion}
                                    onMarkerPress={handleMapMarkerPress}
                                    initialRegion={agency?.latitude && agency?.longitude ? {
                                        latitude: parseFloat(agency.latitude),
                                        longitude: parseFloat(agency.longitude),
                                        latitudeDelta: 0.0922,
                                        longitudeDelta: 0.0421,
                                    } : {
                                        latitude: 0,
                                        longitude: 0,
                                        latitudeDelta: 0.0922,
                                        longitudeDelta: 0.0421,
                                    }}
                                >
                                    {allRoutesWithPoints.map(r => {
                                        const isFocused = focusedRouteId === r.routeID;
                                        return (
                                            <Polyline
                                                key={`route-path-${r.routeID}`}
                                                coordinates={r.points}
                                                strokeColor={isFocused ? r.color : r.color}
                                                strokeWidth={isFocused ? 5 : 3}
                                                lineJoin="round"
                                                lineCap="round"
                                            />
                                        );
                                    })}
                                    {focusedRouteStops.map((stop) => {
                                        const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(String(stop.lat));
                                        const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(String(stop.lng));
                                        if (isNaN(lat) || isNaN(lng)) return null;
                                        return (
                                            <Marker
                                                key={`stop-${focusedRouteId}-${stop.stopID}`}
                                                identifier={buildStopMarkerId(
                                                    stop.stopID,
                                                    focusedRouteId,
                                                )}
                                                image={vehicleMarkerImage()}
                                                coordinate={{ latitude: lat, longitude: lng }}
                                                anchor={{ x: 0.5, y: 1 }}
                                                tracksViewChanges={false}
                                                zIndex={0}
                                                title={String(stop.longName || `Stop ${stop.stopID}`)}
                                                description={`Stop ID: ${stop.stopID}`}
                                                onPress={(e) =>
                                                    handleStopMarkerPress(e, dismissVehicleInfo)
                                                }
                                            >
                                                <View style={[styles.stopMarker, { backgroundColor: focusedRouteColor, borderColor: '#FFF' }]} />
                                            </Marker>
                                        );
                                    })}
                                    {location && driver && (
                                        <Marker
                                            key={buildTabletMarkerKey(tabletBlinkMode !== 'none', arrowBlink)}
                                            image={vehicleMarkerImage()}
                                            coordinate={{
                                                latitude: location.latitude,
                                                longitude: location.longitude,
                                            }}
                                            title="You"
                                            description={`Accuracy: ${Math.round(location.accuracy)} m`}
                                            anchor={{ x: 0.5, y: 0.5 }}
                                            flat
                                            tracksViewChanges={vehicleMarkerTracksViewChanges(tabletBlinkMode !== 'none')}
                                        >
                                            <DirectionalArrow
                                                heading={tabletHeading}
                                                color={hasMapAssignment ? tabletRouteColor : COLORS.background}
                                                blinkMode={tabletBlinkMode}
                                                blinkPhase={tabletBlinkMode === 'none' ? undefined : arrowBlink}
                                            />
                                        </Marker>
                                    )}
                                    {freshVehicles.map((vehicle) => {
                                        const coord = parseVehicleLatLng(vehicle);
                                        if (!coord) return null;

                                        const course = parseVehicleCourse(vehicle);
                                        const bear = resolveVehicleHeading(String(vehicle.vehicleID), coord, course);
                                        const vehicleAnimates = shouldAnimateVehicleArrow(vehicle, routeColorMap);
                                        const arrowColor = getVehicleRouteColor(vehicle, routeColorMap) ?? COLORS.background;
                                        const vehicleAlertBlink = isVehicleEmergencyAlertActive(vehicle);
                                        const markerBlinks = vehicleAlertBlink || vehicleAnimates;
                                        const vId = String(vehicle.vehicleID);
                                        const infoOpen =
                                            isVehicleInfoVisible &&
                                            String(mapInfoVehicle?.vehicleID) === vId;
                                        const markerKey = buildVehicleMarkerKey(
                                            vehicle.vehicleID,
                                            markerBlinks,
                                            arrowBlink,
                                            infoOpen,
                                        );

                                        return (
                                            <Marker
                                                key={markerKey}
                                                identifier={vId}
                                                calloutEnabled={false}
                                                image={vehicleMarkerImage()}
                                                coordinate={{ latitude: coord.lat, longitude: coord.lng }}
                                                anchor={{ x: 0.5, y: 0.5 }}
                                                flat
                                                tracksViewChanges={vehicleMarkerTracksViewChanges(markerBlinks || infoOpen)}
                                                zIndex={infoOpen ? 999 : 10}
                                                onPress={(e) => handleVehicleMarkerPress(e, vehicle, onVehicleMarkerPress)}
                                            >
                                                <VehicleMapMarkerContent
                                                    heading={bear}
                                                    color={arrowColor}
                                                    blinkMode={
                                                        vehicleAlertBlink
                                                            ? 'alert'
                                                            : vehicleAnimates
                                                              ? 'unassigned'
                                                              : 'none'
                                                    }
                                                    blinkPhase={markerBlinks ? arrowBlink : undefined}
                                                    size={40}
                                                    onPress={() => onVehicleMarkerPress(vehicle)}
                                                />
                                            </Marker>
                                        );
                                    })}
                                </MapView>

                                {isVehicleInfoVisible && mapInfoVehicle && infoBubbleCoordinate && (
                                    <VehicleInfoMapOverlay
                                        mapRef={mapRef}
                                        mapReady={mapReady}
                                        regionTick={mapRegionTick}
                                        region={currentRegion}
                                        mapLayout={mapLayout}
                                        coordinate={infoBubbleCoordinate}
                                        vehicle={infoVehicle ?? mapInfoVehicle}
                                        onClose={dismissVehicleInfo}
                                    />
                                )}
                                </View>
                            </View>

                            {/* Message Header / Footer (same as given image) */}


                            {/* Incoming Messages List */}
                            {showIncomingMessages && (
                                <>
                                    <View style={styles.mapFooter}>
                                        <Text style={styles.overlayText}>Vehicle</Text>
                                        <Text style={styles.overlayText}>Driver</Text>
                                        <Text style={styles.overlayText}>Seconds ago</Text>
                                    </View>

                                    <View style={styles.messageListContainer}>
                                        <FlatList
                                            data={incomingMessages}
                                            keyExtractor={(item) => item.messageID}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={styles.messageRow}
                                                    onPress={() => Alert.alert(`Message from ${item.driverName || item.userName || 'Driver'}`, item.message)}
                                                >
                                                    <Text style={[styles.messageCell, { flex: 1 }]}>{item.vehicleName || '-'}</Text>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.messageCell} numberOfLines={1}>{item.userName || item.driverName || '-'}</Text>
                                                        <Text style={[styles.messageCell, { fontSize: 11, color: '#666' }]} numberOfLines={1}>{item.message}</Text>
                                                    </View>
                                                    <Text style={[styles.messageCell, { flex: 1, textAlign: 'right' }]}>
                                                        {item.secondsAgo ? `${item.secondsAgo}s ago` : 'now'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                            ItemSeparatorComponent={() => <View style={styles.messageSeparator} />}
                                            showsVerticalScrollIndicator={true}
                                            ListEmptyComponent={() => (
                                                <View style={styles.emptyMessages}>
                                                    <Text style={styles.emptyText}>No incoming messages</Text>
                                                </View>
                                            )}
                                        />
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Right Column: Table or Assignment Form */}
                        <View style={styles.tableColumn}>
                            {viewMode === 'list' ? (
                                <>
                                    {/* Table Header at TOP */}
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.headerCell, styles.headerCellFirst, { borderRightWidth: 1, borderRightColor: '#999' }]}>Vehicle</Text>
                                        <View style={styles.activeHeaderCell}>
                                            <Text style={styles.activeHeaderText}>Route</Text>
                                        </View>
                                        <Text style={styles.headerCell}>OTP</Text>
                                        <Text style={styles.headerCell}>APC%</Text>
                                        <Text style={styles.headerCell}>MPH</Text>
                                    </View>

                                    {/* Table Rows */}
                                    <FlatList
                                        data={tableData}
                                        renderItem={renderVehicleItem}

                                        keyExtractor={(item, index) => item.vehicleID || index.toString()}
                                        showsVerticalScrollIndicator={false}
                                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                                    />

                                </>
                            ) : (
                                <>
                                    <ScrollView
                                        style={styles.formContainer}
                                        contentContainerStyle={{ paddingBottom: 20 }}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        <View style={styles.formHeader}>
                                            <Text style={styles.formTitle}>{selectedVehicleForAssign?.vehicleName || selectedVehicleForAssign?.vehicleID}</Text>
                                            <TouchableOpacity onPress={() => {
                                                setSelectedVehicleForAssign(null);
                                                setSelectedRouteIndex(0);
                                                setViewMode('list');
                                            }} style={styles.formCancelBtn}>
                                                <Text style={styles.formCancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.formLabel}>Route</Text>
                                        <View style={styles.selectorWrapper}>
                                            <WheelPicker
                                                data={routesWithOOS}
                                                selectedIndex={selectedRouteIndex}
                                                onSelect={setSelectedRouteIndex}
                                                labelExtractor={(item) => item.shortName || item.longName || item.routeID}
                                            />
                                        </View>

                                        <Text style={styles.formLabel}>Driver</Text>
                                        <View style={styles.selectorWrapper}>
                                            <WheelPicker
                                                data={onlyDrivers}
                                                selectedIndex={selectedDriverIndex}
                                                onSelect={setSelectedDriverIndex}
                                                labelExtractor={(item) => item.driverName || item.driverID}
                                            />
                                        </View>

                                        <Text style={styles.formLabel}>End Time</Text>
                                        <View style={[styles.selectorWrapper, styles.timePickerRow]}>
                                            <View style={styles.timeColumn}>
                                                <WheelPicker
                                                    data={hours}
                                                    selectedIndex={selectedHourIndex}
                                                    onSelect={setSelectedHourIndex}
                                                    labelExtractor={(item) => item.toString()}
                                                />
                                            </View>
                                            <View style={styles.timeColumn}>
                                                <WheelPicker
                                                    data={minutes}
                                                    selectedIndex={selectedMinuteIndex}
                                                    onSelect={setSelectedMinuteIndex}
                                                    labelExtractor={(item) => item}
                                                />
                                            </View>
                                            <View style={styles.timeColumn}>
                                                <WheelPicker
                                                    data={ampm}
                                                    selectedIndex={selectedAmPmIndex}
                                                    onSelect={setSelectedAmPmIndex}
                                                    labelExtractor={(item) => item}
                                                />
                                            </View>
                                        </View>
                                    </ScrollView>

                                    <View style={styles.assignBtnWrapper}>
                                        <TouchableOpacity
                                            style={[styles.assignBtn, isAssigning && { opacity: 0.7 }]}
                                            onPress={handleAssign}
                                            disabled={isAssigning}
                                        >
                                            {isAssigning ? (
                                                <ActivityIndicator color="#FFF" />
                                            ) : (
                                                <Text style={styles.assignBtnText}>Assign</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Bottom Navigation */}
                    <View style={styles.bottomBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, showIncomingMessages && styles.activeTab]}
                            onPress={() => setShowIncomingMessages(!showIncomingMessages)}
                        >
                            <MaterialIcons
                                name="chat-bubble-outline"
                                size={32}
                                color={showIncomingMessages ? COLORS.primary : "#FFF"}
                                style={{ opacity: showIncomingMessages ? 1 : 0.7 }}
                            />
                            <Text style={[styles.tabLabel, showIncomingMessages && { color: COLORS.primary }]}>Messages</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.tabItem}
                            onPress={() => {
                                // iOS cannot stack two RN Modals reliably — dismiss supervisor first.
                                if (Platform.OS === 'ios') {
                                    onClose();
                                    setTimeout(() => openReportIncidentModal(), 350);
                                } else {
                                    openReportIncidentModal();
                                }
                            }}
                        >
                            <MaterialIcons name="assignment" size={32} color="#FFF" style={{ opacity: 0.7 }} />
                            <Text style={styles.tabLabel}>Report Incident</Text>
                        </TouchableOpacity>

                        {/* The empty middle gap from the reference image */}
                        <View style={styles.tabSpacer} />

                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                            }}
                            style={[styles.tabItem, styles.activeTab]}>
                            <MaterialIcons name="speed" size={32} color="#FFF" />
                            <Text style={styles.tabLabel}>Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.tabItem} onPress={() => { logout(); onClose(); }}>
                            <MaterialCommunityIcons name="lock-outline" size={32} color="#FFF" />
                            <Text style={styles.tabLabel}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    modalCard: {
        width: '100%',
        // maxWidth: '98%',
        height: '95%',
        maxHeight: 650,
        backgroundColor: '#FFF',
        borderRadius: 8,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    topSection: {
        flex: 1,
        flexDirection: 'row',
    },
    mapColumn: {
        flex: 0.95, // Map column is slightly narrower
        borderRightWidth: 1,
        borderRightColor: '#BBB',
    },
    mapContent: {
        flex: 1,
    },
    mapHost: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapFooter: {
        height: 36,
        backgroundColor: '#ADADAD',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#999',
    },
    overlayText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
    },
    messageListContainer: {
        flex: 0.15,
        backgroundColor: '#FFF',
    },
    messageListHeader: {
        flexDirection: 'row',
        height: 20,
        backgroundColor: '#E0E0E0',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#CCC',
    },
    messageHeaderCell: {
        flex: 1,
        fontSize: 13,
        color: '#333',
        textAlign: 'center',
        fontWeight: '600',
    },
    messageRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    messageCell: {
        fontSize: 14,
        color: '#444',
        textAlign: 'center',
    },
    messageSeparator: {
        height: 1,
        backgroundColor: '#EEE',
    },
    emptyMessages: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
    },
    tableColumn: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    tableHeader: {
        flexDirection: 'row',
        height: 48,
        backgroundColor: '#ADADAD',
        alignItems: 'center',
    },
    headerCell: {
        flex: 1,
        fontSize: 15,
        color: '#000',
        textAlign: 'center',
        fontWeight: '600',
    },
    headerCellFirst: {
        fontWeight: '700',
    },
    activeHeaderCell: {
        flex: 1,
        backgroundColor: '#000',
        height: '65%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 2,
        marginHorizontal: 5,
    },
    activeHeaderText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'none',
    },
    tableRow: {
        flexDirection: 'row',
        height: 52,
        alignItems: 'center',
    },
    cell: {
        flex: 1,
        fontSize: 14,
        color: '#444',
        textAlign: 'center',
    },
    vehicleCell: {
        color: '#222',
    },
    greenText: {
        color: '#30AD4F',
        fontWeight: '700',
    },
    separator: {
        height: 1,
        backgroundColor: '#EEE',
    },
    bottomBar: {
        height: 100,
        backgroundColor: '#383838', // Exact shade from reference
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    activeTab: {
        backgroundColor: '#525252',
    },
    tabSpacer: {
        flex: 1, // Full middle slot is empty
    },
    tabLabel: {
        color: '#BEBEBE',
        fontSize: 13,
        marginTop: 6,
        fontWeight: '500',
        textAlign: 'center'
    },
    // Assignment Form Styles
    formContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: '#FFF',
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    formCancelBtn: {
        padding: 8,
    },
    formCancelText: {
        color: '#E11D48',
        fontSize: 16,
        fontWeight: '600',
    },
    formLabel: {
        fontSize: 16,
        color: '#666',
        marginBottom: 6,
        fontWeight: '500',
    },
    selectorWrapper: {
        height: PICKER_HEIGHT,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    pickerContainer: {
        flex: 1,
    },
    pickerItem: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    pickerTextSelected: {
        color: '#111827',
        fontWeight: 'bold',
        fontSize: 18,
    },
    pickerHighlighter: {
        position: 'absolute',
        top: ITEM_HEIGHT,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    timePickerRow: {
        flexDirection: 'row',
    },
    timeColumn: {
        flex: 1,
    },
    assignBtnWrapper: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    assignBtn: {
        backgroundColor: COLORS.headerBlue,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    assignBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    stopMarker: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: COLORS.emergency,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
});


export default SupervisorModal;
