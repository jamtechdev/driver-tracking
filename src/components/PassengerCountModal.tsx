import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
    Platform,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useDriverData } from '@/context/DriverDataContext';
import { useAuth } from '@/context/AuthContext';
import { useMapLocation } from '@/context/MapLocationContext';
import { postPassengerEvent } from '@/api/passengerEvent.api';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import BulkPassengerNumpad, { NumpadMode } from './BulkPassengerNumpad';


interface PassengerCountModalProps {
    visible: boolean;
    onClose: () => void;
    // onSubmit: (embarking: number, disembarking: number) => void;
}

const PassengerCountModal: React.FC<PassengerCountModalProps> = ({
    visible,
    onClose,
    // onSubmit,
}) => {
    const [embarking, setEmbarking] = useState(0);
    const [disembarking, setDisembarking] = useState(0);
    const [selectedFareCategoryId, setSelectedFareCategoryId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { fareCategories } = useDriverData();
    const { vehicleId, setPassengerCount } = useAuth();
    const { location, heading } = useMapLocation();

    // Numpad state
    const [numpadVisible, setNumpadVisible] = useState(false);
    const [numpadMode, setNumpadMode] = useState<NumpadMode>('board');

    // Reset counts when modal opens
    useEffect(() => {
        if (visible) {
            setEmbarking(0);
            setDisembarking(0);
            setSelectedFareCategoryId(null);
            setIsSubmitting(false);
        }
    }, [visible]);

    const selectedCategory = fareCategories.find(c => c.fareCategoryID === selectedFareCategoryId);
    const canSubmit = selectedFareCategoryId !== null && !isSubmitting && (embarking > 0 || disembarking > 0);

    const handleSubmit = async () => {
        if (!canSubmit || !selectedCategory) return;

        const eventTimestamp = Math.floor(Date.now() / 1000);
        const lat = location?.latitude ?? 0;
        const lng = location?.longitude ?? 0;
        const course = heading ?? 0;
        // speed from geolocation is in m/s, convert to MPH (1 m/s = 2.23694 mph)
        const speedMPH = (location?.speed ?? 0) * 2.23694;
        const eventFare = selectedCategory.title;
        const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);
        const vehicleID = vehicleId ?? '0';

        setIsSubmitting(true);
        try {
            // Fire embarking event if count > 0 (Positive for boarding)
            if (embarking > 0) {
                await postPassengerEvent({
                    agencyID,
                    vehicleID,
                    eventTimestamp,
                    eventCount: embarking,
                    lat,
                    lng,
                    course,
                    speed: speedMPH,
                    eventFare,
                });
                setPassengerCount(prev => prev + embarking);
            }
            // Fire disembarking event if count > 0 (Negative for alighting)
            if (disembarking > 0) {
                await postPassengerEvent({
                    agencyID,
                    vehicleID,
                    eventTimestamp,
                    eventCount: -disembarking,
                    lat,
                    lng,
                    course,
                    speed: speedMPH,
                    eventFare,
                })
                setPassengerCount(prev => prev - disembarking);
            }
        } catch (err) {
            console.warn('[PassengerCountModal] passengerEvent API error:', err);
        } finally {
            setIsSubmitting(false);
        }

        // onSubmit(embarking, disembarking);
        onClose();
    };

    const incrementEmbarking = () => setEmbarking(prev => prev + 1);
    const decrementEmbarking = () => setEmbarking(prev => Math.max(0, prev - 1));

    const incrementDisembarking = () => setDisembarking(prev => prev + 1);
    const decrementDisembarking = () => setDisembarking(prev => Math.max(0, prev - 1));

    const handleLongPressEmbarking = () => {
        setNumpadMode('board');
        setNumpadVisible(true);
    };

    const handleLongPressDisembarking = () => {
        setNumpadMode('alight');
        setNumpadVisible(true);
    };

    const handleNumpadConfirm = (count: number) => {
        if (numpadMode === 'board') {
            setEmbarking(count);
        } else {
            setDisembarking(count);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Passenger Count</Text>

                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>


                        {/* Fare Categories */}

                    </View>
                    {fareCategories.length > 0 && (
                        <View style={styles.fareCategorySection}>
                            <Text style={styles.fareCategoryLabel}>Fare Category</Text>
                            <FlatList
                                data={fareCategories}
                                keyExtractor={(item) => String(item.fareCategoryID)}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.fareCategoryList}
                                renderItem={({ item }) => {
                                    const isSelected = selectedFareCategoryId === item.fareCategoryID;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.fareChip,
                                                isSelected && styles.fareChipSelected,
                                            ]}
                                            onPress={() =>
                                                setSelectedFareCategoryId(
                                                    isSelected ? null : item.fareCategoryID
                                                )
                                            }
                                            activeOpacity={0.75}
                                        >
                                            <Text
                                                style={[
                                                    styles.fareChipText,
                                                    isSelected && styles.fareChipTextSelected,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.title}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}

                    {/* Body */}
                    <View style={styles.body}>
                        {/* Embarking Row (Green) */}
                        <View style={styles.countRow}>
                            <View style={[styles.mainButton, styles.mainButtonGreen]}>
                                <View style={styles.mainButtonLeft}>
                                    <MaterialIcons name="person-add" size={24} color="#000" />
                                    <Text style={styles.mainButtonText}>Embarking</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.touchableArea}
                                    onPress={incrementEmbarking}
                                    onLongPress={handleLongPressEmbarking}
                                    delayLongPress={600}
                                    activeOpacity={0.7}
                                />
                            </View>

                            <View style={styles.controlsRight}>
                                <View style={styles.countDisplay}>
                                    <Text style={[styles.countText, { color: '#4ADE80' }]}>{embarking}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.smallButton, styles.borderGreen]}
                                    onPress={decrementEmbarking}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons name="person-remove" size={24} color="#4ADE80" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Disembarking Row (Yellow) */}
                        <View style={styles.countRow}>
                            <View style={[styles.mainButton, styles.mainButtonYellow]}>
                                <View style={styles.mainButtonLeft}>
                                    <MaterialIcons name="person-add" size={24} color="#000" />
                                    <Text style={styles.mainButtonText}>Disembarking</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.touchableArea}
                                    onPress={incrementDisembarking}
                                    onLongPress={handleLongPressDisembarking}
                                    delayLongPress={600}
                                    activeOpacity={0.7}
                                />
                            </View>

                            <View style={styles.controlsRight}>
                                <View style={styles.countDisplay}>
                                    <Text style={[styles.countText, { color: '#FACC15' }]}>{disembarking}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.smallButton, styles.borderYellow]}
                                    onPress={decrementDisembarking}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons name="person-remove" size={24} color="#FACC15" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>



                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            activeOpacity={canSubmit ? 0.8 : 1}
                            disabled={!canSubmit}
                        >
                            {isSubmitting
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Text style={styles.submitButtonText}>Submit</Text>
                            }
                        </TouchableOpacity>

                        <View style={styles.summaryContainer}>
                            <View style={[styles.summaryRow, { backgroundColor: '#4ADE80' }]}>
                                <Text style={styles.summaryCount}>{embarking}</Text>
                                <Text style={styles.summaryLabel}>EMBARKING</Text>
                            </View>

                            <View style={[styles.summaryRow, { backgroundColor: '#FACC15', marginTop: 8 }]}>
                                <Text style={styles.summaryCount}>{disembarking}</Text>
                                <Text style={styles.summaryLabel}>DISEMBARKING</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <BulkPassengerNumpad
                visible={numpadVisible}
                mode={numpadMode}
                onConfirm={handleNumpadConfirm}
                onClose={() => setNumpadVisible(false)}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 600,
        backgroundColor: '#4B5563', // Gray-600 ish
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#6B7280',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#9CA3AF',
    },
    closeBtn: {
        padding: 4,
        marginTop: 2,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#D1D5DB',
    },
    body: {
        padding: 16,
        paddingBottom: 16,
        gap: 16,
        borderBottomWidth: 0,
    },
    fareCategorySection: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        marginTop: 10

    },
    fareCategoryLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#D1D5DB',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    fareCategoryList: {
        gap: 8,
        paddingVertical: 2,
    },
    fareChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#6B7280',
        backgroundColor: '#374151',
    },
    fareChipSelected: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    fareChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D1D5DB',
    },
    fareChipTextSelected: {
        color: '#FFFFFF',
    },
    countRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        height: 60,
        gap: 12,
    },
    mainButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    touchableArea: {
        ...StyleSheet.absoluteFillObject,
    },
    mainButtonGreen: {
        backgroundColor: '#4ADE80', // Green-400
    },
    mainButtonYellow: {
        backgroundColor: '#FACC15', // Yellow-400
    },
    mainButtonLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
    },
    mainButtonText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#000',
    },
    controlsRight: {
        flexDirection: 'row',
        gap: 8,
    },
    countDisplay: {
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        borderRadius: 4,
    },
    countText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    smallButton: {
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 4,
    },
    borderGreen: {
        borderColor: '#4ADE80',
    },
    borderYellow: {
        borderColor: '#FACC15',
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    submitButton: {
        backgroundColor: '#3B82F6', // Blue-500
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 4,
        minWidth: 120,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: '#6B7280',
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    summaryContainer: {
        minWidth: 200,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4,
        gap: 16,
    },
    summaryCount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        width: 30,
        textAlign: 'right',
    },
    summaryLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
});

export default PassengerCountModal;
