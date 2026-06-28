import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

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

interface IssueCardProps {
  issue: any;
  onPress: () => void;
  onDelete?: (id: number) => void;
  onReport?: (id: number) => void;
  isMyReport?: boolean;
  currentUserId?: number;
}

export default function IssueCard({ issue, onPress, onDelete, onReport, isMyReport, currentUserId }: IssueCardProps) {
  const netVotes = (issue.upvotes || 0) - (issue.downvotes || 0);
  const canReport = !isMyReport && (currentUserId !== undefined ? issue.reporter_id !== currentUserId : true);

  const handleLongPress = () => {
    if (isMyReport && onDelete) {
      onDelete(issue.id);
    }
  };

  const handleReportMenu = () => {
    if (!onReport) return;
    Alert.alert(
      "Post Options",
      "What would you like to do?",
      [
        { text: "Report", style: "destructive", onPress: () => onReport(issue.id) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.95}
      onPress={onPress}
      onLongPress={handleLongPress}
    >
      <View style={styles.cardMetaPremium}>
        <View style={styles.cardMetaLeft}>
          {issue.reporter_avatar_url ? (
            <Image source={{ uri: issue.reporter_avatar_url }} style={styles.reporterAvatarSmall} />
          ) : (
            <View style={styles.reporterAvatarSmall}>
              <Ionicons name="person" size={12} color="#aaa" />
            </View>
          )}
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
        <Text style={styles.cardTitlePremium} numberOfLines={2}>{issue.title}</Text>
      </View>

      {issue.image_url && (
        <View style={styles.cardImageContainer}>
          <Image source={{ uri: issue.image_url }} style={styles.cardImagePremium} />
        </View>
      )}

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

        <TouchableOpacity style={styles.commentPill} onPress={onPress}>
          <Ionicons name="chatbubble-outline" size={18} color="#718096" />
          <Text style={styles.commentBtnText}>{issue.comments_count}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />
        
        {canReport && (
          <TouchableOpacity style={styles.moreAction} onPress={handleReportMenu}>
            <Ionicons name="ellipsis-vertical" size={20} color="#718096" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardImageContainer: { width: '100%', height: 260, backgroundColor: '#f0f0f0' },
  cardImagePremium: { width: '100%', height: '100%' },
  cardMetaPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reporterAvatarSmall: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EDF2F7', alignItems: 'center', justifyContent: 'center' },
  cardMetaText: { fontSize: 13, color: '#718096', fontWeight: '500' },
  cardMetaDivider: { fontSize: 13, color: '#CBD5E0' },
  cardBodyPremium: { paddingHorizontal: 16, paddingBottom: 12 },
  cardTitlePremium: { fontSize: 18, fontWeight: '700', color: '#1A202C', letterSpacing: -0.2, lineHeight: 24 },
  cardFooterPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  votePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 6, paddingVertical: 2 },
  voteAction: { padding: 6, borderRadius: 16 },
  voteScore: { fontSize: 14, fontWeight: '700', color: '#1A202C', minWidth: 24, textAlign: 'center' },
  commentPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 },
  commentBtnText: { fontSize: 14, color: '#4A5568', fontWeight: '600' },
  categoryChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  categoryChipText: { fontSize: 11, fontWeight: '700' },
  moreAction: { padding: 6, borderRadius: 16 },
});
