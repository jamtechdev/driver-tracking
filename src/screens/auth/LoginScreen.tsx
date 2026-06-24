/**
 * Login Screen — Peak Transit branded username/password entry.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSession } from '@/context/SessionContext';

const REMEMBER_USERNAME_KEY = '@driver_tracking:remember_username';
const REMEMBER_ME_KEY = '@driver_tracking:remember_me';

const LOGIN_INFO_MESSAGE = 'Please log in with your username and password.';
const LOGIN_ERROR_MESSAGE = 'Incorrect username or password. Please try again.';
const CARD_MAX_WIDTH = 520;
const TABLET_MIN_WIDTH = 600;

interface LoginScreenProps {
  navigation?: NativeStackNavigationProp<Record<string, object | undefined>>;
}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const { login } = useSession();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const isLandscape = width > height;
  const navigation=useNavigation();
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const layout = useMemo(() => {
    const horizontalPadding = isTablet ? 40 : 20;
    const cardWidth = Math.min(width - horizontalPadding * 2, CARD_MAX_WIDTH);
    const logoWidth = isTablet ? Math.min(cardWidth * 0.72, 360) : Math.min(cardWidth * 0.88, 300);
    const logoHeight = logoWidth * 0.28;
    const inputHeight = isTablet ? 52 : 48;
    const fontSize = isTablet ? 17 : 16;

    return {
      horizontalPadding,
      cardWidth,
      logoWidth,
      logoHeight,
      inputHeight,
      fontSize,
      contentTopPadding: isLandscape ? 16 : isTablet ? 40 : 28,
    };
  }, [width, isTablet, isLandscape]);

  useEffect(() => {
    let cancelled = false;

    const loadRemembered = async () => {
      try {
        const [savedRemember, savedUsername] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_ME_KEY),
          AsyncStorage.getItem(REMEMBER_USERNAME_KEY),
        ]);
        if (cancelled) return;
        if (savedRemember === '1') {
          setRememberMe(true);
          if (savedUsername) setUsername(savedUsername);
        }
      } catch {
        // Non-fatal — login still works without persisted username.
      }
    };

    void loadRemembered();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistRememberMe = useCallback(async (nextUsername: string, enabled: boolean) => {
    try {
      if (enabled) {
        await AsyncStorage.multiSet([
          [REMEMBER_ME_KEY, '1'],
          [REMEMBER_USERNAME_KEY, nextUsername.trim()],
        ]);
      } else {
        await AsyncStorage.multiRemove([REMEMBER_ME_KEY, REMEMBER_USERNAME_KEY]);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      await login(username.trim(), password);
      void persistRememberMe(username, rememberMe);
    } catch {
      setError(LOGIN_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, rememberMe, isSubmitting, persistRememberMe, login]);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
       <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView
  style={styles.flex}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.horizontalPadding,
              paddingTop: layout.contentTopPadding,
              minHeight: height,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.page, { maxWidth: layout.cardWidth }]}>
            <Image
              source={require('../../assets/peak-transit-logo.png')}
              style={{
                width: layout.logoWidth,
                height: layout.logoHeight,
                marginBottom: isTablet ? 28 : 22,
              }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Peak Transit"
            />

            <View style={styles.card}>
              <View style={[styles.infoBanner, error ? styles.errorBanner : null]}>
                <Text
                  style={[styles.infoText, error ? styles.errorBannerText : null, { fontSize: layout.fontSize - 1 }]}
                  testID={error ? 'login-error' : undefined}
                >
                  {error || LOGIN_INFO_MESSAGE}
                </Text>
              </View>

              <View style={[styles.inputRow, { height: layout.inputHeight }]}>
                <View style={styles.inputIconBox}>
                  <MaterialIcons name="person-outline" size={22} color="#6B7280" />
                </View>
                <TextInput
                  style={[styles.input, { fontSize: layout.fontSize }]}
                  placeholder="Username"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (error) setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  testID="login-username"
                />
              </View>

              <View
  style={[
    styles.inputRow,
    {
      height: layout.inputHeight,
      marginTop: 12,
    },
  ]}
>
  <View style={styles.inputIconBox}>
    <MaterialIcons
      name="lock-outline"
      size={22}
      color="#6B7280"
    />
  </View>

  <TextInput
    style={[
      styles.input,
      {
        fontSize: layout.fontSize,
      },
    ]}
    placeholder="Password"
    placeholderTextColor="#9CA3AF"
    value={password}
    onChangeText={(text) => {
      setPassword(text);
      if (error) setError('');
    }}
    secureTextEntry={!showPassword}
    returnKeyType="done"
    onSubmitEditing={() => {
      if (canSubmit) {
        void handleLogin();
      }
    }}
    testID="login-password"
  />

  <TouchableOpacity
    style={styles.eyeButton}
    activeOpacity={0.7}
    onPress={() =>
      setShowPassword(prev => !prev)
    }
  >
    <MaterialIcons
      name={
        showPassword
          ? 'visibility-off'
          : 'visibility'
      }
      size={22}
      color="#6B7280"
    />
  </TouchableOpacity>
</View>

              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe((prev) => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <Text style={styles.rememberText}>Remember me</Text>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe ? (
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>

              <TouchableOpacity
                style={[styles.loginButton, !canSubmit && styles.loginButtonDisabled]}
                onPress={() => void handleLogin()}
                disabled={!canSubmit}
                activeOpacity={0.85}
                testID="login-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={()=>navigation.navigate('Forget-Password' as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot my password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  flex: {
    flex: 1,
  },
  eyeButton: {
  width: 48,
  alignItems: 'center',
  justifyContent: 'center',
},
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  page: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  infoBanner: {
    backgroundColor: '#E8F1FA',
    borderWidth: 1,
    borderColor: '#C5D9EF',
    borderRadius: 3,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  infoText: {
    color: '#3B6EA8',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  errorBannerText: {
    color: '#B91C1C',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#C7CDD4',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  inputIconBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: '#C7CDD4',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    color: '#111827',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
    marginBottom: 18,
    gap: 8,
  },
  rememberText: {
    color: '#4B5563',
    fontSize: 15,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  loginButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  forgotButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    color: '#3B6EA8',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LoginScreen;
