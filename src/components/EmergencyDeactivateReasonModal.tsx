import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';

export const EMERGENCY_HOLD_DURATION_MS = 5000;

interface EmergencyDeactivateReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

const EmergencyDeactivateReasonModal: React.FC<EmergencyDeactivateReasonModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason('');
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit(reason);
    setReason('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={styles.overlay} onPress={() => Keyboard.dismiss()}>
        <Pressable style={styles.content} onPress={() => {}}>
          <Text style={styles.title}>Reason for Clearing Emergency state</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter reason..."
            placeholderTextColor={COLORS.textMuted}
            value={reason}
            onChangeText={setReason}
            autoFocus
            multiline
          />
          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSubmit]} onPress={handleSubmit}>
              <Text style={styles.btnText}>Submit</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#252A32',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
    minHeight: 48,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#3A3A3C',
  },
  btnSubmit: {
    backgroundColor: COLORS.primary,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmergencyDeactivateReasonModal;
