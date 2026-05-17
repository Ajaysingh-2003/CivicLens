import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Dimensions, StatusBar, ActivityIndicator, Alert, Modal, RefreshControl,
  TextInput, Switch, Animated
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

type ActiveView = 'Feed' | 'MyReports' | 'Profile' | 'AccountDetails' | 'IssueDetails';

const SkeletonFeed = () => {
  const [pulse] = useState(new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const renderSkeletonCard = (key: number) => (
    <Animated.View key={key} style={[styles.card, { opacity: pulse }]}>
      <View style={styles.cardMetaPremium}>
        <View style={styles.cardMetaLeft}>
          <View style={styles.skelAvatar} />
          <View style={styles.skelTextShort} />
        </View>
      </View>
      <View style={styles.cardBodyPremium}>
        <View style={styles.skelTitle} />
        <View style={[styles.skelTitle, { width: '70%', marginBottom: 0 }]} />
      </View>
      <View style={styles.skelImage} />
      <View style={styles.cardFooterPremium}>
        <View style={styles.skelPill} />
        <View style={styles.skelComment} />
      </View>
    </Animated.View>
  );

  return (
    <View style={{ paddingTop: 0 }}>
      {[1, 2, 3].map(renderSkeletonCard)}
    </View>
  );
};

export default function HomeScreen() {
  const { user, login, logout } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('Feed');
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');

  const loadComments = async (issueId: number) => {
    try {
      const data = await api.getComments(issueId);
      setComments(data);
    } catch (e) {
      console.log('Failed to load comments', e);
    }
  };
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Profile / Avatar states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAvatarModalVisible, setAvatarModalVisible] = useState(false);

  // Report modal
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportImageUri, setReportImageUri] = useState<string | null>(null);

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

  // Gamification level config — fetched from API, cached in AsyncStorage
  type LevelConfig = { level: number; title: string; min_points: number };
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>([
    // Fallback defaults while loading (matches DB seed)
    { level: 1, title: 'Citizen Reporter',     min_points: 0    },
    { level: 2, title: 'Civic Observer',       min_points: 100  },
    { level: 3, title: 'Community Voice',      min_points: 300  },
    { level: 4, title: 'Neighborhood Guardian',min_points: 600  },
    { level: 5, title: 'City Watchdog',        min_points: 1000 },
    { level: 6, title: 'Civic Champion',       min_points: 1500 },
    { level: 7, title: 'Urban Protector',      min_points: 2200 },
    { level: 8, title: 'District Leader',      min_points: 3000 },
    { level: 9, title: 'City Steward',         min_points: 5000 },
    { level: 10, title: 'Civic Legend',        min_points: 8000 },
  ]);

  useEffect(() => {
    api.getLevels().then(setLevelsConfig).catch(() => {/* use fallback */});
  }, []);

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
    }, 300); // Slight delay so the modal closes smoothly before the alert pops up
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

  const handleDeleteIssue = (issueId: number) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this report?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteIssue(issueId);
              loadIssues('MyReports'); // refresh the list
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete issue");
            }
          }
        }
      ]
    );
  };

  const displayName = user?.username || 'Citizen';
  const displayTitle = user?.title || 'Citizen Reporter';
  const avatarUrl = user?.avatar_url || null;

  // ─── LEVEL SYSTEM — driven by levelsConfig fetched from API ────────────────
  const pts = user?.points || 0;
  // Normalize to the shape we use internally (min_points → minPoints)
  const LEVELS = levelsConfig.map(l => ({ level: l.level, title: l.title, minPoints: l.min_points }));
  const currentLevelData = [...LEVELS].reverse().find(l => pts >= l.minPoints) || LEVELS[0];
  const nextLevelData = LEVELS[currentLevelData.level] || null; // null if max level

  const levelProgressPct = nextLevelData
    ? Math.min(((pts - currentLevelData.minPoints) / (nextLevelData.minPoints - currentLevelData.minPoints)) * 100, 100)
    : 100;
  const ptsToNext = nextLevelData ? nextLevelData.minPoints - pts : 0;
  const pointsPct = levelProgressPct;

  // ─── HEADER ──────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {activeView === 'Profile' || activeView === 'AccountDetails' || activeView === 'IssueDetails' ? (
          <TouchableOpacity onPress={() => {
            if (activeView === 'IssueDetails') { setActiveView('Feed'); setSelectedIssue(null); }
            else { setActiveView(activeView === 'AccountDetails' ? 'Profile' : 'Feed'); }
          }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
        ) : activeView === 'MyReports' ? (
          <TouchableOpacity onPress={() => setActiveView('Profile')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.greeting}>
            {activeView === 'Profile' ? 'Account' : activeView === 'MyReports' ? 'My Reports' : activeView === 'AccountDetails' ? 'Account Details' : activeView === 'IssueDetails' ? 'Post' : `Hello, ${displayName}`}
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
      {activeView !== 'Profile' && activeView !== 'AccountDetails' && (
        <TouchableOpacity onPress={() => setActiveView('Profile')} style={styles.avatarBtn}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            : <View style={[styles.avatarImg, styles.avatarPlaceholder]}><Ionicons name="person" size={22} color="#aaa" /></View>
          }
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── ISSUE CARD (REDDIT STYLE) ─────────────────────────────────────────────
  const renderCard = (issue: any) => {
    const netVotes = (issue.upvotes || 0) - (issue.downvotes || 0);
    return (
      <TouchableOpacity 
        key={issue.id} 
        style={styles.card}
        activeOpacity={0.95}
        onPress={() => {
          setSelectedIssue(issue);
          loadComments(issue.id);
          setActiveView('IssueDetails');
        }}
        onLongPress={() => {
          if (activeView === 'MyReports') {
            handleDeleteIssue(issue.id);
          }
        }}
      >
        {/* Header: Avatar, Name, Time, Category */}
        <View style={styles.cardMetaPremium}>
          <View style={styles.cardMetaLeft}>
            <View style={styles.reporterAvatarSmall}>
              <Ionicons name="person" size={12} color="#aaa" />
            </View>
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

        {/* Title */}
        <View style={styles.cardBodyPremium}>
          <Text style={styles.cardTitlePremium} numberOfLines={2}>{issue.title}</Text>
        </View>

        {/* Full-width Image */}
        {issue.image_url && (
          <View style={styles.cardImageContainer}>
            <Image source={{ uri: issue.image_url }} style={styles.cardImagePremium} />
          </View>
        )}

        {/* Footer: Combined Votes and Comments */}
        <View style={styles.cardFooterPremium}>
          <View style={styles.votePill}>
            <TouchableOpacity style={styles.voteAction}>
              <Ionicons name="arrow-down-outline" size={20} color="#718096" />
            </TouchableOpacity>
            <Text style={styles.voteScore}>{netVotes}</Text>
            <TouchableOpacity style={styles.voteAction}>
              <Ionicons name="arrow-up-outline" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.commentPill}>
            <Ionicons name="chatbubble-outline" size={18} color="#718096" />
            <Text style={styles.commentBtnText}>{issue.comments_count}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── FEED / MY REPORTS ────────────────────────────────────────────────────────
  const renderFeed = () => (
    <>
      {loading ? (
        <SkeletonFeed />
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

  // ─── ACCOUNT DETAILS ──────────────────────────────────────────────────────────
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
      Alert.alert("Error", err.message || "Failed to update username");
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

  const renderAccountDetails = () => (
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
        {/* Top: 2-column metrics */}
        <View style={styles.adStatRow}>
          {/* Left 2/3 — Title + Level */}
          <View style={styles.adStatItemLeft}>
            <Text style={styles.adStatTitleText}>{currentLevelData.title}</Text>
            <Text style={styles.adStatLevelText}>Level {currentLevelData.level}</Text>
          </View>

          <View style={styles.adStatDivider} />

          {/* Right 1/3 — Points */}
          <View style={styles.adStatItemRight}>
            <Text style={styles.adStatValue}>{pts}</Text>
            <Text style={styles.adStatLabel}>Reputation{'\n'}Points</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.adStatCardDividerH} />

        {/* Progress bar section */}
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
        {/* Username */}
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

        {/* Email */}
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
              <Text style={styles.adRowSubLabel}>Alerts for issues in your 5km radius</Text>
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
  );

  // ─── PROFILE ──────────────────────────────────────────────────────────────────
  const renderProfile = () => (
    <ScrollView style={styles.profileScroll} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={styles.profileAvatarWrapper}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
            : <View style={[styles.profileAvatar, styles.avatarPlaceholder]}><Ionicons name="person" size={50} color="#aaa" /></View>
          }
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
          { icon: 'person-outline', label: 'Account Details', action: () => setActiveView('AccountDetails') },
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

  // ─── ISSUE DETAILS (FULL VIEW) ─────────────────────────────────────────────
  const renderIssueDetails = () => {
    if (!selectedIssue) return null;
    const issue = selectedIssue;
    const netVotes = (issue.upvotes || 0) - (issue.downvotes || 0);

    const handleCommentSubmit = async () => {
      if (!commentInput.trim()) return;
      try {
        await api.addComment(issue.id, commentInput.trim());
        setCommentInput('');
        loadComments(issue.id);
        setSelectedIssue({ ...issue, comments_count: (issue.comments_count || 0) + 1 });
        setIssues(issues.map(i => i.id === issue.id ? { ...i, comments_count: (i.comments_count || 0) + 1 } : i));
      } catch (e) {
        Alert.alert("Error", "Could not post comment");
      }
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={[styles.card, { borderBottomWidth: 0, marginBottom: 0 }]}>
            <View style={styles.cardMetaPremium}>
              <View style={styles.cardMetaLeft}>
                <View style={styles.reporterAvatarSmall}>
                  <Ionicons name="person" size={12} color="#aaa" />
                </View>
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

            <View style={styles.cardBodyPremium}>
              <Text style={styles.cardTitlePremium}>{issue.title}</Text>
            </View>

            {issue.image_url && (
              <View style={styles.cardImageContainer}>
                <Image source={{ uri: issue.image_url }} style={styles.cardImagePremium} />
              </View>
            )}

            <View style={styles.cardBodyPremium}>
              <Text style={[styles.cardDescPremium, { marginTop: 12 }]}>{issue.description}</Text>
            </View>

            <View style={styles.cardFooterPremium}>
              <View style={styles.votePill}>
                <TouchableOpacity style={styles.voteAction}>
                  <Ionicons name="arrow-down-outline" size={20} color="#718096" />
                </TouchableOpacity>
                <Text style={styles.voteScore}>{netVotes}</Text>
                <TouchableOpacity style={styles.voteAction}>
                  <Ionicons name="arrow-up-outline" size={20} color="#4CAF50" />
                </TouchableOpacity>
              </View>

              <View style={styles.commentPill}>
                <Ionicons name="chatbubble-outline" size={18} color="#718096" />
                <Text style={styles.commentBtnText}>{issue.comments_count}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.commentsDivider} />

          <View style={styles.commentsSection}>
            {comments.length === 0 ? (
              <Text style={styles.noCommentsText}>Be the first one to comment.</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={styles.reporterAvatarSmall}>
                      <Ionicons name="person" size={10} color="#aaa" />
                    </View>
                    <Text style={styles.commentAuthor}>{c.author_name}</Text>
                    <Text style={styles.cardMetaDivider}>·</Text>
                    <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                  </View>
                  <Text style={styles.commentContent}>{c.content}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.commentInputContainer}>
          <TextInput 
            style={styles.commentInputBox}
            placeholder="Add a comment..."
            value={commentInput}
            onChangeText={setCommentInput}
            multiline
          />
          <TouchableOpacity style={styles.commentSubmitBtn} onPress={handleCommentSubmit} disabled={!commentInput.trim()}>
            <Ionicons name="send" size={20} color={commentInput.trim() ? '#4CAF50' : '#ccc'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      {renderHeader()}
      <View style={styles.main}>
        {activeView === 'Feed' ? renderFeed() : 
         activeView === 'MyReports' ? renderFeed() : 
         activeView === 'Profile' ? renderProfile() : 
         activeView === 'IssueDetails' ? renderIssueDetails() :
         renderAccountDetails()}
      </View>

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

      {/* Avatar Modal */}
      <Modal visible={isAvatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayDark} activeOpacity={1} onPress={() => setAvatarModalVisible(false)}>
          
          {/* Enlarged Avatar */}
          <View style={styles.enlargedAvatarContainer}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.enlargedAvatar} />
              : <View style={[styles.enlargedAvatar, styles.avatarPlaceholder]}><Ionicons name="person" size={90} color="#aaa" /></View>
            }
          </View>

          {/* Action Buttons */}
          <View style={styles.avatarActionsRow}>
            {/* Change Photo */}
            <View style={styles.avatarActionItem}>
              <TouchableOpacity style={styles.avatarActionBtn} onPress={handleChangePhotoPrompt}>
                <Ionicons name="camera-outline" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={styles.avatarActionText}>Change Photo</Text>
            </View>

            {/* Delete Photo */}
            <View style={styles.avatarActionItem}>
              <TouchableOpacity style={[styles.avatarActionBtn, { borderColor: '#ffebee' }]} onPress={() => { setAvatarModalVisible(false); handleAvatarRemove(); }}>
                <Ionicons name="trash-outline" size={26} color="#D32F2F" />
              </TouchableOpacity>
              <Text style={[styles.avatarActionText, { color: '#D32F2F' }]}>Delete Photo</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <ReportIncidentModal
        visible={isReportModalVisible}
        imageUri={reportImageUri}
        onClose={() => { setReportModalVisible(false); setReportImageUri(null); }}
        onSuccess={async () => {
          setReportModalVisible(false);
          setReportImageUri(null);
          loadIssues('Feed');
          try {
            const updatedUser = await api.getMe();
            const token = await AsyncStorage.getItem("access_token");
            if (token) {
              login(token, updatedUser);
            }
          } catch (e) {
            console.log("Failed to refresh user points", e);
          }
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
  avatarPlaceholder: {
    backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },

  // Feed
  feed: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#bbb', marginTop: 16 },
  emptyStateSubText: { fontSize: 14, color: '#ccc', marginTop: 6 },

  // Card (Reddit Redesign)
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardImageContainer: {
    width: '100%', height: 260,
    backgroundColor: '#f0f0f0',
  },
  cardImagePremium: {
    width: '100%', height: '100%',
  },
  cardMetaPremium: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reporterAvatarSmall: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#EDF2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  cardMetaText: { fontSize: 13, color: '#718096', fontWeight: '500' },
  cardMetaDivider: { fontSize: 13, color: '#CBD5E0' },
  cardBodyPremium: { paddingHorizontal: 16, paddingBottom: 12 },
  cardTitlePremium: { fontSize: 18, fontWeight: '700', color: '#1A202C', letterSpacing: -0.2, lineHeight: 24 },
  cardDescPremium: { fontSize: 14, color: '#4A5568', lineHeight: 22 },
  cardFooterPremium: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  votePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 24,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  voteAction: {
    padding: 6, borderRadius: 16,
  },
  voteScore: {
    fontSize: 14, fontWeight: '700', color: '#1A202C', minWidth: 24, textAlign: 'center',
  },
  commentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24,
  },
  commentBtnText: { fontSize: 14, color: '#4A5568', fontWeight: '600' },
  categoryChip: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  categoryChipText: { fontSize: 11, fontWeight: '700' },

  // Comments Section
  commentsDivider: { height: 8, backgroundColor: '#F0F2F5', width: '100%' },
  commentsSection: { padding: 16, backgroundColor: '#FFFFFF' },
  noCommentsText: { textAlign: 'center', color: '#718096', fontStyle: 'italic', marginVertical: 20 },
  commentItem: { marginBottom: 16 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#2D3748' },
  commentTime: { fontSize: 12, color: '#A0AEC0' },
  commentContent: { fontSize: 14, color: '#4A5568', lineHeight: 20, paddingLeft: 26 },
  commentInputContainer: { 
    flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', 
    backgroundColor: '#FFFFFF', alignItems: 'flex-end',
    position: 'absolute', bottom: 0, left: 0, right: 0
  },
  commentInputBox: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 16, 
    paddingTop: 10, paddingBottom: 10, maxHeight: 100, fontSize: 14,
  },
  commentSubmitBtn: { padding: 10, marginLeft: 8 },

  // Skeleton Styles
  skelImage: { width: '100%', height: 260, backgroundColor: '#E2E8F0' },
  skelAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0' },
  skelTextShort: { width: 100, height: 14, borderRadius: 4, backgroundColor: '#E2E8F0' },
  skelTitle: { width: '90%', height: 22, borderRadius: 6, backgroundColor: '#E2E8F0', marginBottom: 4 },
  skelPill: { width: 90, height: 38, borderRadius: 20, backgroundColor: '#E2E8F0' },
  skelComment: { width: 60, height: 38, borderRadius: 20, backgroundColor: '#E2E8F0' },

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
  // Modal Overlay (Dark Blur Equivalent)
  modalOverlayDark: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  enlargedAvatarContainer: {
    marginBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 10,
  },
  enlargedAvatar: {
    width: 240, height: 240,
    borderRadius: 120,
    borderWidth: 4, borderColor: '#4CAF50',
    backgroundColor: '#333',
  },
  avatarActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40, // Space between the two items
  },
  avatarActionItem: {
    alignItems: 'center',
  },
  avatarActionBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  avatarActionText: {
    color: '#fff', fontSize: 13, fontWeight: '600',
  },

  // Account Details — Legacy (kept for modal reuse)
  detailSection: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  detailLabel: { fontSize: 15, color: '#888', fontWeight: '500' },
  detailValue: { fontSize: 15, color: '#191c1d', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  deleteAccountBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 32, paddingVertical: 16,
    backgroundColor: '#fff1f0', borderRadius: 14,
    borderWidth: 1, borderColor: '#ffdad6',
  },
  deleteAccountText: { color: '#D32F2F', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  editInput: {
    borderBottomWidth: 1, borderBottomColor: '#4CAF50',
    fontSize: 15, color: '#191c1d', fontWeight: '600',
    minWidth: 120, paddingVertical: 0, textAlign: 'right',
  },
  memberSinceContainer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, marginTop: 12, gap: 6,
  },
  memberSinceText: { fontSize: 14, color: '#666', fontWeight: '500' },

  // ── Account Details Premium Styles ─────────────────────────────────────────
  adHeroBanner: {
    height: 210,
    backgroundColor: '#1A2B2A',
    overflow: 'hidden',
    marginBottom: -40,
  },
  adHeroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(76,175,80,0.18)',
  },
  adHeroContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 16,
  },
  adAvatarRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3, borderColor: '#4CAF50',
    backgroundColor: '#333',
    marginBottom: 10,
    shadowColor: '#4CAF50', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  adAvatarImg: { width: 78, height: 78, borderRadius: 39 },
  adHeroName: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  adHeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    marginTop: 6,
  },
  adHeroBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  adMemberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
  },
  adMemberChipText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  adStatCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingTop: 18,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
    overflow: 'hidden',
  },
  adStatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  adStatItemLeft: {
    flex: 2, paddingHorizontal: 16, paddingVertical: 4,
    justifyContent: 'center',
  },
  adStatItemRight: {
    flex: 1, alignItems: 'center', paddingVertical: 4,
  },
  adStatItem: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  adStatTitleText: {
    fontSize: 17, fontWeight: '800', color: '#191c1d', letterSpacing: -0.3,
    marginBottom: 4,
  },
  adStatLevelText: {
    fontSize: 12, color: '#999', fontWeight: '600', letterSpacing: 0.2,
  },
  adStatValue: { fontSize: 20, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  adStatLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginTop: 3, textAlign: 'center', lineHeight: 15 },
  adStatDivider: { width: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  adStatCardDividerH: { height: 1, backgroundColor: '#F4F4F8', marginTop: 14, marginHorizontal: 0 },
  adProgressSection: { paddingHorizontal: 18, paddingVertical: 14 },
  adProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adProgressLabel: { fontSize: 12, color: '#666', fontWeight: '600', flex: 1 },
  adProgressPct: { fontSize: 13, color: '#4CAF50', fontWeight: '800' },
  adProgressTrack: {
    height: 8, backgroundColor: '#EEFAEE', borderRadius: 8, overflow: 'hidden',
  },
  adProgressFill: {
    height: 8, backgroundColor: '#4CAF50', borderRadius: 8,
  },
  adProgressFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  adProgressFooterText: { fontSize: 10, color: '#bbb', fontWeight: '500' },

  adSectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1.2,
    marginHorizontal: 24, marginTop: 22, marginBottom: 8,
  },
  adCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  adRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  adRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  adIconBox: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  adRowLabel: { fontSize: 12, color: '#999', fontWeight: '500', marginBottom: 2 },
  adRowValue: { fontSize: 15, color: '#191c1d', fontWeight: '600' },
  adRowSubLabel: { fontSize: 12, color: '#bbb', marginTop: 2 },
  adEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EBF5EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  adEditBtnText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  adEditInput: {
    fontSize: 15, color: '#191c1d', fontWeight: '600',
    borderBottomWidth: 1.5, borderBottomColor: '#4CAF50',
    paddingVertical: 2, minWidth: 140,
  },
  adUsernameEditBlock: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  adEditInputFull: {
    fontSize: 16, color: '#191c1d', fontWeight: '600',
    borderBottomWidth: 1.5, borderBottomColor: '#4CAF50',
    paddingVertical: 6, marginTop: 4, flex: 1,
  },
  adEditActionRow: {
    flexDirection: 'row', gap: 10, marginTop: 14, marginLeft: 52,
  },
  adSaveBtn: {
    flex: 1, backgroundColor: '#4CAF50', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  adSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  adCancelBtn: {
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  adCancelBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  adLockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  adLockedText: { fontSize: 12, color: '#999', fontWeight: '500' },
  adChevronText: { fontSize: 13, color: '#bbb', fontWeight: '500' },
  adDangerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FFDAD6',
    shadowColor: '#D32F2F', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  adDangerTitle: { fontSize: 15, fontWeight: '700', color: '#D32F2F' },
  adDangerSubtitle: { fontSize: 12, color: '#E57373', marginTop: 2 },
  passwordInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 8,
    marginBottom: 12, paddingRight: 16,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#191c1d', marginBottom: 8, textAlign: 'center' },
  modalSubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalPrimaryBtn: {
    backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10,
  },
  modalPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalCancelText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 12, padding: 8 },
});
