// import React, { useMemo, useState, useRef, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     Modal,
//     TouchableOpacity,
//     FlatList,
//     Platform,
//     Pressable,
//     ScrollView,
//     Alert,
//     ActivityIndicator,
//     Animated,
// } from 'react-native';
// import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
// import Svg, { Path } from 'react-native-svg';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// import { COLORS } from '../theme/colors';
// import { useDriverData } from '@/context/DriverDataContext';
// import { useAuth } from '@/context/AuthContext';
// import { useReportIncidentModal } from '@/context/ReportIncidentModalContext';
// import { assignVehicle, getAllVehicles } from '@/api/vehicle.api';
// import { useIncomingMessages } from '@/context/IncomingMessagesContext';
// import Toast from 'react-native-toast-message';

// const DirectionalArrow = ({ color }: { color: string }) => {
//     const pulseAnim = useRef(new Animated.Value(0)).current;

//     useEffect(() => {
//         // Create a 'ping' animation: start from center, expand and fade out
//         Animated.loop(
//             Animated.timing(pulseAnim, {
//                 toValue: 1,
//                 duration: 2000,
//                 useNativeDriver: true,
//             })
//         ).start();
//     }, [pulseAnim]);

//     const glowScale = pulseAnim.interpolate({
//         inputRange: [0, 1],
//         outputRange: [1, 2.5], // Larger expansion
//     });

//     const glowOpacity = pulseAnim.interpolate({
//         inputRange: [0, 0.1, 1],
//         outputRange: [0, 0.8, 0], // Quick fade in, slow fade out
//     });

//     return (
//         <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
//             {/* Pulsing Glow Effect */}
//             <Animated.View
//                 style={{
//                     position: 'absolute',
//                     width: 20,
//                     height: 20,
//                     borderRadius: 10,
//                     backgroundColor: color,
//                     opacity: glowOpacity,
//                     transform: [{ scale: glowScale }],
//                 }}
//             />
//             {/* The Arrow */}
//             <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
//                 <Path
//                     d="M12 2L19 21L12 17L5 21L12 2Z"
//                     fill={color}
//                     stroke="white"
//                     strokeWidth="2"
//                     strokeLinejoin="round"
//                 />
//             </Svg>
//         </View>
//     );
// };

// const ITEM_HEIGHT = 44;
// const VISIBLE_ITEMS = 3;
// const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// const WheelPicker = ({ data, selectedIndex, onSelect, labelExtractor }: {
//     data: any[],
//     selectedIndex: number,
//     onSelect: (index: number) => void,
//     labelExtractor: (item: any) => string
// }) => {
//     const scrollViewRef = useRef<ScrollView>(null);

//     const onMomentumScrollEnd = (event: any) => {
//         const y = event.nativeEvent.contentOffset.y;
//         const index = Math.round(y / ITEM_HEIGHT);
//         onSelect(index);
//     };

//     useEffect(() => {
//         if (scrollViewRef.current && selectedIndex >= 0) {
//             scrollViewRef.current.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
//         }
//     }, []);

//     return (
//         <View style={styles.pickerContainer}>
//             <ScrollView
//                 ref={scrollViewRef}
//                 showsVerticalScrollIndicator={false}
//                 snapToInterval={ITEM_HEIGHT}
//                 snapToAlignment="center"
//                 decelerationRate="fast"
//                 onMomentumScrollEnd={onMomentumScrollEnd}
//                 nestedScrollEnabled={true}
//                 scrollEventThrottle={16}
//             >
//                 {/* Top Padding */}
//                 <View style={{ height: ITEM_HEIGHT }} />

//                 {data.map((item, index) => {
//                     const isSelected = index === selectedIndex;
//                     return (
//                         <TouchableOpacity
//                             key={index}
//                             activeOpacity={0.7}
//                             onPress={() => {
//                                 onSelect(index);
//                                 if (scrollViewRef.current) {
//                                     scrollViewRef.current.scrollTo({
//                                         y: index * ITEM_HEIGHT,
//                                         animated: true
//                                     });
//                                 }
//                             }}
//                             style={[styles.pickerItem, { height: ITEM_HEIGHT }]}
//                         >
//                             <Text style={[
//                                 styles.pickerText,
//                                 isSelected && styles.pickerTextSelected,
//                             ]}>
//                                 {labelExtractor(item)}
//                             </Text>
//                         </TouchableOpacity>
//                     );
//                 })}

