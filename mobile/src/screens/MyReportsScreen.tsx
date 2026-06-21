import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import IssueCard from '../components/IssueCard';
import ReportIncidentModal from '../components/ReportIncidentModal';

export default function MyReportsScreen({ navigation }: any) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { login } = useAuth();
  
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [reportImageUri, setReportImageUri] = useState<string | null>(null);

  const handleReportPress = async () => {
    try {
      // 1. Request Camera Permissions
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to report an issue.');
        return;
      }
      
      // 2. Request Location Permissions
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to accurately map your report.');
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

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMyIssues();
      setIssues(data);
    } catch (err: any) {
      console.log('Error loading issues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
    const subscription = DeviceEventEmitter.addListener('refreshFeed', loadIssues);
    return () => subscription.remove();
  }, [loadIssues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.getMyIssues();
      setIssues(data);
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
              loadIssues(); // refresh the list
              DeviceEventEmitter.emit('refreshFeed'); // refresh home feed
              // Refresh user points
              try {
                const updatedUser = await api.getMe();
                const token = await AsyncStorage.getItem("access_token");
                if (token) login(token, updatedUser);
              } catch (e) {
                console.log("Failed to refresh user points", e);
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete issue");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>My Reports</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8, flexGrow: issues.length === 0 ? 1 : undefined }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
        >
          {issues.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="document-text-outline" size={40} color="#4CAF50" />
              </View>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySubtitle}>
                Spot an issue in your area? Take a photo and help your community.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleReportPress} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.emptyBtnText}>Create your first report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            issues.map(issue => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isMyReport={true}
                onPress={() => navigation.navigate('IssueDetails', { issue })}
                onDelete={handleDeleteIssue}
              />
            ))
          )}
        </ScrollView>
      )}

      <ReportIncidentModal
        visible={isReportModalVisible}
        imageUri={reportImageUri}
        onClose={() => { setReportModalVisible(false); setReportImageUri(null); }}
        onSuccess={async () => {
          setReportModalVisible(false);
          setReportImageUri(null);
          loadIssues(); // Refresh the list of reports
          try {
            const updatedUser = await api.getMe();
            const token = await AsyncStorage.getItem("access_token");
            if (token) login(token, updatedUser);
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  feed: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14, color: '#999', textAlign: 'center',
    lineHeight: 21, marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: '#4CAF50', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  emptyBtnText: {
    color: '#fff', fontSize: 16, fontWeight: '700',
  },
});
