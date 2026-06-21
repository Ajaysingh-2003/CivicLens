import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Animated, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import { useLevels } from '../hooks/useLevels';
import IssueCard from '../components/IssueCard';

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

export default function HomeScreen({ navigation, onReportPress }: any) {
  const { user } = useAuth();
  const levelsConfig = useLevels();

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Fallback to no location if denied (backend will return generic newest)
        const data = await api.getIssues();
        setIssues(data);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const data = await api.getIssues(location.coords.latitude, location.coords.longitude, 5.0);
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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const data = await api.getIssues();
        setIssues(data);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const data = await api.getIssues(location.coords.latitude, location.coords.longitude, 5.0);
      setIssues(data);
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const displayName = user?.username || 'Citizen';
  const displayTitle = user?.title || 'Citizen Reporter';
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
          <View>
            <Text style={styles.greeting}>Hello, {displayName}</Text>
            <View style={styles.levelRow}>
              <Ionicons name="star" size={11} color="#4CAF50" />
              <Text style={styles.levelText}>{displayTitle} • {pts} pts</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pointsPct}%` as any }]} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.main}>
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
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="location-outline" size={40} color="#4CAF50" />
                </View>
                <Text style={styles.emptyTitle}>All clear nearby!</Text>
                <Text style={styles.emptySubtitle}>
                  There are no issues reported within 5km of your location. 
                  Spot something? Be the first to report it and earn a point!
                </Text>
                {onReportPress && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={onReportPress} activeOpacity={0.85}>
                    <Ionicons name="camera-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.emptyBtnText}>Report an issue</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              issues.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onPress={() => navigation.navigate('IssueDetails', { issue })}
                />
              ))
            )}
          </ScrollView>
        )}

      </View>
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
  greeting: { fontSize: 22, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  levelText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 4 },
  progressTrack: { height: 3, backgroundColor: '#E8E8E8', borderRadius: 2, width: 120, marginTop: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 2 },

  // Feed
  feed: { flex: 1 },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 100 },
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

  // Skeleton Styles
  card: { backgroundColor: '#FFFFFF', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cardMetaPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBodyPremium: { paddingHorizontal: 16, paddingBottom: 12 },
  cardFooterPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  skelImage: { width: '100%', height: 260, backgroundColor: '#E2E8F0' },
  skelAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0' },
  skelTextShort: { width: 100, height: 14, borderRadius: 4, backgroundColor: '#E2E8F0' },
  skelTitle: { width: '90%', height: 22, borderRadius: 6, backgroundColor: '#E2E8F0', marginBottom: 4 },
  skelPill: { width: 90, height: 38, borderRadius: 20, backgroundColor: '#E2E8F0' },
  skelComment: { width: 60, height: 38, borderRadius: 20, backgroundColor: '#E2E8F0' },

});
