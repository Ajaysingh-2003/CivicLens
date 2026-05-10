import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';

export default function ProfileScreen({ navigation }: any) {
  const { user, login, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState<'Menu' | 'Details'>('Menu');

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await api.deleteAccount();
              await logout();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

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
        uploadImage(result.assets[0].uri);
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
        { text: "Remove Avatar", onPress: handleRemoveImage, style: 'destructive' },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);
      // Call the API which uses FormData underneath
      const updatedUser = await api.uploadAvatar(uri);
      
      // Update the user in AuthContext so UI updates instantly
      // Need to retrieve token to pass to login
      import('@react-native-async-storage/async-storage').then(async (AsyncStorage) => {
          const token = await AsyncStorage.default.getItem('access_token');
          if (token) {
              await login(token, updatedUser);
          }
      });
      
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user?.avatar_url) return;
    
    try {
      setLoading(true);
      const updatedUser = await api.removeAvatar();
      
      import('@react-native-async-storage/async-storage').then(async (AsyncStorage) => {
          const token = await AsyncStorage.default.getItem('access_token');
          if (token) {
              await login(token, updatedUser);
          }
      });
    } catch (error: any) {
      Alert.alert('Failed to remove', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {loading ? (
            <View style={[styles.avatar, styles.loadingAvatar]}>
              <ActivityIndicator color="#4CAF50" size="large" />
            </View>
          ) : user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.placeholderText}>{user.username?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.editBadge} onPress={showImagePickerOptions} disabled={loading}>
            <Ionicons name="camera" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.name}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.role.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        {viewState === 'Menu' ? (
          <>
            <TouchableOpacity style={styles.menuItem} onPress={() => setViewState('Details')}>
              <Ionicons name="person-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Account Details</Text>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
              <Ionicons name="settings-outline" size={24} color="#666" />
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.detailsContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setViewState('Menu')}>
              <Ionicons name="arrow-back" size={20} color="#333" />
              <Text style={styles.backButtonText}>Back to Menu</Text>
            </TouchableOpacity>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Username</Text>
              <Text style={styles.detailValue}>{user.username}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Role</Text>
              <Text style={styles.detailValue}>{user.role.replace('_', ' ')}</Text>
            </View>
            {user.city_id && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>City ID</Text>
                <Text style={styles.detailValue}>{user.city_id}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.logoutButton, { marginTop: 40 }]} onPress={handleDeleteAccount} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#D32F2F" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                  <Text style={styles.logoutText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  loadingAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
  },
  placeholderText: {
    fontSize: 48,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
  },
  logoutText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  detailsContainer: {
    padding: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