//                 {/* Bottom Padding */}
//                 <View style={{ height: ITEM_HEIGHT }} />
//             </ScrollView>
//             <View style={styles.pickerHighlighter} pointerEvents="none" />
//         </View>
//     );
// };

// interface SupervisorModalProps {
//     visible: boolean;
//     onClose: () => void;
// }

// const SupervisorModal: React.FC<SupervisorModalProps> = ({ visible, onClose }) => {
//     const { vehicles } = useDriverData();

//     const { logout } = useAuth();
//     const { open: openReportIncidentModal } = useReportIncidentModal();
//     const { routes, drivers } = useDriverData();

//     const onlyDrivers = drivers.filter(driver => driver.supervisor !== '1');
//     const [polledVehicles, setPolledVehicles] = useState<any[]>([]);
//     const [isAssigning, setIsAssigning] = useState(false);
//     const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState<any>(null);
//     const [viewMode, setViewMode] = useState<'list' | 'assign'>('list');
//     const [showIncomingMessages, setShowIncomingMessages] = useState(false);
//     const { messages: incomingMessages } = useIncomingMessages();

//     // Assignment States
//     const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
//     const [selectedDriverIndex, setSelectedDriverIndex] = useState(0);
//     const [selectedHourIndex, setSelectedHourIndex] = useState(0);
//     const [selectedMinuteIndex, setSelectedMinuteIndex] = useState(0);
//     const [selectedAmPmIndex, setSelectedAmPmIndex] = useState(0);

//     const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
//     const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
//     const ampm = useMemo(() => ['AM', 'PM'], []);

//     useEffect(() => {
//         let interval: NodeJS.Timeout;

//         const fetchData = async () => {
//             const data = await getAllVehicles();
//             console.log('All vehicles======>>>:', data);
//             if (data && data.length > 0) {
//                 setPolledVehicles(data);
//             }
//         };

//         if (visible) {
//             fetchData();
//             interval = setInterval(fetchData, 5000);
//         }

//         return () => {
//             if (interval) clearInterval(interval);
//         };
//     }, [visible]);

//     const handleVehiclePress = (item: any) => {
//         if (item.vehicleNumber === '-') return; // Ignore dummy rows
//         setSelectedVehicleForAssign(item);
//         // const selectedRoute = routes.filter(route => route.routeID === item.routeID)[0];
//         // console.log('route====>>>>', selectedRoute.points);
//         // Initialize assignment time to now
//         const now = new Date();
//         const currentHour = now.getHours();
//         setSelectedHourIndex((currentHour % 12 || 12) - 1);
//         setSelectedMinuteIndex(now.getMinutes());
//         setSelectedAmPmIndex(currentHour >= 12 ? 1 : 0);

//         setViewMode('assign');
//     };

//     const handleAssign = async () => {
//         if (!selectedVehicleForAssign) return;

//         const route = routes[selectedRouteIndex];
//         const driver = drivers[selectedDriverIndex];

//         if (!route || !driver) {
//             onClose();
//             Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a route and driver' });
//             return;
//         }

//         const selectedHour = hours[selectedHourIndex];
//         const selectedMinute = parseInt(minutes[selectedMinuteIndex]);
//         const selectedAmPm = ampm[selectedAmPmIndex];

//         const now = new Date();
//         let h = selectedAmPm === 'PM' ? (selectedHour % 12) + 12 : selectedHour % 12;
//         const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, selectedMinute, 0);
//         const endTimestamp = Math.floor(endDate.getTime() / 1000);

//         setIsAssigning(true);
//         try {
//             const params = {
//                 routeID: route.routeID,
//                 driverID: onlyDrivers[selectedDriverIndex].driverID,
//                 vehicleID: selectedVehicleForAssign.vehicleID,
//                 end: endTimestamp,
//             };

//             const result = await assignVehicle(params);
//             console.log('Assignment result:', result);

//             if (result.success) {
//                 Toast.show({ type: 'success', text1: 'Success', text2: 'Vehicle assigned successfully' });
//                 onClose();
//                 setViewMode('list');
//             } else {
//                 onClose();
//                 Alert.alert('Error', result.message?.errormsg || 'Assignment failed');
//             }
//         } catch (error) {
//             console.error('Assignment catch error:', error);
//             Alert.alert('Error', 'An unexpected error occurred during assignment');
//         } finally {
//             setIsAssigning(false);
//         }
//     };

