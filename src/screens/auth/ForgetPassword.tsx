import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { peakForgotPassword } from '@/api/userLogin.api';

const ForgetPassword = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    try {
      setLoading(true);

      const response = await peakForgotPassword({
        email,
      });

      if (response?.success) {
        Alert.alert('Success', response?.message, [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate(
                'Reset-Password' as never,
                { email } as never,
              ),
          },
        ]);
      } else {
        Alert.alert(
          'Error',
          response?.message || 'Unable to process request.',
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
                Forgot Password
              </Text>

              <Text style={styles.subtitle}>
                Enter your email address and
                we'll send you a password reset
                code.
              </Text>

              <View style={styles.inputContainer}>
                <View
                  style={styles.iconContainer}
                >
                  <MaterialIcons
                    name="email"
                    size={22}
                    color="#6B7280"
                  />
                </View>

                <View style={styles.divider} />

                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
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
                onPress={handleForgotPassword}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={styles.buttonText}
                  >
                    Send Reset Code
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
                  Back to Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgetPassword;

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
    color: '#3B6EA8',
    fontSize: 15,
    fontWeight: '500',
    textAlign:'center',
    marginTop:20
  },
});