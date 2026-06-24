import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { peakResetPassword } from '@/api/userLogin.api';

const ResetPassword = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { email } = route.params as {
    email: string;
  };

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP.');
      return;
    }

    if (!password.trim()) {
      Alert.alert(
        'Error',
        'Please enter a new password.',
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Error',
        'Password must be at least 6 characters long.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Error',
        'Passwords do not match.',
      );
      return;
    }

    try {
      setLoading(true);

      const response = await peakResetPassword({
        email,
        resetKey: otp,
        passwd: password,
      });

      if (response?.success) {
        Alert.alert(
          'Success',
          response?.message,
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.navigate("Login" as never),
            },
          ],
        );
      } else {
        Alert.alert(
          'Error',
          response?.message ||
            'Unable to reset password.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? 20 : 0
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.wrapper}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/peak-transit-logo.png')}
                resizeMode="contain"
                style={styles.logo}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>
                Reset Password
              </Text>

              <Text style={styles.subtitle}>
                Enter the reset code sent to
                your email and create a new
                password.
              </Text>

              <View style={styles.inputContainer}>
                <View
                  style={styles.iconContainer}
                >
                  <MaterialIcons
                    name="vpn-key"
                    size={22}
                    color="#6B7280"
                  />
                </View>

                <View style={styles.divider} />

                <TextInput
                  style={styles.input}
                  placeholder="Reset Code"
                  placeholderTextColor="#9CA3AF"
                //   keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              <View
                style={[
                  styles.inputContainer,
                  styles.inputSpacing,
                ]}
              >
                <View
                  style={styles.iconContainer}
                >
                  <MaterialIcons
                    name="lock-outline"
                    size={22}
                    color="#6B7280"
                  />
                </View>

                <View style={styles.divider} />

                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              <View
                style={[
                  styles.inputContainer,
                  styles.inputSpacing,
                ]}
              >
                <View
                  style={styles.iconContainer}
                >
                  <MaterialIcons
                    name="lock-outline"
                    size={22}
                    color="#6B7280"
                  />
                </View>

                <View style={styles.divider} />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={
                    setConfirmPassword
                  }
                  editable={!loading}
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  loading &&
                    styles.buttonDisabled,
                ]}
                disabled={loading}
                onPress={handleResetPassword}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={styles.buttonText}
                  >
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading}
                onPress={() =>
                  navigation.goBack()
                }
              >
                <Text style={styles.backText}>
                  Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPassword;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  scrollContent: {
    flexGrow: 1,
  },

  wrapper: {
    flex: 1,
    justifyContent: 'center',
    minHeight: '100%',
    paddingHorizontal: 20,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logo: {
    width: 220,
    height: 90,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 24,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    textAlign: 'center',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#C7CDD4',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  inputSpacing: {
    marginTop: 14,
  },

  iconContainer: {
    width: 52,
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  divider: {
    width: 1,
    height: '100%',
    backgroundColor: '#D1D5DB',
  },

  input: {
    flex: 1,
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 16,
  },

  button: {
    marginTop: 20,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  backText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#3B6EA8',
    fontSize: 14,
    fontWeight: '600',
  },
});