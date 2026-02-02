/**
 * Report Incident Modal - Report incident with subject, description, camera
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  TextInput,
  ScrollView,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useReportIncidentModal } from '../context/ReportIncidentModalContext';
import { useAuth } from '../context/AuthContext';

const MAX_IMAGES = 3;

const ReportIncidentModal: React.FC = () => {
  const { visible, close } = useReportIncidentModal();
  const { driver } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const { width } = Dimensions.get('window');
  const isTablet = width >= 600;

  const handleSubmit = () => {
    // TODO: Submit incident report with images
    setSubject('');
    setDescription('');
    setImages([]);
    close();
  };

  const handleBack = () => {
    setSubject('');
    setDescription('');
    setImages([]);
    close();
  };

  const addImage = (uri: string) => {
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, uri];
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCamera = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => launchCamera({ mediaType: 'photo' }).then(handleImageResponse) },
      { text: 'Choose from Library', onPress: () => launchImageLibrary({ mediaType: 'photo', selectionLimit: MAX_IMAGES - images.length }).then(handleImageResponse) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleImageResponse = (response: { didCancel?: boolean; errorCode?: string; assets?: Array<{ uri?: string }> }) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', response.errorCode === 'camera_unavailable' ? 'Camera not available on this device (e.g. simulator). Try "Choose from Library".' : 'Failed to get image.');
      return;
    }
    const uris = (response.assets || []).map((a) => a.uri).filter((u): u is string => !!u);
    setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
  };

  const driverName = driver?.name || 'Unassigned';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBack}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <Pressable style={styles.overlay} onPress={handleBack}>
        <Pressable
          style={[styles.modalContent, isTablet && styles.modalContentTablet]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Report Incident</Text>
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fromLabel}>From: {driverName}</Text>

            <Text style={styles.label}>Subject:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter subject"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Description:</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the incident..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
            />

            <View style={styles.imagePlaceholders}>
              {[0, 1, 2].map((i) => (
                <Pressable
                  key={i}
                  style={styles.imagePlaceholder}
                  onPress={() => (images[i] ? removeImage(i) : handleCamera())}
                >
                  {images[i] ? (
                    <>
                      <Image source={{ uri: images[i] }} style={styles.imagePreview} resizeMode="cover" />
                      <View style={styles.imageRemoveBadge}>
                        <MaterialIcons name="close" size={14} color="#FFFFFF" />
                      </View>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="add-a-photo" size={32} color="#94A3B8" />
                      <Text style={styles.imagePlaceholderText}>Tap to add</Text>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalBottomBar}>
            <Pressable style={styles.modalBarItem} onPress={handleCamera}>
              <MaterialIcons name="camera-alt" size={32} color="rgba(255,255,255,0.95)" />
              <Text style={styles.modalBarLabel}>Camera</Text>
            </Pressable>
            <View style={styles.modalBarDivider} />
            <Pressable style={styles.modalBarItem} onPress={handleSubmit}>
              <MaterialIcons name="check-circle" size={32} color={COLORS.primary} />
              <Text style={[styles.modalBarLabel, styles.modalBarLabelPrimary]}>Submit</Text>
            </Pressable>
            <View style={styles.modalBarDivider} />
            <Pressable style={styles.modalBarItem} onPress={handleBack}>
              <MaterialIcons name="arrow-back" size={32} color="rgba(255,255,255,0.95)" />
              <Text style={styles.modalBarLabel}>Back</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#1C2023',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalContentTablet: {
    maxWidth: 560,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    maxHeight: 400,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 24,
  },
  fromLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: {
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  imagePlaceholders: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  modalBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#232931',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  modalBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalBarLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginTop: 6,
  },
  modalBarLabelPrimary: {
    color: COLORS.primary,
  },
  modalBarDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
  },
});

export default ReportIncidentModal;
