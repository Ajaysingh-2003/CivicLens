import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import { useLevels } from '../hooks/useLevels';
import ModerationRejectionModal from '../components/ModerationRejectionModal';

export default function ProfileScreen({ navigation }: any) {
  const { user, refreshUser, logout } = useAuth();
  const levelsConfig = useLevels();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAvatarModalVisible, setAvatarModalVisible] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');

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
          await api.uploadAvatar(result.assets[0].uri);
          await refreshUser();
          Alert.alert('Success', 'Avatar updated!');
        } catch (err: any) {
          const msg = err.message || 'Failed to upload avatar';
          if (msg.includes('rejected') || msg.includes('inappropriate')) {
            setRejectionMessage(msg);
          } else {
            Alert.alert('Error', msg);
          }
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

  const handleChangePhotoPrompt = () => {
    setAvatarModalVisible(false);
    setTimeout(() => {
      Alert.alert(
        "Update Photo",
        "Choose how to update your profile photo",
        [
          { text: "Take Photo", onPress: () => handlePickImage(true) },
          { text: "Choose from Library", onPress: () => handlePickImage(false) },
          { text: "Cancel", style: "cancel" }
        ]
      );
    }, 300);
  };

  const handleAvatarRemove = async () => {
    setAvatarModalVisible(false);
    try {
      setUploadingAvatar(true);
      await api.removeAvatar();
      await refreshUser();
      Alert.alert('Success', 'Avatar removed.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const displayName = user?.username || 'Citizen';
  const displayTitle = user?.title || 'Citizen Reporter';
  const avatarUrl = user?.avatar_url || null;
  const pts = user?.points || 0;

  const LEVELS = levelsConfig.map(l => ({ level: l.level, title: l.title, minPoints: l.min_points }));
  const currentLevelData = [...LEVELS].reverse().find(l => pts >= l.minPoints) || LEVELS[0];
  const nextLevelData = LEVELS[currentLevelData.level] || null;

  const pointsPct = nextLevelData
    ? Math.min(((pts - currentLevelData.minPoints) / (nextLevelData.minPoints - currentLevelData.minPoints)) * 100, 100)
    : 100;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Profile</Text>
        </View>
      </View>

      <ScrollView style={styles.profileScroll} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={styles.profileAvatarWrapper}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
              : <View style={[styles.profileAvatar, styles.avatarPlaceholder]}><Ionicons name="person" size={50} color="#aaa" /></View>
            }
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
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
            <Text style={styles.pointsValue}>{pts} {nextLevelData ? `/ ${nextLevelData.minPoints}` : ''}</Text>
          </View>
          <View style={styles.progressTrackLg}>
            <View style={[styles.progressFillLg, { width: `${pointsPct}%` as any }]} />
          </View>
          <Text style={styles.pointsSub}>{displayTitle}</Text>
        </View>

        <View style={styles.settingsGroup}>
          {[
            { icon: 'clipboard-outline', label: 'My Reports', action: () => navigation.navigate('MyReports') },
            { icon: 'person-outline', label: 'Account Details', action: () => navigation.navigate('AccountDetails') },
            { icon: 'notifications-outline', label: 'Notifications', action: () => navigation.navigate('Notifications' as never) },
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

      {/* Avatar Modal */}
      <Modal visible={isAvatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayDark} activeOpacity={1} onPress={() => setAvatarModalVisible(false)}>
          <View style={styles.enlargedAvatarContainer}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.enlargedAvatar} />
              : <View style={[styles.enlargedAvatar, styles.avatarPlaceholderEnlarged]}><Ionicons name="person" size={90} color="#aaa" /></View>
            }
          </View>
          <View style={styles.avatarActionsRow}>
            <View style={styles.avatarActionItem}>
              <TouchableOpacity style={styles.avatarActionBtn} onPress={handleChangePhotoPrompt}>
                <Ionicons name="camera-outline" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.avatarActionText}>Change Photo</Text>
            </View>
            <View style={styles.avatarActionItem}>
              <TouchableOpacity style={[styles.avatarActionBtn, { borderColor: '#ffebee' }]} onPress={() => { setAvatarModalVisible(false); handleAvatarRemove(); }}>
                <Ionicons name="trash-outline" size={26} color="#D32F2F" />
              </TouchableOpacity>
              <Text style={[styles.avatarActionText, { color: '#D32F2F' }]}>Delete Photo</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ModerationRejectionModal
        visible={!!rejectionMessage}
        onClose={() => setRejectionMessage('')}
        message={rejectionMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  
  profileScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 28 },
  profileAvatarWrapper: { position: 'relative', marginBottom: 14 },
  profileAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  avatarPlaceholder: { backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderEnlarged: { backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#4CAF50', width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FAFAFA',
  },
  profileName: { fontSize: 20, fontWeight: '800', color: '#191c1d', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#888', fontWeight: '500' },

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

  settingsGroup: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F8F8F8',
  },
  settingsIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2FCF2', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },

  logoutBtn: { backgroundColor: '#FFF5F5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  logoutText: { color: '#FF3B30', fontWeight: '700', fontSize: 15 },

  modalOverlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  enlargedAvatarContainer: { marginBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  enlargedAvatar: { width: 240, height: 240, borderRadius: 120, borderWidth: 4, borderColor: '#4CAF50', backgroundColor: '#333' },
  avatarActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  avatarActionItem: { alignItems: 'center' },
  avatarActionBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  avatarActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
