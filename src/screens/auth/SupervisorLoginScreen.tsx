/**
 * Supervisor Login Screen - Professional Design
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface SupervisorLoginScreenProps {
  navigation: any;
}

const SupervisorLoginScreen: React.FC<SupervisorLoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: Implement supervisor login logic
    console.log('Supervisor Login:', username, password);
    // For now, navigate to home
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>👔</Text>
        </View>
        <Text style={styles.appName}>Supervisor Portal</Text>
        <Text style={styles.tagline}>Management Dashboard</Text>
      </View>

      {/* Login Form */}
      <View style={styles.formContainer}>
        <Text style={styles.welcomeText}>Supervisor Access</Text>
        <Text style={styles.subtitleText}>Enter your credentials</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Supervisor ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter supervisor ID"
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
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back to Driver Login</Text>
        </TouchableOpacity>
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
    backgroundColor: '#7C3AED',
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
    backgroundColor: '#8B5CF6',
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
    color: '#C4B5FD',
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
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#7C3AED',
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
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SupervisorLoginScreen;

