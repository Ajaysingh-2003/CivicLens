import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';

const { width } = Dimensions.get('window');

// Dummy data for visual replication
const DUMMY_ISSUES = [
  {
    id: '1',
    user: 'Michael Scott',
    time: '2 hours ago',
    distance: '1.2 km away',
    title: 'Massive Pothole on 5th Avenue',
    description: 'Causing severe traffic slowdowns. Deep enough to damage tires.',
    status: 'IN PROGRESS',
    statusColor: '#006399',
    upvotes: 156,
    comments: 24,
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: '2',
    user: 'Leslie Knope',
    time: '5 hours ago',
    distance: '3.4 km away',
    title: 'Illegal Dumping at Pawnee Park',
    description: 'Construction debris left blocking the pedestrian sidewalk.',
    status: 'PENDING',
    statusColor: '#838485',
    upvotes: 89,
    comments: 12,
    image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?q=80&w=800&auto=format&fit=crop'
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Feed');

  const displayName = user?.name || user?.full_name || 'Jane Doe';
  const displayTitle = user?.title || 'Level 1: Citizen Explorer';
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* 1. Header Segment */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.greeting}>Hello, {displayName}</Text>
          <View style={styles.titleRow}>
            <Ionicons name="star" size={12} color="#4CAF50" />
            <Text style={styles.gamifiedTitle}>{displayTitle}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '70%' }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.avatarButton}>
          <Image 
            source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }} 
            style={styles.avatarImage} 
          />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity 
          style={[styles.segmentButton, activeTab === 'Feed' && styles.segmentActive]}
          onPress={() => setActiveTab('Feed')}
        >
          <Text style={[styles.segmentText, activeTab === 'Feed' && styles.segmentTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segmentButton, activeTab === 'Map' && styles.segmentActive]}
          onPress={() => setActiveTab('Map')}
        >
          <Text style={[styles.segmentText, activeTab === 'Map' && styles.segmentTextActive]}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Main Content Feed */}
      <ScrollView style={styles.feedContainer} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {DUMMY_ISSUES.map(issue => (
          <View key={issue.id} style={styles.card}>
            
            <View style={styles.cardHeader}>
              <Text style={styles.cardMeta}><Ionicons name="person-outline" size={12} /> {issue.user} • {issue.time}</Text>
              <Text style={styles.cardDistance}><Ionicons name="location-outline" size={12} /> {issue.distance}</Text>
            </View>

            <View style={styles.imageContainer}>
              <Image source={{ uri: issue.image }} style={styles.cardImage} />
              <View style={[styles.statusPill, { backgroundColor: issue.statusColor }]}>
                <Text style={styles.statusText}>{issue.status}</Text>
              </View>
            </View>

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
                <Text style={[styles.actionText, { marginLeft: 6 }]}>{issue.comments}</Text>
              </TouchableOpacity>
            </View>

          </View>
        ))}
      </ScrollView>

      {/* 3. Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="compass" size={26} color="#4CAF50" />
          <Text style={[styles.navText, { color: '#4CAF50' }]}>Feed</Text>
        </TouchableOpacity>

        {/* Center Floating Action Button */}
        <View style={styles.fabWrapper}>
          <TouchableOpacity style={styles.fab}>
            <Ionicons name="camera" size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="clipboard-outline" size={26} color="#838485" />
          <Text style={styles.navText}>My Reports</Text>
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
  }
});
