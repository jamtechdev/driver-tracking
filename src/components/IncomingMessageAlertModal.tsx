/**
 * Incoming Message Alert Modal - Displays messages arriving from the backend
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useDriverMessaging } from '../context/DriverMessagingContext';

const IncomingMessageAlertModal: React.FC = () => {
    const { activeAlert, dismissAlert } = useDriverMessaging();

    if (!activeAlert) return null;

    return (
        <Modal
            visible={!!activeAlert}
            transparent
            animationType="slide"
            onRequestClose={dismissAlert}
            statusBarTranslucent={Platform.OS === 'android'}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="message" size={24} color={COLORS.primary} />
                        </View>
                        <Text style={styles.title}>New Message Received</Text>
                    </View>

                    <View style={styles.body}>
                        <Text style={styles.messageText}>{activeAlert?.message || 'No message'}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={dismissAlert}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.closeButtonText}>Close Alert</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: '70%',
        backgroundColor: COLORS.backgroundSecondary || '#1F242C',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(215, 0, 4, 0.1)', // Assuming primary is reddish
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    body: {
        marginBottom: 24,
        minHeight: 80,
        justifyContent: 'center',
    },
    messageText: {
        fontSize: 24,
        lineHeight: 32,
        color: '#FFFFFF',
        fontWeight: '600',
        textAlign: 'center',
    },
    closeButton: {
        width: '100%',
        height: 56,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default IncomingMessageAlertModal;
