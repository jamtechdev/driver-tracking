/**
 * PIN Entry Modal - Overlay so it doesn't feel like leaving the app
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Animated,
  BackHandler,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { usePinEntryModal } from '../context/PinEntryModalContext';

const PIN_LENGTH = 4;

interface PinEntryModalProps {
  navigationRef: React.RefObject<any>;
}

export default function PinEntryModal({ navigationRef }: PinEntryModalProps) {
  const { visible, driver, close, onSuccessRef } = usePinEntryModal();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !driver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, driver, close]);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !driver || verifyingRef.current) return;
    verifyingRef.current = true;
    setError('');
    const success = login(driver, pin);
    if (success) {
      const onSuccess = onSuccessRef.current ?? null;
      close();
      if (driver.role === 'supervisor' && navigationRef?.current) {
        navigationRef.current.navigate('SupervisorHome');
      }
      onSuccess?.();
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
    verifyingRef.current = false;
  }, [pin, driver, login, close]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
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

  if (!driver) return null;

  const { width: winWidth, height: winHeight } = Dimensions.get('window');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View
        style={[
          styles.fullScreen,
          styles.absoluteFill,
          {
            width: winWidth,
            height: winHeight,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.main}>
          <View style={styles.header}>
            <Text style={styles.title}>Please enter driver login passcode</Text>
          </View>
          <View style={styles.pinContainer}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.pinDot, i < pin.length && styles.pinDotFilled]}
              />
            ))}
          </View>
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
              (row, ri) => (
                <View key={ri} style={styles.keypadRow}>
                  {row.map((key) =>
                    key === 'back' ? (
                      <Pressable
                        key="back"
                        style={({ pressed }) => [
                          styles.keyButton,
                          styles.backKeyButton,
                          pressed && styles.keyButtonPressed,
                        ]}
                        onPress={close}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  fullScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  main: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
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
    marginBottom: 8,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  keypad: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  keyButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
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
    fontSize: 26,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
});
