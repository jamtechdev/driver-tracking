/**
 * PIN Entry Screen - Driver login passcode
 * Minimal design: prompt + 4 underscores, auto-verify on 4th digit, no verify button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import type { Driver } from '../../data/drivers';

const PIN_LENGTH = 4;

interface PinEntryScreenProps {
  navigation: any;
  route?: { params?: { driver: Driver } };
}

const PinEntryScreen: React.FC<PinEntryScreenProps> = ({ navigation, route }) => {
  const { login } = useAuth();
  const driver: any = route?.params?.driver;
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const verifyingRef = useRef(false);

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

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !driver || verifyingRef.current) return;
    verifyingRef.current = true;
    setError('');
    const success = login(driver, pin);
    if (success) {
      if (driver.role === 'supervisor') {
        navigation.navigate('SupervisorHome');
      } else {
        navigation.goBack();
      }
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
    verifyingRef.current = false;
  }, [pin, driver, login, navigation]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleNumberPress = (num: string) => {
    if (pin.length >= PIN_LENGTH) return;
    animatePress();
    setPin((p) => p + num);
    setError('');
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  const renderPinDots = () => (
    <View style={styles.pinContainer}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={[styles.pinDot, index < pin.length && styles.pinDotFilled]}
        />
      ))}
    </View>
  );

  if (!driver) {
    if (navigation.canGoBack()) navigation.goBack();
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.main}>
        <View style={styles.header}>
          <Text style={styles.title}>Please enter driver login passcode</Text>
        </View>

        {renderPinDots()}

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={22} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.keypadWrap}>
        <Animated.View style={[styles.keypad, { transform: [{ scale: scaleAnim }] }]}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['back', '0', 'del']].map(
            (row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) =>
                  key === 'back' ? (
                    <Pressable
                      key="back"
                      style={({ pressed }) => [
                        styles.keyButton,
                        styles.backKeyButton,
                        pressed && styles.keyButtonPressed,
                      ]}
                      onPress={handleBack}
                    >
                      <MaterialIcons name="arrow-back" size={24} color="#64748B" />
                      <Text style={styles.backKeyText}>Back</Text>
                    </Pressable>
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  main: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 20 : 28,
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 28,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 18,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#475569',
    borderColor: '#475569',
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
  keypadWrap: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  keypad: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
    marginBottom: 10,
    gap: 12,
  },
  keyButton: {
    flex: 1,
    minHeight: 52,
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
  backKeyButton: {
    backgroundColor: '#F1F5F9',
  },
  backKeyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
});

export default PinEntryScreen;
