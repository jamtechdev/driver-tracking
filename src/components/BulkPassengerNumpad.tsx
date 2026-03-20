/**
 * BulkPassengerNumpad
 *
 * A bottom-sheet numeric keypad modal for bulk passenger entry.
 * Press-and-hold the board / alight buttons to open it.
 *
 * Props:
 *  visible   – whether the modal is shown
 *  mode      – 'board' | 'alight'
 *  onConfirm – called with the entered count when the driver confirms
 *  onClose   – called when the modal is dismissed without confirming
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export type NumpadMode = 'board' | 'alight';

interface BulkPassengerNumpadProps {
    visible: boolean;
    mode: NumpadMode;
    onConfirm: (count: number) => void;
    onClose: () => void;
}

const ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['CLOSE', '0', '⌫'],
];

const BulkPassengerNumpad: React.FC<BulkPassengerNumpadProps> = ({
    visible,
    mode,
    onConfirm,
    onClose,
}) => {
    const [value, setValue] = useState('');

    // Reset display whenever the modal opens
    useEffect(() => {
        if (visible) setValue('');
    }, [visible]);

    const handleKey = (key: string) => {
        if (key === '⌫') {
            setValue(prev => prev.slice(0, -1));
        } else {
            setValue(prev => {
                const next = prev + key;
                return next.length > 3 ? prev : next; // cap at 3 digits (max 999)
            });
        }
    };

    const handleConfirm = () => {
        const count = parseInt(value, 10);
        if (!isNaN(count) && count > 0) {
            onConfirm(count);
        }
        onClose();
    };

    const isBoard = mode === 'board';
    const displayCount = value === '' ? '0' : value;
    const confirmDisabled = !value || value === '0';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
            supportedOrientations={[
                'portrait',
                'portrait-upside-down',
                'landscape-left',
                'landscape-right',
            ]}
        >
            {/* Tap outside to dismiss */}
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => { }}>

                    {/* ── Header ── */}
                    <View style={styles.header}>
                        {/* Close button */}
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>

                        <View style={[styles.modeBadge, isBoard ? styles.modeBadgeBoard : styles.modeBadgeAlight]}>
                            <MaterialIcons
                                name={isBoard ? 'person-add-alt-1' : 'person-remove'}
                                size={18}
                                color="#FFF"
                            />
                            <Text style={styles.modeBadgeText}>
                                {isBoard ? 'Boarding' : 'Alighting'}
                            </Text>
                        </View>
                        <Text style={styles.title}>Bulk Passenger Entry</Text>
                        <Text style={styles.hint}>Hold a button to open this pad, then confirm</Text>
                    </View>

                    {/* ── Display ── */}
                    <View style={styles.display}>
                        <Text style={styles.displayText}>{displayCount}</Text>
                        <Text style={styles.displayLabel}>passengers</Text>
                    </View>

                    {/* ── Keys ── */}
                    {ROWS.map((row, ri) => (
                        <View key={ri} style={styles.row}>
                            {row.map((key, ki) =>
                                key === 'CLOSE' ? (
                                    <TouchableOpacity
                                        key={ki}
                                        style={[styles.key, styles.keyClose]}
                                        onPress={onClose}
                                        activeOpacity={0.6}
                                    >
                                        <MaterialIcons name="arrow-back" size={24} color="rgba(255,255,255,0.6)" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        key={ki}
                                        style={[styles.key, key === '⌫' && styles.keyBackspace]}
                                        onPress={() => handleKey(key)}
                                        activeOpacity={0.6}
                                    >
                                        <Text style={[styles.keyText, key === '⌫' && styles.keyBackspaceText]}>
                                            {key}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    ))}

                    {/* ── Confirm ── */}
                    <TouchableOpacity
                        style={[
                            styles.confirmBtn,
                            isBoard ? styles.confirmBoard : styles.confirmAlight,
                            confirmDisabled && styles.confirmDisabled,
                        ]}
                        onPress={handleConfirm}
                        disabled={confirmDisabled}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons
                            name={isBoard ? 'person-add-alt-1' : 'person-remove'}
                            size={22}
                            color="#FFF"
                        />
                        <Text style={styles.confirmText}>
                            {isBoard
                                ? `Board ${displayCount} Passenger${displayCount === '1' ? '' : 's'}`
                                : `Alight ${displayCount} Passenger${displayCount === '1' ? '' : 's'}`}
                        </Text>
                    </TouchableOpacity>

                </Pressable>
            </Pressable>
        </Modal>
    );
};

export default BulkPassengerNumpad;

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1C2230',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingBottom: 36,
        paddingTop: 20,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 20,
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
        paddingTop: 8,
    },
    closeBtn: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 10,
    },
    modeBadgeBoard: {
        backgroundColor: '#166534',
    },
    modeBadgeAlight: {
        backgroundColor: '#7F1D1D',
    },
    modeBadgeText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
        marginBottom: 4,
    },
    hint: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
    },

    // Display
    display: {
        alignItems: 'center',
        backgroundColor: '#252D3D',
        borderRadius: 14,
        paddingVertical: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    displayText: {
        color: '#FFFFFF',
        fontSize: 52,
        fontWeight: '200',
        letterSpacing: 2,
        lineHeight: 58,
    },
    displayLabel: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 13,
        marginTop: 2,
    },

    // Keypad grid
    row: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    key: {
        flex: 1,
        height: 64,
        backgroundColor: '#2A3448',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    keyEmpty: {
        flex: 1,
        height: 64,
    },
    keyClose: {
        backgroundColor: '#252D3D',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    keyBackspace: {
        backgroundColor: '#3D2020',
    },
    keyText: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '400',
    },
    keyBackspaceText: {
        color: '#F87171',
        fontSize: 22,
    },

    // Confirm button
    confirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 60,
        borderRadius: 16,
        marginTop: 6,
    },
    confirmBoard: {
        backgroundColor: '#16A34A',
    },
    confirmAlight: {
        backgroundColor: '#DC2626',
    },
    confirmDisabled: {
        opacity: 0.35,
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
