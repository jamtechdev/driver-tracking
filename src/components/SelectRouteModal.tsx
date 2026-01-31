/**
 * Select Route Modal - Choose route or Out of Service (centered, light style)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const ROUTE_OPTIONS = [
  'Out of Service',
  'Admissions',
  'Basketball',
  'Charter',
  'Hockey',
  'On Campus',
  'Redstone Express',
  'Rubenstein',
];

interface SelectRouteModalProps {
  visible: boolean;
  onClose: () => void;
}

const SelectRouteModal: React.FC<SelectRouteModalProps> = ({ visible, onClose }) => {
  const { selectedRoute, selectRouteOrStatus } = useAuth();

  const handleSelect = (value: string) => {
    selectRouteOrStatus(value);
    onClose();
  };

  const { width } = Dimensions.get('window');
  const modalWidth = Math.min(width - 48, 400);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modal, { width: modalWidth }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Select Route</Text>
            <View style={styles.headerSpacer} />
          </View>
          <FlatList
            data={ROUTE_OPTIONS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = selectedRoute === item;
              const isOutOfService = item === 'Out of Service';
              return (
                <TouchableOpacity
                  style={[
                    styles.routeItem,
                    isSelected && styles.routeItemSelected,
                    isOutOfService && styles.routeItemOutOfService,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.routeName,
                      isOutOfService && styles.routeNameOutOfService,
                    ]}
                  >
                    {item}
                  </Text>
                  {isSelected && (
                    <MaterialIcons
                      name="check"
                      size={22}
                      color={isOutOfService ? COLORS.emergency : COLORS.accentBlue}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 420,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancelBtn: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.accentBlue,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSpacer: {
    width: 60,
  },
  list: {
    maxHeight: 340,
  },
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  routeItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  routeItemOutOfService: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.emergency,
  },
  routeName: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  routeNameOutOfService: {
    color: COLORS.emergency,
    fontWeight: '600',
  },
});

export default SelectRouteModal;