//     // Create some dummy rows if needed to match the reference look
//     const tableData = useMemo(() => {
//         const list = polledVehicles.length > 0 ? [...polledVehicles] : [...vehicles];
//         while (list.length < 12) {
//             list.push({ vehicleID: `dummy-${list.length}`, vehicleNumber: '-', vehicleName: '-' } as any);
//         }
//         return list;
//     }, [polledVehicles, vehicles]);

//     const renderVehicleItem = ({ item }: { item: any }) => (
//         <TouchableOpacity
//             style={styles.tableRow}
//             onPress={() => handleVehiclePress(item)}
//             activeOpacity={item.vehicleNumber === '-' ? 1 : 0.6}
//         >
//             <Text style={[styles.cell, styles.vehicleCell, { borderRightWidth: 1, borderRightColor: '#EEE' }]}>
//                 {item.vehicleName || item.vehicleNumber}
//             </Text>
//             <Text style={styles.cell}>{item?.routeShortName || '-'}</Text>
//             <Text style={styles.cell}>{item.otp || '-'}</Text>
//             <Text style={[styles.cell, styles.greenText]}>{item?.APCPercentage || (item.vehicleNumber !== '-' ? '0' : '-')}</Text>
//             <Text style={styles.cell}>{item.mph || (item.vehicleNumber !== '-' ? '0' : '-')}</Text>
//         </TouchableOpacity>
//     );

//     return (
//         <Modal
//             visible={visible}
//             animationType="slide"
//             transparent={true}
//             onRequestClose={onClose}
//             supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
//         >
//             <View style={styles.backdrop}>
//                 <TouchableOpacity
//                     activeOpacity={1}
//                     style={StyleSheet.absoluteFill}
//                     onPress={onClose}
//                 />
//                 <View
//                     style={styles.modalCard}
//                     onStartShouldSetResponder={() => true}
//                 >
//                     {/* Main Content Area */}
//                     <View style={styles.topSection}>
//                         {/* Left Column: Map & Messages */}
//                         <View style={styles.mapColumn}>
//                             <View style={[styles.mapContent, showIncomingMessages && { flex: 0.80 }]}>
//                                 <MapView
//                                     provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
//                                     style={styles.map}
//                                     initialRegion={{
//                                         latitude: 45.4215,
//                                         longitude: -75.6972,
//                                         latitudeDelta: 40,
//                                         longitudeDelta: 40,
//                                     }}
//                                 >
//                                     {polledVehicles.map((vehicle) => {
//                                         const lat = parseFloat(vehicle.lat);
//                                         const lng = parseFloat(vehicle.lng);
//                                         if (!isNaN(lat) && !isNaN(lng)) {
//                                             return (
//                                                 <Marker
//                                                     key={vehicle.vehicleID}
//                                                     coordinate={{ latitude: lat, longitude: lng }}
//                                                     anchor={{ x: 0.5, y: 0.5 }}
//                                                     rotation={parseFloat(vehicle.bearing || vehicle.heading) || 0}
//                                                     flat
//                                                     tracksViewChanges={true}
//                                                 >
//                                                     <DirectionalArrow color={COLORS.background} />
//                                                 </Marker>
//                                             );
//                                         }
//                                         return null;
//                                     })}
//                                 </MapView>
//                             </View>

//                             {/* Message Header / Footer (same as given image) */}


//                             {/* Incoming Messages List */}
//                             {showIncomingMessages && (
//                                 <>
//                                     <View style={styles.mapFooter}>
//                                         <Text style={styles.overlayText}>Vehicle</Text>
//                                         <Text style={styles.overlayText}>Driver</Text>
//                                         <Text style={styles.overlayText}>Seconds ago</Text>
//                                     </View>

//                                     <View style={styles.messageListContainer}>
//                                         <FlatList
//                                             data={incomingMessages}
//                                             keyExtractor={(item) => item.messageID}
//                                             renderItem={({ item }) => (
//                                                 <TouchableOpacity
//                                                     style={styles.messageRow}
//                                                     onPress={() => Alert.alert(`Message from ${item.driverName || item.userName || 'Driver'}`, item.message)}
//                                                 >
//                                                     <Text style={[styles.messageCell, { flex: 1 }]}>{item.vehicleName || '-'}</Text>
//                                                     <View style={{ flex: 1 }}>
//                                                         <Text style={styles.messageCell} numberOfLines={1}>{item.userName || item.driverName || '-'}</Text>
//                                                         <Text style={[styles.messageCell, { fontSize: 11, color: '#666' }]} numberOfLines={1}>{item.message}</Text>
//                                                     </View>
//                                                     <Text style={[styles.messageCell, { flex: 1, textAlign: 'right' }]}>
//                                                         {item.secondsAgo ? `${item.secondsAgo}s ago` : 'now'}
//                                                     </Text>
//                                                 </TouchableOpacity>
//                                             )}
//                                             ItemSeparatorComponent={() => <View style={styles.messageSeparator} />}
//                                             showsVerticalScrollIndicator={true}
//                                             ListEmptyComponent={() => (
//                                                 <View style={styles.emptyMessages}>
//                                                     <Text style={styles.emptyText}>No incoming messages</Text>
//                                                 </View>
//                                             )}
//                                         />
//                                     </View>
//                                 </>
//                             )}
//                         </View>

