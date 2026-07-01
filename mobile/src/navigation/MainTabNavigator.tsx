import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Platform, DeviceEventEmitter } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import ReportIncidentModal from '../components/ReportIncidentModal';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function CameraTabButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.cameraTabWrapper} pointerEvents="box-none">
      <TouchableOpacity style={styles.cameraBtn} onPress={onPress} activeOpacity={0.85}>
        <Ionicons name="camera" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<any>();

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

  const TAB_BAR_HEIGHT = 60;

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === 'Camera') return <View />;
            let iconName = 'home-outline';
            if (route.name === 'Feed') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'MyReports') iconName = focused ? 'document-text' : 'document-text-outline';
            else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: '#aaa',
          tabBarStyle: {
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#eee',
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 2,
          },
        })}
      >
        <Tab.Screen name="Feed" options={{ title: 'Home' }}>
          {(props: any) => <HomeScreen {...props} onReportPress={handleReportPress} />}
        </Tab.Screen>
        <Tab.Screen
          name="Camera"
          component={HomeScreen} // placeholder, never rendered
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarIcon: () => null,
            tabBarButton: () => (
              <CameraTabButton onPress={handleReportPress} />
            ),
          }}
          listeners={{ tabPress: e => { e.preventDefault(); handleReportPress(); } }}
        />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>

      <ReportIncidentModal
        visible={isReportModalVisible}
        imageUri={reportImageUri}
        onClose={() => { setReportModalVisible(false); setReportImageUri(null); }}
        onSuccess={async () => {
          setReportModalVisible(false);
          setReportImageUri(null);
          DeviceEventEmitter.emit('refreshFeed');
          try {
            await refreshUser();
          } catch (e) {
            console.log("Failed to refresh user points", e);
          }
        }}
        onViewIssue={(issue: any) => {
          setReportModalVisible(false);
          setReportImageUri(null);
          navigation.navigate('IssueDetails', { issue });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cameraTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  cameraBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
