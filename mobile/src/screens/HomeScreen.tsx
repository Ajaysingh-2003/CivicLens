import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Dimensions, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import ReportIncidentModal from '../components/ReportIncidentModal';

const { width } = Dimensions.get('window');

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
};

type ActiveView = 'Feed' | 'MyReports' | 'Profile';

export default function HomeScreen() {
  const { user, login, logout } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('Feed');
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Profile / Avatar states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAvatarModalVisible, setAvatarModalVisible] = useState(false);

  // Report modal
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportImageUri, setReportImageUri] = useState<string | null>(null);

  const loadIssues = useCallback(async (view: ActiveView = activeView) => {
    setLoading(true);
    try {
      if (view === 'Feed') {
        const data = await api.getIssues();
        setIssues(data);
      } else if (view === 'MyReports') {
        const data = await api.getMyIssues();
        setIssues(data);
      }
    } catch (err: any) {
      console.log('Error loading issues:', err);
    } finally {
      setLoading(false);
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'Feed' || activeView === 'MyReports') {
      loadIssues(activeView);
    }
  }, [activeView]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeView === 'Feed') {
        const data = await api.getIssues();
        setIssues(data);
      } else if (activeView === 'MyReports') {
        const data = await api.getMyIssues();
        setIssues(data);
      }
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [activeView]);

  const handleReportIncident = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to report an issue.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setReportImageUri(result.assets[0].uri);
        setReportModalVisible(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to launch camera');
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Camera permission required.'); return; }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library permission required.'); return; }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });

      if (!result.canceled && result.assets?.length > 0) {
        setUploadingAvatar(true);
        try {
          const updatedUser = await api.uploadAvatar(result.assets[0].uri);
          const token = await AsyncStorage.getItem('access_token');
          if (token) await login(token, updatedUser);
          Alert.alert('Success', 'Avatar updated!');
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to upload avatar');
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setAvatarModalVisible(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarModalVisible(false);
    try {
      setUploadingAvatar(true);
      const updatedUser = await api.removeAvatar();
      const token = await AsyncStorage.getItem('access_token');
      if (token) await login(token, updatedUser);
      Alert.alert('Success', 'Avatar removed.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const displayName = user?.name || user?.full_name || 'Citizen';
  const displayTitle = user?.title || 'Level 1: Citizen Explorer';
  const avatarUrl = user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id || 'fallback'}`;
  const pointsPct = Math.min(((user?.points || 0) / 1000) * 100, 100);

  // ─── HEADER ──────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {activeView === 'Profile' ? (
          <TouchableOpacity onPress={() => setActiveView('Feed')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
        ) : activeView === 'MyReports' ? (
          <TouchableOpacity onPress={() => setActiveView('Profile')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.greeting}>
            {activeView === 'Profile' ? 'Account' : activeView === 'MyReports' ? 'My Reports' : `Hello, ${displayName.split(' ')[0]}`}
          </Text>
          {activeView === 'Feed' && (
            <View style={styles.levelRow}>
              <Ionicons name="star" size={11} color="#4CAF50" />
              <Text style={styles.levelText}>{displayTitle} • {user?.points || 0} pts</Text>
            </View>
          )}
          {activeView === 'Feed' && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pointsPct}%` as any }]} />
            </View>
          )}
        </View>
      </View>
      {activeView !== 'Profile' && (
        <TouchableOpacity onPress={() => setActiveView('Profile')} style={styles.avatarBtn}>
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── ISSUE CARD ───────────────────────────────────────────────────────────────
  const renderCard = (issue: any) => (
    <View key={issue.id} style={styles.card}>
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaLeft}>
          <View style={[styles.categoryDot, { backgroundColor: issue.category_color || '#4CAF50' }]} />
          <Text style={styles.cardMetaText}>{issue.reporter_name || 'Anonymous'}</Text>
          <Text style={styles.cardMetaDivider}>·</Text>
          <Text style={styles.cardMetaText}>{formatTime(issue.created_at)}</Text>
        </View>
        <View style={[styles.categoryChip, { borderColor: issue.category_color || '#4CAF50' }]}>
          <Text style={[styles.categoryChipText, { color: issue.category_color || '#4CAF50' }]}>
            {issue.category_name || 'General'}
          </Text>
        </View>
      </View>

      {issue.image_url && (
        <Image source={{ uri: issue.image_url }} style={styles.cardImage} />
      )}

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{issue.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{issue.description}</Text>
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.voteBtn}>
          <Ionicons name="caret-up" size={18} color="#4CAF50" />
          <Text style={styles.voteBtnText}>{issue.upvotes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.voteBtn}>
          <Ionicons name="caret-down" size={18} color="#aaa" />
          <Text style={[styles.voteBtnText, { color: '#aaa' }]}>{issue.downvotes}</Text>
        </TouchableOpacity>
        <View style={styles.commentBtn}>
          <Ionicons name="chatbubble-outline" size={16} color="#888" />
          <Text style={styles.commentBtnText}>{issue.comments_count}</Text>
        </View>
      </View>
    </View>
  );

  // ─── FEED / MY REPORTS ────────────────────────────────────────────────────────
  const renderFeed = () => (
    <>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
        >
          {issues.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No issues reported yet.</Text>
              <Text style={styles.emptyStateSubText}>Be the first to report one!</Text>
            </View>
          ) : (
            issues.map(renderCard)
          )}
        </ScrollView>
      )}

      {/* Centered FAB */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.fab} onPress={handleReportIncident} activeOpacity={0.85}>
          <Ionicons name="camera" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </>
  );

  // ─── PROFILE ──────────────────────────────────────────────────────────────────
  const renderProfile = () => (
    <ScrollView style={styles.profileScroll} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={styles.profileAvatarWrapper}>
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      <View style={styles.pointsCard}>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>Citizen Points</Text>
          <Text style={styles.pointsValue}>{user?.points || 0} / 1000</Text>
        </View>
        <View style={styles.progressTrackLg}>
          <View style={[styles.progressFillLg, { width: `${pointsPct}%` as any }]} />
        </View>
        <Text style={styles.pointsSub}>{displayTitle}</Text>
      </View>

      <View style={styles.settingsGroup}>
        {[
          { icon: 'clipboard-outline', label: 'My Reports', action: () => setActiveView('MyReports') },
          { icon: 'person-outline', label: 'Account Details', action: () => {} },
          { icon: 'notifications-outline', label: 'Notifications', action: () => {} },
          { icon: 'shield-checkmark-outline', label: 'Privacy & Security', action: () => {} },
          { icon: 'help-circle-outline', label: 'Help & Support', action: () => {} },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.settingsRow} onPress={item.action}>
            <View style={styles.settingsIcon}>
              <Ionicons name={item.icon as any} size={20} color="#4CAF50" />
            </View>
            <Text style={styles.settingsLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      {renderHeader()}
      <View style={styles.main}>
        {activeView === 'Profile' ? renderProfile() : renderFeed()}
      </View>

      {/* Avatar Modal */}
      <Modal visible={isAvatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Photo</Text>
            <Text style={styles.modalSubtext}>Choose how to update your profile photo.</Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => handlePickImage(false)} disabled={uploadingAvatar}>
              <Text style={styles.modalPrimaryText}>{uploadingAvatar ? 'Uploading...' : 'Choose from Library'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => handlePickImage(true)} disabled={uploadingAvatar}>
              <Text style={styles.modalPrimaryText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={handleAvatarRemove}>
              <Text style={styles.modalSecondaryText}>Remove Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAvatarModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <ReportIncidentModal
        visible={isReportModalVisible}
        imageUri={reportImageUri}
        onClose={() => { setReportModalVisible(false); setReportImageUri(null); }}
        onSuccess={() => {
          setReportModalVisible(false);
          setReportImageUri(null);
          loadIssues('Feed');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  main: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { marginRight: 12, padding: 2 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  levelText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 4 },
  progressTrack: { height: 3, backgroundColor: '#E8E8E8', borderRadius: 2, width: 120, marginTop: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 2 },
  avatarBtn: { marginLeft: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },

  // Feed
  feed: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#bbb', marginTop: 16 },
  emptyStateSubText: { fontSize: 14, color: '#ccc', marginTop: 6 },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#191c1d', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  cardMetaText: { fontSize: 13, color: '#555', fontWeight: '500' },
  cardMetaDivider: { fontSize: 13, color: '#bbb' },
  categoryChip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  categoryChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  cardImage: { width: '100%', height: 190, backgroundColor: '#f0f0f0' },
  cardBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#191c1d', marginBottom: 4, letterSpacing: -0.2 },
  cardDesc: { fontSize: 14, color: '#666', lineHeight: 20 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F5F5F5', gap: 12,
  },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8F8F8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  voteBtnText: { fontSize: 13, fontWeight: '700', color: '#4CAF50' },
  commentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto',
  },
  commentBtnText: { fontSize: 13, color: '#888', fontWeight: '500' },

  // FAB
  fabContainer: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  fab: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4CAF50', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },

  // Profile
  profileScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 28 },
  profileAvatarWrapper: { position: 'relative', marginBottom: 14 },
  profileAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#4CAF50', width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FAFAFA',
  },
  profileName: { fontSize: 20, fontWeight: '800', color: '#191c1d', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#888', fontWeight: '500' },

  // Points Card
  pointsCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pointsLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  pointsValue: { fontSize: 14, fontWeight: '700', color: '#4CAF50' },
  progressTrackLg: { height: 7, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFillLg: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  pointsSub: { fontSize: 12, color: '#888', fontWeight: '500' },

  // Settings
  settingsGroup: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F8F8F8',
  },
  settingsIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F2FCF2', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },

  // Logout
  logoutBtn: {
    backgroundColor: '#FFF5F5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 8,
  },
  logoutText: { color: '#FF3B30', fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: { backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 6 },
  modalSubtext: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalPrimaryBtn: {
    width: '100%', backgroundColor: '#4CAF50', paddingVertical: 15,
    borderRadius: 12, alignItems: 'center', marginBottom: 10,
  },
  modalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalSecondaryBtn: {
    width: '100%', backgroundColor: '#F2F2F7', paddingVertical: 15,
    borderRadius: 12, alignItems: 'center', marginBottom: 20,
  },
  modalSecondaryText: { color: '#333', fontWeight: '700', fontSize: 15 },
  modalCancelText: { color: '#999', fontWeight: '600', fontSize: 15 },
});
