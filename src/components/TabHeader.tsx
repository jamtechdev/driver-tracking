import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, PanResponder, useWindowDimensions, Modal, TextInput, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useEmergency } from '../context/EmergencyContext';
import { useReportIncidentModal } from '../context/ReportIncidentModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsModal } from '../context/SettingsModalContext';

const TabHeader: React.FC = () => {
  const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
  const { open: openReportIncidentModal } = useReportIncidentModal();
  const { use24HourClock } = useSettingsModal();
  const sliderAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const isMobile = width < 600;
  const isPortrait = height > width;
  const sliderWidth = 200;
  const thumbSize = 52;
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!emergencyActivated) {
      Animated.timing(sliderAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [emergencyActivated, sliderAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !emergencyActivated,
      onMoveShouldSetPanResponder: () => !emergencyActivated,
      onPanResponderMove: (_, gestureState) => {
        if (emergencyActivated) return;
        const newValue = Math.max(0, Math.min(sliderWidth - thumbSize, gestureState.dx));
        sliderAnim.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (emergencyActivated) return;
        const threshold = (sliderWidth - thumbSize) * 0.8;
        if (gestureState.dx >= threshold) {
          Animated.spring(sliderAnim, {
            toValue: sliderWidth - thumbSize,
            useNativeDriver: false,
          }).start((result) => {
            if (result.finished) {
              try {
                activateEmergency();
              } catch (error) {
                sliderAnim.setValue(0);
              }
            }
          });
        } else {
          Animated.spring(sliderAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const [isDeactivateModalVisible, setIsDeactivateModalVisible] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');

  const handleDeactivateLongPress = () => {
    setDeactivateReason('');
    setIsDeactivateModalVisible(true);
  };

  const handleDeactivateSubmit = () => {
    deactivateEmergency(deactivateReason);
    setIsDeactivateModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.header}>
      <View style={[styles.headerCenter, isPortrait && styles.headerStart]}>
        <Text style={styles.headerTime}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !use24HourClock })}
        </Text>
      </View>
      <View style={[styles.emergencyContainer, isMobile && styles.emergencyContainerMobile]}>
        {emergencyActivated ? (
          <TouchableOpacity
            style={styles.emergencyActivatedBtn}
            onLongPress={handleDeactivateLongPress}
            delayLongPress={5000}
          >
            <Text style={styles.emergencyActivatedText}>Activated</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.sliderTrack}>
            <Text style={styles.sliderLabel}>Emergency</Text>
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.sliderThumb, { transform: [{ translateX: sliderAnim }] }]}
            >
              <MaterialIcons name="arrow-forward" size={28} color="#FFFFFF" />
            </Animated.View>
          </View>
        )}
      </View>

      <Modal
        visible={isDeactivateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeactivateModalVisible(false)}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reason for Clearing Emergency state</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              placeholderTextColor={COLORS.textMuted}
              value={deactivateReason}
              onChangeText={setDeactivateReason}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setIsDeactivateModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleDeactivateSubmit}
              >
                <Text style={styles.modalBtnText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
    paddingTop: 30,
    paddingBottom: 40
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStart: {
    alignItems: 'flex-start',
    left: 24,
  },
  headerTime: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emergencyContainer: {
    position: 'absolute',
    right: 24,
    marginTop:7
  },
  emergencyContainerMobile: {
    right: 12,
  },
  sliderTrack: {
    width: 200,
    height: 52,
    backgroundColor: '#3A3A3C',
    borderRadius: 26,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sliderLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    pointerEvents: 'none',
  },
  sliderThumb: {
    width: 52,
    height: 44,
    backgroundColor: COLORS.emergency,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emergencyActivatedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAB308',
    paddingVertical: 12,
    paddingHorizontal: 35,
    borderRadius: 26,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emergencyActivatedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#252A32',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
    minHeight: 48,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#3A3A3C',
  },
  modalBtnSubmit: {
    backgroundColor: COLORS.primary,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default TabHeader;
