/**
 * Login Screen - Professional Driver App Design
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: Implement login logic
    console.log('Login:', username, password);
    // For now, navigate to PIN entry
    navigation.navigate('PinEntry');
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🚌</Text>
        </View>
        <Text style={styles.appName}>Driver Tracker</Text>
        <Text style={styles.tagline}>Your Route, Your Way</Text>
      </View>

      {/* Login Form */}
      <View style={styles.formContainer}>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subtitleText}>Sign in to continue</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Driver ID / Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your driver ID"
            placeholderTextColor="#94A3B8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.loginButton, (!username || !password) && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={!username || !password}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.supervisorButton} 
          onPress={() => navigation.navigate('SupervisorLogin')}
          activeOpacity={0.7}
        >
          <Text style={styles.supervisorText}>Supervisor Login →</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2024 Driver Tracker</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E3A5F',
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2C5282',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#B8D4F0',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 35,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 55,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#1E293B',
  },
  loginButton: {
    width: '100%',
    height: 55,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  supervisorButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  supervisorText: {
    color: '#1E3A5F',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default LoginScreen;

