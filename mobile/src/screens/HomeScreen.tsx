import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

// Time formatter
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 24) return `${diffHrs} hours ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} days ago`;
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  
  // Navigation State
  const [activeSegment, setActiveSegment] = useState('Feed'); // 'Feed' | 'Map'
  const [activeBottomNav, setActiveBottomNav] = useState('Feed'); // 'Feed' | 'My Reports' | 'Profile'
  
  // Data State
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile specific states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadIssues = async () => {
    setLoading(true);
    try {
      if (activeBottomNav === 'Feed') {
        const data = await api.getIssues(); // Add GPS coordinates here eventually
        setIssues(data);
      } else if (activeBottomNav === 'My Reports') {
        const data = await api.getMyIssues();
        setIssues(data);
      }
    } catch (err: any) {
      console.log('Error Loading Issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBottomNav === 'Feed' || activeBottomNav === 'My Reports') {
      loadIssues();
    }
  }, [activeBottomNav]);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // STRICTLY IMAGES ONLY
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      "Update Profile Picture",
      "Choose a source for your new avatar",
      [
        { text: "Take Photo", onPress: () => handlePickImage(true) },
        { text: "Choose from Gallery", onPress: () => handlePickImage(false) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const uploadImage = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const updatedUser = await api.uploadAvatar(uri);
      
      // Update the user in AuthContext so UI updates instantly
      import('@react-native-async-storage/async-storage').then(async (AsyncStorage) => {
          const token = await AsyncStorage.default.getItem('access_token');
          if (token) {
              await login(token, updatedUser);
          }
      });
      Alert.alert("Success", "Avatar updated successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    try {
      setUploadingAvatar(true);
      const updatedUser = await api.removeAvatar();
      
      import('@react-native-async-storage/async-storage').then(async (AsyncStorage) => {
          const token = await AsyncStorage.default.getItem('access_token');
          if (token) {
              await login(token, updatedUser);
          }
      });
      Alert.alert("Success", "Avatar removed successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to remove avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const displayName = user?.name || user?.full_name || 'Jane Doe';
  const displayTitle = user?.title || 'Level 1: Citizen Explorer';
  const avatarUrl = user?.avatar_url || 'https://i.pravatar.cc/150?u=fallback';
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* 1. Header Segment */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.greeting}>Hello, {displayName}</Text>
          <View style={styles.titleRow}>
            <Ionicons name="star" size={12} color="#4CAF50" />
            <Text style={styles.gamifiedTitle}>{displayTitle} • {user?.points || 0} pts</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '70%' }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.avatarButton} onPress={() => setActiveBottomNav('Profile')}>
          <Image 
            source={{ uri: avatarUrl }} 
            style={styles.avatarImage} 
          />
        </TouchableOpacity>
      </View>

      {/* Main Display Area Based on Navigation */}
      {activeBottomNav === 'Profile' ? (
        <View style={styles.profileContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.profileLargeAvatar} />
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileMeta}>{user?.email} • {user?.role}</Text>
          
          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={showImagePickerOptions} disabled={uploadingAvatar}>
              <Text style={styles.btnPrimaryText}>{uploadingAvatar ? "Uploading..." : "Upload New Avatar"}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnSecondary} onPress={handleAvatarRemove}>
              <Text style={styles.btnSecondaryText}>Remove Avatar</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 40, width: '100%' }}>
              <TouchableOpacity style={styles.btnDanger} onPress={logout}>
                <Ionicons name="log-out-outline" size={20} color="#ff4444" style={{marginRight: 8}} />
                <Text style={styles.btnDangerText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Segmented Control for Feed / Map */}
          {activeBottomNav === 'Feed' && (
            <View style={styles.segmentContainer}>
              <TouchableOpacity 
                style={[styles.segmentButton, activeSegment === 'Feed' && styles.segmentActive]}
                onPress={() => setActiveSegment('Feed')}
              >
                <Text style={[styles.segmentText, activeSegment === 'Feed' && styles.segmentTextActive]}>Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentButton, activeSegment === 'Map' && styles.segmentActive]}
                onPress={() => setActiveSegment('Map')}
              >
                <Text style={[styles.segmentText, activeSegment === 'Map' && styles.segmentTextActive]}>Map</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeBottomNav === 'My Reports' && (
            <View style={{ padding: 20, paddingBottom: 0 }}>
              <Text style={{ fontSize: 22, fontWeight: '700' }}>Your Reports</Text>
            </View>
          )}

          {/* Issue List */}
          {loading ? (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
               <ActivityIndicator size="large" color="#4CAF50" />
            </View>
          ) : (
            <ScrollView style={styles.feedContainer} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {issues.length === 0 ? (
                <Text style={{ textAlign: 'center', marginTop: 40, color: '#888' }}>No issues found.</Text>
              ) : (
                issues.map(issue => (
                  <View key={issue.id} style={styles.card}>
                    
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardMeta}><Ionicons name="person-outline" size={12} /> {issue.reporter_name || 'Anonymous'} • {formatTime(issue.created_at)}</Text>
                    </View>

                    {issue.image_url && (
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: issue.image_url }} style={styles.cardImage} />
                        <View style={[styles.statusPill, { backgroundColor: issue.category_color }]}>
                          <Text style={styles.statusText}>{issue.status}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{issue.title}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>{issue.description}</Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <TouchableOpacity style={styles.actionBtn}>
                        <Ionicons name="caret-up-outline" size={20} color="#666" />
                        <Text style={styles.actionText}>{issue.upvotes}</Text>
                        <Ionicons name="caret-down-outline" size={20} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn}>
                        <Ionicons name="chatbubble-outline" size={18} color="#666" />
                        <Text style={[styles.actionText, { marginLeft: 6 }]}>{issue.comments_count}</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveBottomNav('Feed')}>
          <Ionicons name={activeBottomNav === 'Feed' ? "compass" : "compass-outline"} size={26} color={activeBottomNav === 'Feed' ? "#4CAF50" : "#838485"} />
          <Text style={[styles.navText, activeBottomNav === 'Feed' && { color: '#4CAF50' }]}>Feed</Text>
        </TouchableOpacity>

        <View style={styles.fabWrapper}>
          <TouchableOpacity style={styles.fab}>
            <Ionicons name="camera" size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveBottomNav('My Reports')}>
          <Ionicons name={activeBottomNav === 'My Reports' ? "clipboard" : "clipboard-outline"} size={26} color={activeBottomNav === 'My Reports' ? "#4CAF50" : "#838485"} />
          <Text style={[styles.navText, activeBottomNav === 'My Reports' && { color: '#4CAF50' }]}>My Reports</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
  headerTextGroup: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333333',
    letterSpacing: -0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gamifiedTitle: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 4,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    width: 140,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  avatarButton: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },

  // Segment
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#EEEEEE',
    borderRadius: 8,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
  },
  segmentTextActive: {
    color: '#4CAF50',
  },

  // Feed
  feedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardMeta: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  cardDistance: {
    fontSize: 12,
    color: '#006399',
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginHorizontal: 4,
  },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: width,
    height: 85,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 15, // Lifted for home bar
  },
  navText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    color: '#838485',
  },
  fabWrapper: {
    position: 'absolute',
    top: -24,
    left: (width / 2) - 32, // Centered
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // Profile specific styles
  profileContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  profileLargeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333333',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 30,
  },
  profileActions: {
    width: '100%',
    alignItems: 'center',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
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
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#333333',
    fontWeight: '600',
    fontSize: 16,
  },
  btnDanger: {
    flexDirection: 'row',
    width: '100%',
    borderColor: '#ff4444',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: {
    color: '#ff4444',
    fontWeight: '700',
    fontSize: 16,
  }
});