//                         {/* Right Column: Table or Assignment Form */}
//                         <View style={styles.tableColumn}>
//                             {viewMode === 'list' ? (
//                                 <>
//                                     {/* Table Header at TOP */}
//                                     <View style={styles.tableHeader}>
//                                         <Text style={[styles.headerCell, styles.headerCellFirst, { borderRightWidth: 1, borderRightColor: '#999' }]}>Vehicle</Text>
//                                         <View style={styles.activeHeaderCell}>
//                                             <Text style={styles.activeHeaderText}>Route</Text>
//                                         </View>
//                                         <Text style={styles.headerCell}>OTP</Text>
//                                         <Text style={styles.headerCell}>APC%</Text>
//                                         <Text style={styles.headerCell}>MPH</Text>
//                                     </View>

//                                     {/* Table Rows */}
//                                     <FlatList
//                                         data={tableData}
//                                         renderItem={renderVehicleItem}

//                                         keyExtractor={(item, index) => item.vehicleID || index.toString()}
//                                         showsVerticalScrollIndicator={false}
//                                         ItemSeparatorComponent={() => <View style={styles.separator} />}
//                                     />

//                                 </>
//                             ) : (
//                                 <>
//                                     <ScrollView
//                                         style={styles.formContainer}
//                                         contentContainerStyle={{ paddingBottom: 20 }}
//                                         showsVerticalScrollIndicator={false}
//                                     >
//                                         <View style={styles.formHeader}>
//                                             <Text style={styles.formTitle}>{selectedVehicleForAssign?.vehicleName || selectedVehicleForAssign?.vehicleID}</Text>
//                                             <TouchableOpacity onPress={() => setViewMode('list')} style={styles.formCancelBtn}>
//                                                 <Text style={styles.formCancelText}>Cancel</Text>
//                                             </TouchableOpacity>
//                                         </View>

//                                         <Text style={styles.formLabel}>Route</Text>
//                                         <View style={styles.selectorWrapper}>
//                                             <WheelPicker
//                                                 data={routes}
//                                                 selectedIndex={selectedRouteIndex}
//                                                 onSelect={setSelectedRouteIndex}
//                                                 labelExtractor={(item) => item.shortName || item.longName || item.routeID}
//                                             />
//                                         </View>

//                                         <Text style={styles.formLabel}>Driver</Text>
//                                         <View style={styles.selectorWrapper}>
//                                             <WheelPicker
//                                                 data={onlyDrivers}
//                                                 selectedIndex={selectedDriverIndex}
//                                                 onSelect={setSelectedDriverIndex}
//                                                 labelExtractor={(item) => item.driverName || item.driverID}
//                                             />
//                                         </View>

//                                         <Text style={styles.formLabel}>End Time</Text>
//                                         <View style={[styles.selectorWrapper, styles.timePickerRow]}>
//                                             <View style={styles.timeColumn}>
//                                                 <WheelPicker
//                                                     data={hours}
//                                                     selectedIndex={selectedHourIndex}
//                                                     onSelect={setSelectedHourIndex}
//                                                     labelExtractor={(item) => item.toString()}
//                                                 />
//                                             </View>
//                                             <View style={styles.timeColumn}>
//                                                 <WheelPicker
//                                                     data={minutes}
//                                                     selectedIndex={selectedMinuteIndex}
//                                                     onSelect={setSelectedMinuteIndex}
//                                                     labelExtractor={(item) => item}
//                                                 />
//                                             </View>
//                                             <View style={styles.timeColumn}>
//                                                 <WheelPicker
//                                                     data={ampm}
//                                                     selectedIndex={selectedAmPmIndex}
//                                                     onSelect={setSelectedAmPmIndex}
//                                                     labelExtractor={(item) => item}
//                                                 />
//                                             </View>
//                                         </View>
//                                     </ScrollView>

