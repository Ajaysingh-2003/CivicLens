import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface ReportPostModalProps {
  visible: boolean;
  issueId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const REPORT_REASONS = [
  { id: 'FAKE_ISSUE', label: 'AI Generated / Fake Image' },
  { id: 'NOT_CIVIC', label: 'Not a Civic Issue (Meme, Selfie, etc.)' },
  { id: 'INAPPROPRIATE', label: 'Inappropriate Content' },
  { id: 'SPAM', label: 'Spam / Advertising' },
  { id: 'EDITED_IMAGE', label: 'Edited / Manipulated Image' },
  { id: 'OTHER', label: 'Other' },
];

export default function ReportPostModal({ visible, issueId, onClose, onSuccess }: ReportPostModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Reason required", "Please select a reason for reporting this post.");
      return;
    }

    setSubmitting(true);
    try {
      await api.reportIssue(issueId, selectedReason, description);
      setSubmitting(false);
      onSuccess();
    } catch (error: any) {
      setSubmitting(false);
      Alert.alert("Report Failed", error.message || "Failed to submit report.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={submitting}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Report Post</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="warning-outline" size={32} color="#E53E3E" />
              </View>
              <Text style={styles.title}>Why are you reporting this post?</Text>
              <Text style={styles.subtitle}>Your report is anonymous. If it violates our community guidelines, the post will be removed.</Text>
            </View>

            <View style={styles.optionsList}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[styles.optionBtn, selectedReason === reason.id && styles.optionBtnSelected]}
                  onPress={() => setSelectedReason(reason.id)}
                  disabled={submitting}
                >
                  <View style={styles.radio}>
                    {selectedReason === reason.id && <View style={styles.radioSelected} />}
                  </View>
                  <Text style={[styles.optionText, selectedReason === reason.id && styles.optionTextSelected]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Provide more context..."
              placeholderTextColor="#A0AEC0"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              editable={!submitting}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.submitBtn, (!selectedReason || submitting) && styles.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A202C',
  },
  content: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsList: {
    marginBottom: 24,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionBtnSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FC8181',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53E3E',
  },
  optionText: {
    fontSize: 16,
    color: '#4A5568',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#C53030',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3748',
    minHeight: 120,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    backgroundColor: '#E53E3E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#FC8181',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
