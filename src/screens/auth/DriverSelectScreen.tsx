/**
 * Driver Select Screen - Select driver from list (per iPad screenshot)
 * Replaces email/password login
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { DRIVERS, type Driver } from '../../data/drivers';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

interface DriverSelectScreenProps {
  navigation: any;
}

const DriverSelectScreen: React.FC<DriverSelectScreenProps> = ({ navigation }) => {
  const { login } = useAuth();
  const [showDriverModal, setShowDriverModal] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setShowDriverModal(false);

    if (driver.role === 'unassigned') {
      login(driver);
      navigation.replace('Home');
      return;
    }
    if (driver.requiresPin) {
      navigation.replace('PinEntry', { driver });
    } else {
      login(driver);
      navigation.replace('Home');
    }
  };

  const handleCancel = () => {
    setShowDriverModal(false);
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Dark theme background - main dashboard preview */}
      <View style={styles.previewArea}>
        <Text style={styles.timeText}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.previewHint}>Select a driver to begin</Text>
        {!showDriverModal && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowDriverModal(true)}
          >
            <Text style={styles.selectButtonText}>Select Driver</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Select Driver Modal */}
      <Modal
        visible={showDriverModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Driver</Text>
              <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={DRIVERS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.driverItem,
                    selectedDriver?.id === item.id && styles.driverItemSelected,
                  ]}
                  onPress={() => handleSelectDriver(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.driverName}>{item.name}</Text>
                  {selectedDriver?.id === item.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              style={styles.driverList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '300',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  previewHint: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  selectButton: {
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.pinSurface,
    borderRadius: 12,
    width: Math.min(width - 48, 400),
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.pinBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.pinText,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.accentBlue,
    fontWeight: '500',
  },
  driverList: {
    maxHeight: 320,
  },
  driverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.pinBorder,
  },
  driverItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  driverName: {
    fontSize: 16,
    color: COLORS.pinText,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.accentBlue,
    fontWeight: 'bold',
  },
});

export default DriverSelectScreen;
