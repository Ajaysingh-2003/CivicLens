import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, TextInput,
  ActivityIndicator, Alert, ScrollView, Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../services/api';
import * as Location from 'expo-location';


interface ReportIncidentModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Animated SVG Tick ───────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function SuccessAnimation() {
  const strokeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const pointsOpacity = useRef(new Animated.Value(0)).current;
  const RADIUS = 48;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    Animated.timing(strokeAnim, { toValue: 1, duration: 700, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.sequence([
      Animated.delay(800),
      Animated.parallel([
        Animated.spring(pointsAnim, { toValue: -18, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(pointsOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const strokeDashoffset = strokeAnim.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });

  return (
    <View style={ss.animWrapper}>
      <Animated.View style={[ss.svgWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r={RADIUS} fill="#1A2B1A" />
          <AnimatedCircle
            cx="60" cy="60" r={RADIUS} fill="none"
            stroke="#4CAF50" strokeWidth={5}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90" origin="60, 60"
          />
        </Svg>
        <View style={ss.tickOverlay}>
          <Ionicons name="checkmark" size={44} color="#4CAF50" />
        </View>
      </Animated.View>
      <Animated.View style={[ss.pointsChip, { opacity: pointsOpacity, transform: [{ translateY: pointsAnim }] }]}>
        <Ionicons name="star" size={12} color="#FFD700" />
        <Text style={ss.pointsChipText}>+1 Citizen Point</Text>
      </Animated.View>
    </View>
  );
}

// ─── Success Card ─────────────────────────────────────────────────────────────
function SuccessStep({ imageUri, categoryName, onDismiss }: { imageUri: string | null; categoryName: string; onDismiss: () => void }) {
  const cardAnim = useRef(new Animated.Value(50)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={ss.root}>
      {imageUri && <Image source={{ uri: imageUri }} style={ss.bg} blurRadius={8} />}
      <View style={ss.overlay} />
      <Animated.View style={[ss.card, { opacity: cardOpacity, transform: [{ translateY: cardAnim }] }]}>
        <SuccessAnimation />
        <Text style={ss.title}>Report Filed!</Text>
        <Text style={ss.subtitle}>Your report is live. Citizens within 5 km have been notified.</Text>
        {!!categoryName && (
          <View style={ss.catRow}>
            <Ionicons name="pricetag" size={13} color="#4CAF50" />
            <Text style={ss.catText}>{categoryName}</Text>
          </View>
        )}
        <TouchableOpacity style={ss.doneBtn} onPress={onDismiss} activeOpacity={0.85}>
          <Text style={ss.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ReportIncidentModal({ visible, imageUri, onClose, onSuccess }: ReportIncidentModalProps) {
  type Step = 'ANALYZING' | 'CONFIRM' | 'DETAILS' | 'SUCCESS' | 'REJECTED';
  const [step, setStep] = useState<Step>('ANALYZING');
  
  // AI Results
  const [rejectedReason, setRejectedReason] = useState<string>('');
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<number | null>(null);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string>('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  
  // Final Form Data
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && imageUri) {
      // Reset all form state so a new report starts fresh every time
      setStep('ANALYZING');
      setTitle('');
      setDescription('');
      setSelectedCategoryId(null);
      setSuggestedCategoryId(null);
      setSuggestedCategoryName('');
      setUploadedImageUrl('');
      setShowDropdown(false);
      setError(null);
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
      console.log('Analysis Error:', e?.message || e);
      if (e.message && e.message.includes('Image rejected')) {
        setRejectedReason(e.message.replace('Image rejected. Identified as: ', ''));
        setStep('REJECTED');
      } else {
        Alert.alert('Analysis Failed', e.message || 'Could not analyze image.');
        onClose();
      }
    }
  };

  const handleConfirmAI = (isCorrect: boolean) => {
    if (isCorrect) {
      setShowDropdown(false);
      setStep('DETAILS');
    } else {
      setShowDropdown(true);
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
      
      setStep('SUCCESS');
    } catch (e: any) {
      if (e.message && (e.message.toLowerCase().includes('explicit') || e.message.toLowerCase().includes('inappropriate'))) {
        setError(e.message);
      } else {
        Alert.alert('Submission Failed', e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  if (step === 'SUCCESS') {
    return (
      <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
        <SuccessStep
          imageUri={imageUri}
          categoryName={suggestedCategoryName}
          onDismiss={() => { setStep('ANALYZING'); onSuccess(); }}
        />
      </Modal>
    );
  }

  if (step === 'REJECTED') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#ffebee', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Ionicons name="shield-outline" size={50} color="#d32f2f" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1A202C', marginBottom: 12, textAlign: 'center' }}>
            Upload Rejected
          </Text>
          <Text style={{ fontSize: 16, color: '#4A5568', textAlign: 'center', lineHeight: 24, marginBottom: 8 }}>
            CivicLens is specifically for reporting civic infrastructure issues.
          </Text>
          <Text style={{ fontSize: 16, color: '#4A5568', textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
            Your image was flagged as: <Text style={{ fontWeight: 'bold', color: '#d32f2f' }}>{rejectedReason}</Text>.
          </Text>
          
          <TouchableOpacity 
            style={[styles.btnPrimary, { width: '100%', marginBottom: 16 }]} 
            onPress={() => { setStep('ANALYZING'); onClose(); }}
          >
            <Text style={styles.btnPrimaryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {step === 'DETAILS' && (
            <TouchableOpacity onPress={() => setStep('CONFIRM')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Report Incident</Text>
          {step !== 'ANALYZING' && !submitting && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {imageUri && step !== 'ANALYZING' && (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          )}

          {step === 'ANALYZING' && (
            <View style={styles.analyzingContainer}>
              {imageUri && <Image source={{ uri: imageUri }} style={[styles.previewImage, { opacity: 0.5 }]} />}
              <ActivityIndicator size="large" color="#4CAF50" style={{ marginBottom: 16 }} />
              <Text style={styles.analyzingTitle}>Identifying issue...</Text>
              <Text style={styles.analyzingSubtext}>Analyzing community infrastructure details to provide accurate reporting.</Text>
            </View>
          )}

          {step === 'CONFIRM' && (
            <View style={styles.confirmContainer}>
              <Text style={{fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#333'}}>Official Record</Text>
              <View style={styles.aiResultCard}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" style={{ marginBottom: 8 }} />
                <Text style={styles.aiResultText}>We've identified this as a:</Text>
                <Text style={styles.aiCategoryText}>{suggestedCategoryName}</Text>
              </View>

              <Text style={styles.promptText}>Is this correct?</Text>
              
              <TouchableOpacity style={styles.btnPrimary} onPress={() => handleConfirmAI(true)}>
                <Text style={styles.btnPrimaryText}>Yes, this is correct</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnSecondaryGreen} onPress={() => handleConfirmAI(false)}>
                <Text style={styles.btnSecondaryGreenText}>No, let me choose</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'DETAILS' && (
            <View style={styles.detailsContainer}>
              <Text style={{fontSize: 20, fontWeight: '700', marginBottom: 4, color: '#333'}}>Final Submission</Text>
              <Text style={{fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20}}>
                This report will be tagged with your current GPS location and sent directly to the Public Works Department for review.
              </Text>
              
              {!showDropdown && (
                <View style={styles.badgeWrapper}>
                  <View style={styles.categoryBadge}>
                    <Ionicons name="pricetag" size={14} color="#4CAF50" style={{marginRight: 4}}/>
                    <Text style={styles.categoryBadgeText}>{suggestedCategoryName}</Text>
                  </View>
                </View>
              )}

              {showDropdown && (
                <>
                  <Text style={styles.label}>Select Category</Text>
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
                </>
              )}

              <Text style={styles.label}>Title <Text style={{color: 'red'}}>*</Text></Text>
              <TextInput 
                style={styles.input} 
                value={title} 
                onChangeText={(text) => { setTitle(text); setError(null); }}
                placeholder="Brief description of the issue"
                placeholderTextColor="#999"
                maxLength={50}
              />

              <Text style={styles.label}>Description <Text style={{color: 'red'}}>*</Text></Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                value={description} 
                onChangeText={(text) => { setDescription(text); setError(null); }}
                placeholder="Provide any helpful details for the city..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={300}
              />

              {error && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 20 }}>
                  <Ionicons name="warning" size={20} color="#d32f2f" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#d32f2f', fontSize: 14, flex: 1, fontWeight: '500' }}>{error}</Text>
                </View>
              )}

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
  btnSecondaryGreen: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryGreenText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 16,
  },
  detailsContainer: {
    width: '100%',
  },
  badgeWrapper: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2FCEE',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  categoryBadgeText: {
    color: '#00480f',
    fontSize: 12,
    fontWeight: '700',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    padding: 4,
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

// ─── Success Screen Styles ────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },
  card: {
    width: '90%', backgroundColor: '#1A1A1A', borderRadius: 28,
    paddingHorizontal: 28, paddingTop: 36, paddingBottom: 28,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)',
    shadowColor: '#4CAF50', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  animWrapper: { alignItems: 'center', marginBottom: 8, height: 160 },
  glowRing: {
    position: 'absolute', top: -10, left: -10,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderWidth: 2, borderColor: 'rgba(76,175,80,0.25)',
  },
  svgWrap: { position: 'absolute', top: 0 },
  tickOverlay: {
    position: 'absolute', width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  pointsChip: {
    position: 'absolute', bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#2A2A2A', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
  },
  pointsChipText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(76,175,80,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)',
    marginBottom: 20,
  },
  catText: { color: '#4CAF50', fontSize: 13, fontWeight: '700' },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 20 },
  rewardRow: { flexDirection: 'row', width: '100%', marginBottom: 24, justifyContent: 'center' },
  rewardItem: { flex: 1, alignItems: 'center', gap: 6 },
  rewardLabel: { fontSize: 11, color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rewardValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  rewardSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 },
  doneBtn: {
    width: '100%', backgroundColor: '#4CAF50', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#4CAF50', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