//                                     <View style={styles.assignBtnWrapper}>
//                                         <TouchableOpacity
//                                             style={[styles.assignBtn, isAssigning && { opacity: 0.7 }]}
//                                             onPress={handleAssign}
//                                             disabled={isAssigning}
//                                         >
//                                             {isAssigning ? (
//                                                 <ActivityIndicator color="#FFF" />
//                                             ) : (
//                                                 <Text style={styles.assignBtnText}>Assign</Text>
//                                             )}
//                                         </TouchableOpacity>
//                                     </View>
//                                 </>
//                             )}
//                         </View>
//                     </View>

//                     {/* Bottom Navigation */}
//                     <View style={styles.bottomBar}>
//                         <TouchableOpacity
//                             style={[styles.tabItem, showIncomingMessages && styles.activeTab]}
//                             onPress={() => setShowIncomingMessages(!showIncomingMessages)}
//                         >
//                             <MaterialIcons
//                                 name="chat-bubble-outline"
//                                 size={32}
//                                 color={showIncomingMessages ? COLORS.primary : "#FFF"}
//                                 style={{ opacity: showIncomingMessages ? 1 : 0.7 }}
//                             />
//                             <Text style={[styles.tabLabel, showIncomingMessages && { color: COLORS.primary }]}>Messages</Text>
//                         </TouchableOpacity>

//                         <TouchableOpacity
//                             style={styles.tabItem}
//                             onPress={() => {
//                                 onClose(); // Close supervisor modal first
//                                 openReportIncidentModal();
//                             }}
//                         >
//                             <MaterialIcons name="assignment" size={32} color="#FFF" style={{ opacity: 0.7 }} />
//                             <Text style={styles.tabLabel}>Report Incident</Text>
//                         </TouchableOpacity>

//                         {/* The empty middle gap from the reference image */}
//                         <View style={styles.tabSpacer} />

//                         <TouchableOpacity
//                             onPress={() => {
//                                 onClose();
//                             }}
//                             style={[styles.tabItem, styles.activeTab]}>
//                             <MaterialIcons name="speed" size={32} color="#FFF" />
//                             <Text style={styles.tabLabel}>Dashboard</Text>
//                         </TouchableOpacity>

//                         <TouchableOpacity style={styles.tabItem} onPress={() => { logout(); onClose(); }}>
//                             <MaterialCommunityIcons name="lock-outline" size={32} color="#FFF" />
//                             <Text style={styles.tabLabel}>Logout</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>
//             </View>
//         </Modal>
//     );
// };

