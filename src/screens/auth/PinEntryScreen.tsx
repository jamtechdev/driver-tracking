/**
 * PIN Entry Screen - Driver login passcode
 * Rich, polished design with premium styling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import type { Driver } from '../../data/drivers';

interface PinEntryScreenProps {
  navigation: any;
  route?: { params?: { driver: Driver } };
}

const PinEntryScreen: React.FC<PinEntryScreenProps> = ({ navigation, route }) => {
  const { login } = useAuth();
  const driver = route?.params?.driver;
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
      return true;
    });
    return () => backHandler.remove();
  }, [navigation]);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleNumberPress = (num: string) => {
    animatePress();
    setPin((p) => p + num);
    setError('');
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handlePinSubmit = () => {
    if (!driver) {
      navigation.goBack();
      return;
    }
    const success = login(driver, pin);
    if (success) {
      if (driver.role === 'supervisor') {
        navigation.replace('SupervisorHome');
      } else {
        navigation.replace('Home');
      }
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  const renderPinDots = () => {
    const displayCount = Math.max(pin.length, 4);
    return (
      <View style={styles.pinContainer}>
        {Array.from({ length: Math.min(displayCount, 8) }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length && styles.pinDotFilled,
            ]}
          />
        ))}
      </View>
    );
  };

  if (!driver) {
    if (navigation.canGoBack()) navigation.goBack();
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{driver.name.charAt(0)}</Text>
            </View>
          </View>
          <Text style={styles.title}>Please enter driver login passcode</Text>
          <Text style={styles.subtitle}>for {driver.name}</Text>
        </View>

        {renderPinDots()}

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={22} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Animated.View style={[styles.keypad, { transform: [{ scale: scaleAnim }] }]}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map(
            (row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) =>
                  key === '' ? (
                    <View key="empty" style={styles.keyButton} />
                  ) : key === 'del' ? (
                    <Pressable
                      key="del"
                      style={({ pressed }) => [
                        styles.keyButton,
                        styles.deleteButton,
                        pressed && styles.keyButtonPressed,
                      ]}
                      onPress={handleDelete}
                    >
                      <MaterialIcons name="backspace" size={26} color="#DC2626" />
                    </Pressable>
                  ) : (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.keyButton,
                        pressed && styles.keyButtonPressed,
                      ]}
                      onPress={() => handleNumberPress(key)}
                    >
                      <Text style={styles.keyText}>{key}</Text>
                    </Pressable>
                  )
                )}
              </View>
            )
          )}
        </Animated.View>

        {pin.length >= 1 && (
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pin.length >= 4 && styles.submitButtonReady,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={handlePinSubmit}
          >
            <Text style={styles.submitButtonText}>
              {pin.length >= 4 ? 'Verify & Continue' : 'Verify PIN'}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={20} color="#6B7280" />
          <Text style={styles.backText}>Back to Select Driver</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 24 : 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  avatarWrap: {
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#93C5FD',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 18,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  pinDotFilled: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    marginHorizontal: 0,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  keypad: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginTop: 32,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  keyButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  keyButtonPressed: {
    backgroundColor: '#E2E8F0',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  submitButton: {
    backgroundColor: '#93C5FD',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 24,
    minWidth: 220,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButtonReady: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PinEntryScreen;
