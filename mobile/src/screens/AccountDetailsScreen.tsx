import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Alert, Modal, TextInput, Switch, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import { useLevels } from '../hooks/useLevels';
import ModerationRejectionModal from '../components/ModerationRejectionModal';

export default function AccountDetailsScreen({ navigation }: any) {
  const { user, login, logout } = useAuth();
  const levelsConfig = useLevels();

  // Account Details states
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsernameText, setEditUsernameText] = useState(user?.username || '');
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action cannot be undone. Your reported issues will remain visible as 'Deleted User'.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
              await logout();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account");
            }
          }
        }
      ]
    );
  };

  const handleSaveUsername = async () => {
    if (!editUsernameText.trim()) return;
    setUpdatingAccount(true);
    try {
      const updated = await api.updateUserMe({ username: editUsernameText.trim() });
      const token = await AsyncStorage.getItem('access_token');
      if (token) await login(token, updated);
      setIsEditingUsername(false);
    } catch (err: any) {
      const msg = err.message || "Failed to update username";
      if (msg.includes('inappropriate') || msg.includes('taken')) {
        setRejectionMessage(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setUpdatingAccount(true);
    try {
      const updated = await api.updateUserMe({ notifications_enabled: val });
      const token = await AsyncStorage.getItem('access_token');
      if (token) await login(token, updated);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update notifications");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    setUpdatingAccount(true);
    try {
      await api.requestPasswordChangeOtp({ current_password: currentPassword });
      setPasswordStep(2);
      Alert.alert("Success", "OTP sent to your email!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordOtp) {
      Alert.alert("Error", "Please enter OTP");
      return;
    }
    setUpdatingAccount(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        otp_code: passwordOtp
      });
      Alert.alert("Success", "Password changed successfully!");
      setIsPasswordModalVisible(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordOtp(''); setPasswordStep(1);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to change password");
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setPasswordStep(1);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordOtp('');
    setIsPasswordModalVisible(true);
  };

  const avatarUrl = user?.avatar_url || null;
  const pts = user?.points || 0;
  const LEVELS = levelsConfig.map(l => ({ level: l.level, title: l.title, minPoints: l.min_points }));
  const currentLevelData = [...LEVELS].reverse().find(l => pts >= l.minPoints) || LEVELS[0];
  const nextLevelData = LEVELS[currentLevelData.level] || null;

  const levelProgressPct = nextLevelData
    ? Math.min(((pts - currentLevelData.minPoints) / (nextLevelData.minPoints - currentLevelData.minPoints)) * 100, 100)
    : 100;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.greeting}>Account Details</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F4F6F9' }}
        contentContainerStyle={{ paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO BANNER ── */}
        <View style={styles.adHeroBanner}>
          <View style={styles.adHeroGradientOverlay} />
          <View style={styles.adHeroContent}>
            <View style={styles.adAvatarRing}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={styles.adAvatarImg} />
                : <View style={[styles.adAvatarImg, styles.avatarPlaceholder]}><Ionicons name="person" size={36} color="#aaa" /></View>
              }
            </View>
            <Text style={styles.adHeroName}>{user?.username || 'Citizen'}</Text>
            <View style={styles.adMemberChip}>
              <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.adMemberChipText}>
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'May 2026'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── POINTS STAT CARD ── */}
        <View style={styles.adStatCard}>
          <View style={styles.adStatRow}>
            <View style={styles.adStatItemLeft}>
              <Text style={styles.adStatTitleText}>{currentLevelData.title}</Text>
              <Text style={styles.adStatLevelText}>Level {currentLevelData.level}</Text>
            </View>
            <View style={styles.adStatDivider} />
            <View style={styles.adStatItemRight}>
              <Text style={styles.adStatValue}>{pts}</Text>
              <Text style={styles.adStatLabel}>Reputation{'\n'}Points</Text>
            </View>
          </View>

          <View style={styles.adStatCardDividerH} />

          <View style={styles.adProgressSection}>
            <View style={styles.adProgressHeader}>
              <Text style={styles.adProgressLabel}>
                {nextLevelData ? `Progress to ${nextLevelData.title}` : 'Maximum level achieved 🏆'}
              </Text>
              <Text style={styles.adProgressPct}>{levelProgressPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.adProgressTrack}>
              <View style={[styles.adProgressFill, { width: `${levelProgressPct}%` as any }]} />
            </View>
            {nextLevelData && (
              <View style={styles.adProgressFooter}>
                <Text style={styles.adProgressFooterText}>{currentLevelData.minPoints} pts</Text>
                <Text style={styles.adProgressFooterText}>{nextLevelData.minPoints} pts</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── SECTION: PROFILE INFO ── */}
        <Text style={styles.adSectionTitle}>PROFILE INFO</Text>
        <View style={styles.adCard}>
          {isEditingUsername ? (
            <View style={styles.adUsernameEditBlock}>
              <View style={styles.adRowLeft}>
                <View style={[styles.adIconBox, { backgroundColor: '#EBF5EB' }]}>
                  <Ionicons name="person-outline" size={18} color="#4CAF50" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adRowLabel}>Username</Text>
                  <TextInput
                    style={styles.adEditInputFull}
                    value={editUsernameText}
                    onChangeText={setEditUsernameText}
                    autoCapitalize="none"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveUsername}
                  />
                </View>
              </View>
              <View style={styles.adEditActionRow}>
                <TouchableOpacity
                  style={styles.adCancelBtn}
                  onPress={() => { setIsEditingUsername(false); setEditUsernameText(user?.username || ''); }}
                >
                  <Text style={styles.adCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adSaveBtn}
                  onPress={handleSaveUsername}
                  disabled={updatingAccount}
                >
                  {updatingAccount
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.adSaveBtnText}>Save Username</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.adRow, { borderBottomWidth: 1, borderBottomColor: '#F0F0F5' }]}>
              <View style={styles.adRowLeft}>
                <View style={[styles.adIconBox, { backgroundColor: '#EBF5EB' }]}>
                  <Ionicons name="person-outline" size={18} color="#4CAF50" />
                </View>
                <View>
                  <Text style={styles.adRowLabel}>Username</Text>
                  <Text style={styles.adRowValue}>{user?.username}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.adEditBtn} onPress={() => setIsEditingUsername(true)}>
                <Ionicons name="pencil" size={14} color="#4CAF50" />
                <Text style={styles.adEditBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.adRow}>
            <View style={styles.adRowLeft}>
              <View style={[styles.adIconBox, { backgroundColor: '#E8F0FE' }]}>
                <Ionicons name="mail-outline" size={18} color="#4A80F0" />
              </View>
              <View>
                <Text style={styles.adRowLabel}>Email Address</Text>
                <Text style={styles.adRowValue} numberOfLines={1} ellipsizeMode="middle">{user?.email}</Text>
              </View>
            </View>
            <View style={[styles.adLockedBadge]}>
              <Ionicons name="lock-closed" size={12} color="#999" />
              <Text style={styles.adLockedText}>Locked</Text>
            </View>
          </View>
        </View>

        {/* ── SECTION: SECURITY ── */}
        <Text style={styles.adSectionTitle}>SECURITY</Text>
        <View style={styles.adCard}>
          <TouchableOpacity style={styles.adRow} onPress={handleOpenPasswordModal}>
            <View style={styles.adRowLeft}>
              <View style={[styles.adIconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="key-outline" size={18} color="#FF9800" />
              </View>
              <View>
                <Text style={styles.adRowLabel}>Password</Text>
                <Text style={styles.adRowValue}>••••••••</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.adChevronText}>Change</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── SECTION: PREFERENCES ── */}
        <Text style={styles.adSectionTitle}>PREFERENCES</Text>
        <View style={styles.adCard}>
          <View style={styles.adRow}>
            <View style={styles.adRowLeft}>
              <View style={[styles.adIconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="notifications-outline" size={18} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.adRowLabel}>Area Notifications</Text>
                <Text style={styles.adRowSubLabel}>Alerts for issues in your radius</Text>
              </View>
            </View>
            <Switch
              value={user?.notifications_enabled ?? true}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
              thumbColor={user?.notifications_enabled ? '#4CAF50' : '#f4f3f4'}
              disabled={updatingAccount}
            />
          </View>
        </View>

        {/* ── DANGER ZONE ── */}
        <Text style={[styles.adSectionTitle, { color: '#D32F2F' }]}>DANGER ZONE</Text>
        <TouchableOpacity style={styles.adDangerCard} onPress={handleDeleteAccount}>
          <View style={[styles.adIconBox, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="trash-outline" size={18} color="#D32F2F" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.adDangerTitle}>Delete Account</Text>
            <Text style={styles.adDangerSubtitle}>This action is permanent and cannot be undone.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D32F2F" />
        </TouchableOpacity>
      </ScrollView>

      {/* Password Modal */}
      <Modal visible={isPasswordModalVisible} transparent animationType="slide" onRequestClose={() => setIsPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            {passwordStep === 1 ? (
              <>
                <Text style={styles.modalSubtext}>Enter your current and new password.</Text>
                
                <View style={styles.passwordInputContainer}>
                  <TextInput style={styles.passwordInput} placeholder="Current Password" secureTextEntry={!showCurrentPassword} value={currentPassword} onChangeText={setCurrentPassword} />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons name={showCurrentPassword ? "eye-off" : "eye"} size={20} color="#888" />
                  </TouchableOpacity>
                </View>

                <View style={styles.passwordInputContainer}>
                  <TextInput style={styles.passwordInput} placeholder="New Password" secureTextEntry={!showNewPassword} value={newPassword} onChangeText={setNewPassword} />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={20} color="#888" />
                  </TouchableOpacity>
                </View>

                <View style={styles.passwordInputContainer}>
                  <TextInput style={styles.passwordInput} placeholder="Confirm New Password" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#888" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleRequestPasswordOtp} disabled={updatingAccount}>
                  {updatingAccount ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Request OTP</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSubtext}>Enter the OTP sent to your email.</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput style={styles.passwordInput} placeholder="OTP Code" value={passwordOtp} onChangeText={setPasswordOtp} keyboardType="number-pad" />
                </View>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleChangePassword} disabled={updatingAccount}>
                  {updatingAccount ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Update Password</Text>}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)} style={{ marginTop: 10 }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  backButton: { marginRight: 12, padding: 2 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  avatarPlaceholder: {
    backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center',
  },
  
  // Account Details Premium Styles
  adHeroBanner: { height: 210, backgroundColor: '#1A2B2A', overflow: 'hidden', marginBottom: -40 },
  adHeroGradientOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(76,175,80,0.18)' },
  adHeroContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 16 },
  adAvatarRing: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: '#4CAF50',
    backgroundColor: '#333', marginBottom: 10,
    shadowColor: '#4CAF50', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  adAvatarImg: { width: 78, height: 78, borderRadius: 39 },
  adHeroName: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  adMemberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  adMemberChipText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  adStatCard: {
    backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 20, marginBottom: 8, paddingTop: 18,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4, zIndex: 10, overflow: 'hidden',
  },
  adStatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  adStatItemLeft: { flex: 2, paddingHorizontal: 16, paddingVertical: 4, justifyContent: 'center' },
  adStatItemRight: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  adStatTitleText: { fontSize: 17, fontWeight: '800', color: '#191c1d', letterSpacing: -0.3, marginBottom: 4 },
  adStatLevelText: { fontSize: 12, color: '#999', fontWeight: '600', letterSpacing: 0.2 },
  adStatValue: { fontSize: 20, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  adStatLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginTop: 3, textAlign: 'center', lineHeight: 15 },
  adStatDivider: { width: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  adStatCardDividerH: { height: 1, backgroundColor: '#F4F4F8', marginTop: 14, marginHorizontal: 0 },
  adProgressSection: { paddingHorizontal: 18, paddingVertical: 14 },
  adProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adProgressLabel: { fontSize: 12, color: '#666', fontWeight: '600', flex: 1 },
  adProgressPct: { fontSize: 13, color: '#4CAF50', fontWeight: '800' },
  adProgressTrack: { height: 8, backgroundColor: '#EEFAEE', borderRadius: 8, overflow: 'hidden' },
  adProgressFill: { height: 8, backgroundColor: '#4CAF50', borderRadius: 8 },
  adProgressFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  adProgressFooterText: { fontSize: 10, color: '#bbb', fontWeight: '500' },

  adSectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1.2, marginHorizontal: 24, marginTop: 22, marginBottom: 8 },
  adCard: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  adRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  adRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  adIconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  adRowLabel: { fontSize: 12, color: '#999', fontWeight: '500', marginBottom: 2 },
  adRowValue: { fontSize: 15, color: '#191c1d', fontWeight: '600' },
  adRowSubLabel: { fontSize: 12, color: '#bbb', marginTop: 2 },
  adEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EBF5EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  adEditBtnText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  adUsernameEditBlock: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  adEditInputFull: { fontSize: 16, color: '#191c1d', fontWeight: '600', borderBottomWidth: 1.5, borderBottomColor: '#4CAF50', paddingVertical: 6, marginTop: 4, flex: 1 },
  adEditActionRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginLeft: 52 },
  adSaveBtn: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  adSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  adCancelBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  adCancelBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  adLockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  adLockedText: { fontSize: 12, color: '#999', fontWeight: '500' },
  adChevronText: { fontSize: 13, color: '#bbb', fontWeight: '500' },
  adDangerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#FFDAD6',
    shadowColor: '#D32F2F', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  adDangerTitle: { fontSize: 15, fontWeight: '700', color: '#D32F2F' },
  adDangerSubtitle: { fontSize: 12, color: '#E57373', marginTop: 2 },
  
  // Modal Styles
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 12, paddingRight: 16 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#191c1d', marginBottom: 8, textAlign: 'center' },
  modalSubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalPrimaryBtn: { backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  modalPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalCancelText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 12, padding: 8 },
});
