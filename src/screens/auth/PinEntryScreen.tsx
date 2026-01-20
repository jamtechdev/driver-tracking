/**
 * PIN Entry Screen - Professional Design
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface PinEntryScreenProps {
  navigation: any;
}

const PinEntryScreen: React.FC<PinEntryScreenProps> = ({ navigation }) => {
  const [pin, setPin] = useState('');

  const handleNumberPress = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePinSubmit = () => {
    if (pin.length === 4) {
      // TODO: Implement PIN verification
      console.log('PIN entered:', pin);
      // For now, navigate to home
      navigation.replace('Home');
    }
  };

  const renderPinDots = () => {
    return (
      <View style={styles.pinContainer}>
        {[0, 1, 2, 3].map((index) => (
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🔐</Text>
        </View>
        <Text style={styles.title}>Enter Your PIN</Text>
        <Text style={styles.subtitle}>Enter 4-digit security PIN</Text>
      </View>

      {renderPinDots()}

      <View style={styles.keypad}>
        <View style={styles.keypadRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyButton}
              onPress={() => handleNumberPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyButton}
              onPress={() => handleNumberPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.keyButton}
              onPress={() => handleNumberPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          <View style={styles.keyButtonEmpty} />
          <TouchableOpacity
            style={styles.keyButton}
            onPress={() => handleNumberPress('0')}
            activeOpacity={0.7}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.keyButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {pin.length === 4 && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handlePinSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>Verify PIN →</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>← Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 50,
    paddingHorizontal: 20,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  pinDotFilled: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  keypad: {
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  keyButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  keyButtonEmpty: {
    width: 75,
    height: 75,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  deleteText: {
    fontSize: 24,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    alignSelf: 'center',
    padding: 10,
  },
  backText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PinEntryScreen;

