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
  Image,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { COLORS } from '../theme/colors';
import { useReportIncidentModal } from '../context/ReportIncidentModalContext';
import { useAuth } from '../context/AuthContext';
import { reportIncident } from '@/api/incident.api';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

const MAX_IMAGES = 5;

const ReportIncidentModal: React.FC = () => {
  const { visible, close } = useReportIncidentModal();
  const { driver } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { width, height } = useWindowDimensions();

  const handleSubmit = async () => {
    if (!subject.trim()) {
      close();
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a subject' });
      return;
    }
    if (!description.trim()) {
      close();
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a description' });
      return;
    }

    setIsSubmitting(true);
    try {
      const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);
      const driverID = driver?.id || '';

      const result = await reportIncident({
        agencyID,
        driverID,
        subject,
        content: description,
        images,
      });
      console.log('[IncidentAPI] Incident reported:', result);
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Incident reported successfully' });
        setSubject('');
        setDescription('');
        setImages([]);
        close();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: result.message || 'Failed to report incident',
        });
      }
    } catch (error) {
      console.error('Error submitting incident:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setSubject('');
    setDescription('');
    setImages([]);
    close();
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCamera = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    launchCamera({ mediaType: 'photo', quality: 0.8 }).then(handleImageResponse)
    // Alert.alert('Add Photo', 'Choose an option', [
    //   { text: 'Take Photo', onPress: () => launchCamera({ mediaType: 'photo', quality: 0.8 }).then(handleImageResponse) },
    //   { text: 'Choose from Library', onPress: () => launchImageLibrary({ mediaType: 'photo', selectionLimit: MAX_IMAGES - images.length, quality: 0.8 }).then(handleImageResponse) },
    //   { text: 'Cancel', style: 'cancel' },
    // ]);
  };

  const handleImageResponse = (response: { didCancel?: boolean; errorCode?: string; assets?: Array<{ uri?: string }> }) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', response.errorCode === 'camera_unavailable' ? 'Camera not available on this device.' : 'Failed to get image.');
      return;
    }
    const uris = (response.assets || []).map((a) => a.uri).filter((u): u is string => !!u);
    setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
  };

  const driverName = driver?.name || '';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBack}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable
        onPress={handleBack}
        style={styles.overlay}>
        <Pressable
          style={[styles.modalContent, { width: width * 0.9, maxHeight: height * 0.95 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Report Incident</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.fromLabel}>From: {driverName}</Text>

            {/* Subject Row */}
            <View style={styles.row}>
              <Text style={styles.label}>Subject:</Text>
              <TextInput
                style={styles.subjectInput}
                value={subject}
                onChangeText={setSubject}
                autoCorrect={false}
                numberOfLines={2}
              />
            </View>

            {/* Description Area */}
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              placeholder=""
            />

            {/* Image Section */}
            <View style={styles.imageSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.imagePlaceholderWrapper}>
                    {images[i] ? (
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: images[i] }} style={styles.selectedImage} />
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeImage(i)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons name="close" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.imagePlaceholder}
                        onPress={handleCamera}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.placeholderMainText}>IMAGE</Text>
                        <Text style={styles.placeholderSubText}>PLACEHOLDER</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.barItem} onPress={handleCamera}>
              <MaterialIcons name="camera-alt" size={32} color="#FFF" />
              <Text style={styles.barText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.barItem} onPress={handleBack}>
              <MaterialIcons name="reply" size={32} color="#FFF" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.barText}>Back</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 800,
  },
  header: {
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: '300',
  },
  content: {
    padding: 20,
  },
  fromLabel: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '300',
    marginRight: 10,
  },
  subjectInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: 38,
    borderRadius: 4,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#fff',
  },
  descriptionInput: {
    backgroundColor: COLORS.backgroundSecondary,
    height: 320,
    borderRadius: 4,
    padding: 15,
    fontSize: 19,
    color: '#fff',
    marginBottom: 20,
  },
  imageSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  imageList: {
    gap: 20,
    paddingRight: 20,
  },
  imagePlaceholderWrapper: {
    width: 130,
    height: 130,
  },
  imagePlaceholder: {
    width: 130,
    height: 130,
    backgroundColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderMainText: {
    color: '#848484',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  placeholderSubText: {
    color: '#848484',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  imageContainer: {
    width: 130,
    height: 130,
  },
  selectedImage: {
    width: 130,
    height: 130,
  },
  removeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#3d3b3bff',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    height: 90,
    backgroundColor: '#444',
    alignItems: 'center',
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
  },
  submitBtn: {
    flex: 1.5,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#555',
  },
  submitLoading: {
    marginRight: 0,
  },
  submitText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '300',
  },
});

export default ReportIncidentModal;
