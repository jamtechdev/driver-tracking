/**
 * Incoming Message Alert Modal - Displays messages arriving from the backend
 */

import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useDriverMessaging } from '../context/DriverMessagingContext';

const IncomingMessageAlertModal: React.FC = () => {
    const { activeAlert, dismissAlert } = useDriverMessaging();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const layout = useMemo(() => {
        const isCompact = screenWidth < 400;
        const horizontalPadding = isCompact ? 16 : 24;
        const modalWidth = Math.min(screenWidth - horizontalPadding * 2, screenWidth * 0.92, 520);
        const modalMaxHeight = screenHeight * 0.75;

        return {
            isCompact,
            horizontalPadding,
            modalWidth,
            modalMaxHeight,
            bodyMaxHeight: Math.min(screenHeight * 0.38, 280),
            titleSize: isCompact ? 17 : screenWidth >= 768 ? 22 : 20,
            messageSize: isCompact ? 18 : screenWidth >= 768 ? 24 : 22,
            messageLineHeight: isCompact ? 26 : screenWidth >= 768 ? 32 : 30,
            contentPadding: isCompact ? 16 : 24,
            iconSize: isCompact ? 20 : 24,
            iconBox: isCompact ? 40 : 44,
        };
    }, [screenWidth, screenHeight]);

    const styles = useMemo(
        () =>
            createStyles({
                modalWidth: layout.modalWidth,
                modalMaxHeight: layout.modalMaxHeight,
                bodyMaxHeight: layout.bodyMaxHeight,
                titleSize: layout.titleSize,
                messageSize: layout.messageSize,
                messageLineHeight: layout.messageLineHeight,
                contentPadding: layout.contentPadding,
                iconSize: layout.iconSize,
                iconBox: layout.iconBox,
                horizontalPadding: layout.horizontalPadding,
            }),
        [layout]
    );

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
                            <MaterialIcons name="message" size={layout.iconSize} color={COLORS.primary} />
                        </View>
                        <Text style={styles.title} numberOfLines={3}>
                            New Message Received
                        </Text>
                    </View>

                    <ScrollView
                        style={styles.bodyScroll}
                        contentContainerStyle={styles.bodyContent}
                        showsVerticalScrollIndicator
                        bounces={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={styles.messageText}>
                            {activeAlert?.message || 'No message'}
                        </Text>
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={dismissAlert}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.closeButtonText} numberOfLines={1}>
                            Close Alert
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

type StyleParams = {
    modalWidth: number;
    modalMaxHeight: number;
    bodyMaxHeight: number;
    titleSize: number;
    messageSize: number;
    messageLineHeight: number;
    contentPadding: number;
    iconSize: number;
    iconBox: number;
    horizontalPadding: number;
};

const createStyles = ({
    modalWidth,
    modalMaxHeight,
    bodyMaxHeight,
    titleSize,
    messageSize,
    messageLineHeight,
    contentPadding,
    iconBox,
    horizontalPadding,
}: StyleParams) =>
    StyleSheet.create({
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: horizontalPadding,
        },
        modalContent: {
            width: modalWidth,
            maxWidth: '100%',
            maxHeight: modalMaxHeight,
            backgroundColor: COLORS.backgroundSecondary || '#1F242C',
            borderRadius: 20,
            padding: contentPadding,
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
            marginBottom: 16,
            gap: 12,
            width: '100%',
        },
        iconContainer: {
            width: iconBox,
            height: iconBox,
            borderRadius: 12,
            backgroundColor: 'rgba(215, 0, 4, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
        },
        title: {
            flex: 1,
            flexShrink: 1,
            fontSize: titleSize,
            lineHeight: titleSize + 6,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        bodyScroll: {
            maxHeight: bodyMaxHeight,
            marginBottom: 20,
            width: '100%',
        },
        bodyContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: 4,
        },
        messageText: {
            fontSize: messageSize,
            lineHeight: messageLineHeight,
            color: '#FFFFFF',
            fontWeight: '600',
            textAlign: 'center',
            width: '100%',
        },
        closeButton: {
            width: '100%',
            minHeight: 52,
            paddingVertical: 14,
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
