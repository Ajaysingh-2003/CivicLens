import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import * as Location from 'expo-location';

interface ReportIncidentModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportIncidentModal({ visible, imageUri, onClose, onSuccess }: ReportIncidentModalProps) {
  const [step, setStep] = useState<'ANALYZING' | 'CONFIRM' | 'DETAILS'>('ANALYZING');
  
  // AI Results
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<number | null>(null);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  
  // Final Form Data
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && imageUri) {
      setStep('ANALYZING');
      analyzeImage(imageUri);
      fetchCategories();
    }
  }, [visible, imageUri]);

  const fetchCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (e) {
      console.log('Failed to fetch categories', e);
    }
  };

  const analyzeImage = async (uri: string) => {
    try {
      // Send to backend /issues/classify
      const result = await api.classifyIssueImage(uri);
      
      setUploadedImageUrl(result.image_url);
      setSuggestedCategoryId(result.suggested_category_id);
      setSuggestedCategoryName(result.suggested_category_name);
      
      // Auto-populate form with suggestion
      setSelectedCategoryId(result.suggested_category_id);
      setTitle(`${result.suggested_category_name} reported`);
      
      setStep('CONFIRM');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Analysis Failed', e.message || 'Could not analyze image.');
      onClose();
    }
  };

  const handleConfirmAI = (isCorrect: boolean) => {
    if (isCorrect) {
      setStep('DETAILS');
    } else {
      setSelectedCategoryId(null);
      setTitle('');
      setStep('DETAILS');
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !selectedCategoryId) {
      Alert.alert('Error', 'Please fill in all fields and select a category.');
      return;
    }

    setSubmitting(true);
    try {
      // Get GPS
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to submit a report.');
        setSubmitting(false);
        return;
      }
      
      let location = await Location.getCurrentPositionAsync({});
      
      await api.createIssue(
        title,
        description,
        selectedCategoryId,
        location.coords.latitude,
        location.coords.longitude,
        uploadedImageUrl
      );
      
      Alert.alert('Success', 'Your report has been submitted to the city!');
      onSuccess();
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report Incident</Text>
          {step !== 'ANALYZING' && !submitting && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          )}

          {step === 'ANALYZING' && (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" style={{ marginBottom: 16 }} />
              <Text style={styles.analyzingTitle}>Analyzing with AI...</Text>
              <Text style={styles.analyzingSubtext}>Our CLIP model is identifying the issue.</Text>
            </View>
          )}

          {step === 'CONFIRM' && (
            <View style={styles.confirmContainer}>
              <View style={styles.aiResultCard}>
                <Ionicons name="sparkles" size={24} color="#4CAF50" style={{ marginBottom: 8 }} />
                <Text style={styles.aiResultText}>It looks like a</Text>
                <Text style={styles.aiCategoryText}>{suggestedCategoryName}</Text>
              </View>

              <Text style={styles.promptText}>Is this correct?</Text>
              
              <TouchableOpacity style={styles.btnPrimary} onPress={() => handleConfirmAI(true)}>
                <Text style={styles.btnPrimaryText}>Yes, that's right</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnSecondary} onPress={() => handleConfirmAI(false)}>
                <Text style={styles.btnSecondaryText}>No, let me change it</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'DETAILS' && (
            <View style={styles.detailsContainer}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[styles.categoryPill, selectedCategoryId === cat.id && styles.categoryPillActive]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={[styles.categoryPillText, selectedCategoryId === cat.id && styles.categoryPillTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput 
                style={styles.input} 
                value={title} 
                onChangeText={setTitle} 
                placeholder="Brief description of the issue"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={description} 
                onChangeText={setDescription} 
                placeholder="Provide any helpful details for the city..."
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity 
                style={[styles.btnPrimary, { marginTop: 24 }]} 
                onPress={handleSubmit} 
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#EEEEEE',
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  confirmContainer: {
    alignItems: 'center',
  },
  aiResultCard: {
    width: '100%',
    backgroundColor: '#F2FCEE',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  aiResultText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  aiCategoryText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#00480f',
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 24,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#555555',
    fontWeight: '600',
    fontSize: 16,
  },
  detailsContainer: {
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333333',
    marginBottom: 20,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  categoryPillActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryPillText: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  }
});