// const styles = StyleSheet.create({
//     backdrop: {
//         flex: 1,
//         backgroundColor: 'rgba(0, 0, 0, 0.75)',
//         justifyContent: 'center',
//         alignItems: 'center',
//         padding: 30,
//     },
//     modalCard: {
//         width: '100%',
//         maxWidth: 900,
//         height: '95%',
//         maxHeight: 650,
//         backgroundColor: '#FFF',
//         borderRadius: 8,
//         overflow: 'hidden',
//         elevation: 10,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 10 },
//         shadowOpacity: 0.5,
//         shadowRadius: 15,
//     },
//     topSection: {
//         flex: 1,
//         flexDirection: 'row',
//     },
//     mapColumn: {
//         flex: 0.95, // Map column is slightly narrower
//         borderRightWidth: 1,
//         borderRightColor: '#BBB',
//     },
//     mapContent: {
//         flex: 1,
//     },
//     map: {
//         ...StyleSheet.absoluteFillObject,
//     },
//     mapFooter: {
//         height: 36,
//         backgroundColor: '#ADADAD',
//         flexDirection: 'row',
//         alignItems: 'center',
//         paddingHorizontal: 20,
//         borderTopWidth: 1,
//         borderTopColor: '#999',
//     },
//     overlayText: {
//         flex: 1,
//         fontSize: 14,
//         fontWeight: '700',
//         color: '#333',
//         textAlign: 'center',
//     },
//     messageListContainer: {
//         flex: 0.15,
//         backgroundColor: '#FFF',
//     },
//     messageListHeader: {
//         flexDirection: 'row',
//         height: 20,
//         backgroundColor: '#E0E0E0',
//         alignItems: 'center',
//         paddingHorizontal: 20,
//         borderBottomWidth: 1,
//         borderBottomColor: '#CCC',
//     },
//     messageHeaderCell: {
//         flex: 1,
//         fontSize: 13,
//         color: '#333',
//         textAlign: 'center',
//         fontWeight: '600',
//     },
//     messageRow: {
//         flexDirection: 'row',
//         paddingVertical: 8,
//         paddingHorizontal: 20,
//         alignItems: 'center',
//     },
//     messageCell: {
//         fontSize: 14,
//         color: '#444',
//         textAlign: 'center',
//     },
//     messageSeparator: {
//         height: 1,
//         backgroundColor: '#EEE',
//     },
//     emptyMessages: {
//         padding: 40,
//         alignItems: 'center',
//     },
//     emptyText: {
//         color: '#999',
//         fontSize: 14,
//     },
//     tableColumn: {
//         flex: 1,
//         backgroundColor: '#FFF',
//     },
//     tableHeader: {
//         flexDirection: 'row',
//         height: 48,
//         backgroundColor: '#ADADAD',
//         alignItems: 'center',
//     },
//     headerCell: {
//         flex: 1,
//         fontSize: 15,
//         color: '#000',
//         textAlign: 'center',
//         fontWeight: '600',
//     },
//     headerCellFirst: {
//         fontWeight: '700',
//     },
//     activeHeaderCell: {
//         flex: 1,
//         backgroundColor: '#000',
//         height: '65%',
//         justifyContent: 'center',
//         alignItems: 'center',
//         borderRadius: 2,
//         marginHorizontal: 5,
//     },
//     activeHeaderText: {
//         color: '#FFF',
//         fontSize: 12,
//         fontWeight: 'bold',
//         textTransform: 'none',
//     },
//     tableRow: {
//         flexDirection: 'row',
//         height: 52,
//         alignItems: 'center',
//     },
//     cell: {
//         flex: 1,
//         fontSize: 14,
//         color: '#444',
//         textAlign: 'center',
//     },
//     vehicleCell: {
//         color: '#222',
//     },
//     greenText: {
//         color: '#30AD4F',
//         fontWeight: '700',
//     },
//     separator: {
//         height: 1,
//         backgroundColor: '#EEE',
//     },
//     bottomBar: {
//         height: 100,
//         backgroundColor: '#383838', // Exact shade from reference
//         flexDirection: 'row',
//         alignItems: 'center',
//         paddingHorizontal: 0,
//     },
//     tabItem: {
//         flex: 1,
//         alignItems: 'center',
//         justifyContent: 'center',
//         height: '100%',
//     },
//     activeTab: {
//         backgroundColor: '#525252',
//     },
//     tabSpacer: {
//         flex: 1, // Full middle slot is empty
//     },
//     tabLabel: {
//         color: '#BEBEBE',
//         fontSize: 13,
//         marginTop: 6,
//         fontWeight: '500',
//     },
//     // Assignment Form Styles
//     formContainer: {
//         flex: 1,
//         padding: 20,
//         backgroundColor: '#FFF',
//     },
//     formHeader: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         marginBottom: 15,
//     },
//     formTitle: {
//         fontSize: 16,
//         fontWeight: 'bold',
//         color: '#333',
//     },
//     formCancelBtn: {
//         padding: 8,
//     },
//     formCancelText: {
//         color: '#E11D48',
//         fontSize: 16,
//         fontWeight: '600',
//     },
//     formLabel: {
//         fontSize: 16,
//         color: '#666',
//         marginBottom: 6,
//         fontWeight: '500',
//     },
//     selectorWrapper: {
//         height: PICKER_HEIGHT,
//         backgroundColor: '#F9FAFB',
//         borderRadius: 8,
//         overflow: 'hidden',
//         marginBottom: 12,
//         borderWidth: 1,
//         borderColor: '#E5E7EB',
//     },
//     pickerContainer: {
//         flex: 1,
//     },
//     pickerItem: {
//         justifyContent: 'center',
//         alignItems: 'center',
//     },
//     pickerText: {
//         fontSize: 16,
//         color: '#9CA3AF',
//     },
//     pickerTextSelected: {
//         color: '#111827',
//         fontWeight: 'bold',
//         fontSize: 18,
//     },
//     pickerHighlighter: {
//         position: 'absolute',
//         top: ITEM_HEIGHT,
//         left: 0,
//         right: 0,
//         height: ITEM_HEIGHT,
//         backgroundColor: 'rgba(59, 130, 246, 0.1)',
//         borderTopWidth: 1,
//         borderBottomWidth: 1,
//         borderColor: 'rgba(59, 130, 246, 0.3)',
//     },
//     timePickerRow: {
//         flexDirection: 'row',
//     },
//     timeColumn: {
//         flex: 1,
//     },
//     assignBtnWrapper: {
//         padding: 20,
//         borderTopWidth: 1,
//         borderTopColor: '#EEE',
//     },
//     assignBtn: {
//         backgroundColor: COLORS.headerBlue,
//         height: 50,
//         borderRadius: 25,
//         justifyContent: 'center',
//         alignItems: 'center',
//     },
//     assignBtnText: {
//         color: '#FFF',
//         fontSize: 16,
//         fontWeight: '700',
//     },
// });


// export default SupervisorModal;





import React, { useMemo, useState, useRef, useEffect } from 'react';
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
    Animated,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import Svg, { Path } from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../theme/colors';
import { useDriverData } from '@/context/DriverDataContext';
import { useAuth } from '@/context/AuthContext';
import { useReportIncidentModal } from '@/context/ReportIncidentModalContext';
import { assignVehicle, getAllVehicles } from '@/api/vehicle.api';
import { useIncomingMessages } from '@/context/IncomingMessagesContext';
import Toast from 'react-native-toast-message';

const DirectionalArrow = ({ color }: { color: string }) => {
    const heartbeat = useRef(new Animated.Value(1)).current;

    // useEffect(() => {
    //     Animated.loop(
    //         Animated.sequence([
    //             Animated.timing(heartbeat, { toValue: 1, duration: 100, useNativeDriver: true }),
    //             Animated.timing(heartbeat, { toValue: 0.15, duration: 400, useNativeDriver: true }),
    //             Animated.timing(heartbeat, { toValue: 1, duration: 100, useNativeDriver: true }),
    //             Animated.timing(heartbeat, { toValue: 0.15, duration: 400, useNativeDriver: true }),
    //             Animated.timing(heartbeat, { toValue: 1, duration: 100, useNativeDriver: true }),
    //             Animated.delay(700),
    //         ])
    //     ).start();
    // }, [heartbeat]);

    return (
        <Animated.View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center', opacity: heartbeat }}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path
                    d="M12 2L19 21L12 17L5 21L12 2Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
            </Svg>
        </Animated.View>
    );
};

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
    const { vehicles } = useDriverData();

    const { logout } = useAuth();
    const { open: openReportIncidentModal } = useReportIncidentModal();
    const { routes, drivers, stops } = useDriverData();

    const onlyDrivers = drivers.filter(driver => driver.supervisor !== '1');
    const [polledVehicles, setPolledVehicles] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'list' | 'assign'>('list');
    const [showIncomingMessages, setShowIncomingMessages] = useState(false);
    const [routeStops, setRouteStop] = useState<any[]>([]);
    const [routeColor, setRouteColor] = useState<string>('');
    const [selectedRoutePoints, setSelectedRoutePoints] = useState<{ latitude: number, longitude: number }[]>([]);
    const mapRef = useRef<MapView>(null);

    const parseRoutePoints = (pointsStr: any): { latitude: number, longitude: number }[] => {
        if (!pointsStr || typeof pointsStr !== 'string') return [];
        try {
            // Robust parsing: find all floating point numbers
            const coords = pointsStr.match(/-?\d+\.\d+/g);
            if (!coords || coords.length < 2) return [];

            const result = [];
            for (let i = 0; i < coords.length; i += 2) {
                if (coords[i + 1]) {
                    result.push({
                        latitude: parseFloat(coords[i]),
                        longitude: parseFloat(coords[i + 1]),
                    });
                }
            }
            return result;
        } catch (e) {
            console.error('Error parsing points string:', e);
            return [];
        }
    };

    // Assignment States
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
    const [selectedDriverIndex, setSelectedDriverIndex] = useState(0);
    const [selectedHourIndex, setSelectedHourIndex] = useState(0);
    const [selectedMinuteIndex, setSelectedMinuteIndex] = useState(0);
    const [selectedAmPmIndex, setSelectedAmPmIndex] = useState(0);


    const { messages: incomingMessages } = useIncomingMessages();

    // Effect to update points when route selection changes in assign mode
    useEffect(() => {
        if (viewMode === 'assign' && routes[selectedRouteIndex]) {
            const route = routes[selectedRouteIndex];
            const parsed = parseRoutePoints(route.points);
            setRouteColor(String(route.color));
            setSelectedRoutePoints(parsed);

            if (parsed.length > 0 && mapRef.current) {
                mapRef.current.fitToCoordinates(parsed, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }
        } else if (viewMode === 'list') {
            setSelectedRoutePoints([]);
        }
    }, [selectedRouteIndex, viewMode, routes]);

    const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')), []);
    const ampm = useMemo(() => ['AM', 'PM'], []);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const fetchData = async () => {
            const data = await getAllVehicles();

            if (data && data.length > 0) {
                setPolledVehicles(data);
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
        const selectedRoute = routes.find(route => route.routeID === item.routeID);



        if (selectedRoute) {

            const filteredStops = stops.filter(stop =>
                selectedRoute?.routeStops.includes(stop.stopID)
            );
            console.log('filteredStops====>>>>', filteredStops);
            setRouteStop(filteredStops);
            const parsedPoints = parseRoutePoints(selectedRoute.points);
            setSelectedRoutePoints(parsedPoints);

            // Set the route index in the picker
            const rIdx = routes.findIndex(r => r.routeID === item.routeID);
            if (rIdx !== -1) {
                setSelectedRouteIndex(rIdx);
            }

            if (parsedPoints.length > 0 && mapRef.current) {
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates(parsedPoints, {
                        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                        animated: true,
                    });
                }, 500);
            }
        } else {
            setSelectedRoutePoints([]);
        }

        console.log('route====>>>>', selectedRoute?.points);
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

        const route = routes[selectedRouteIndex];
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
                Alert.alert('Error', result.message?.errormsg || 'Assignment failed');
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
            <Text style={styles.cell}>{item.speed || (item.vehicleNumber !== '-' ? '0' : '-')}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
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
                                <MapView
                                    ref={mapRef}
                                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                                    style={styles.map}
                                    initialRegion={{
                                        latitude: 45.4215,
                                        longitude: -75.6972,
                                        latitudeDelta: 40,
                                        longitudeDelta: 40,
                                    }}
                                >
                                    {selectedRoutePoints.length > 0 && (
                                        <Polyline
                                            coordinates={selectedRoutePoints}
                                            strokeColor={`#${routeColor}` || COLORS.primary}
                                            strokeWidth={4}
                                            lineJoin="round"
                                            lineCap="round"
                                        />
                                    )}
                                    {/* Route stop markers */}
                                    {routeStops.map((stop) => {
                                        const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat);
                                        const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng);
                                        if (isNaN(lat) || isNaN(lng)) return null;
                                        // return (
                                        //     <Marker
                                        //         key={`stop-${stop.stopID}`}
                                        //         coordinate={{ latitude: lat, longitude: lng }}
                                        //         anchor={{ x: 0.5, y: 1 }}
                                        //         title={stop.longName || `Stop ${stop.stopID}`}
                                        //         description={`Stop ID: ${stop.stopID}`}
                                        //     >

                                        //         <View style={styles.stopMarker}>
                                        //             <MaterialIcons name="directions-bus" size={14} color="#FFF" />
                                        //         </View>
                                        //     </Marker>
                                        // );
                                    })}
                                    {polledVehicles.map((vehicle) => {
                                        const lat = parseFloat(vehicle.lat);
                                        const lng = parseFloat(vehicle.lng);
                                        if (!isNaN(lat) && !isNaN(lng)) {
                                            return (
                                                <Marker
                                                    key={vehicle.vehicleID}
                                                    coordinate={{ latitude: lat, longitude: lng }}
                                                    anchor={{ x: 0.5, y: 0.5 }}
                                                    rotation={parseFloat(vehicle.bearing || vehicle.heading) || 0}
                                                    flat
                                                    tracksViewChanges={true}
                                                >
                                                    <DirectionalArrow color={COLORS.background} />
                                                </Marker>
                                            );
                                        }
                                        return null;
                                    })}
                                </MapView>
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
                                                setSelectedRoutePoints([])
                                                setRouteStop([])
                                                // setSelectedVehicleForAssign(null)
                                                setSelectedRouteIndex(0)
                                                // setSelectedDriverIndex(0)
                                                setViewMode('list')

                                            }} style={styles.formCancelBtn}>
                                                <Text style={styles.formCancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.formLabel}>Route</Text>
                                        <View style={styles.selectorWrapper}>
                                            <WheelPicker
                                                data={routes}
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
                                // onClose(); // Close supervisor modal first
                                openReportIncidentModal();
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
        maxWidth: '90%',
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
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.headerBlue ?? '#1D4ED8',
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
