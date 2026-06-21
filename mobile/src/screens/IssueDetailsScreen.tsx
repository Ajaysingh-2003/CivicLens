import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuth } from '../services/AuthContext';

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

export default function IssueDetailsScreen({ route, navigation }: any) {
  const { issue: initialIssue } = route.params;
  const { user } = useAuth();
  
  const [issue, setIssue] = useState(initialIssue);
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  const loadComments = async () => {
    try {
      const data = await api.getComments(issue.id);
      setComments(data);
    } catch (e) {
      console.log('Failed to load comments', e);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [issue.id]);

  const handleCommentSubmit = async () => {
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      await api.addComment(issue.id, commentInput.trim());
      setCommentInput('');
      await loadComments();
      setIssue({ ...issue, comments_count: (issue.comments_count || 0) + 1 });
    } catch (e) {
      Alert.alert("Error", "Could not post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteComment(issue.id, commentId);
              await loadComments();
              setIssue({ ...issue, comments_count: Math.max(0, (issue.comments_count || 0) - 1) });
            } catch (e) {
              Alert.alert("Error", "Could not delete comment");
            }
          }
        }
      ]
    );
  };

  const netVotes = (issue.upvotes || 0) - (issue.downvotes || 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.greeting}>Post</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { borderBottomWidth: 0, marginBottom: 0 }]}>
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
            {loadingComments ? (
              <ActivityIndicator size="small" color="#4CAF50" style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noCommentsText}>Be the first one to comment.</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={[styles.commentHeader, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {c.author_avatar_url ? (
                        <Image source={{ uri: c.author_avatar_url }} style={styles.reporterAvatarSmall} />
                      ) : (
                        <View style={styles.reporterAvatarSmall}>
                          <Ionicons name="person" size={10} color="#aaa" />
                        </View>
                      )}
                      <Text style={styles.commentAuthor}>{c.author_name}</Text>
                      <Text style={styles.cardMetaDivider}>·</Text>
                      <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                    </View>
                    {user && c.author_id === user.id && (
                      <TouchableOpacity onPress={() => handleDeleteComment(c.id)}>
                        <Ionicons name="trash-outline" size={16} color="#E53E3E" />
                      </TouchableOpacity>
                    )}
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
          <TouchableOpacity style={styles.commentSubmitBtn} onPress={handleCommentSubmit} disabled={!commentInput.trim() || submittingComment}>
            {submittingComment ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Ionicons name="send" size={20} color={commentInput.trim() ? '#4CAF50' : '#ccc'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  
  card: { backgroundColor: '#FFFFFF', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cardImageContainer: { width: '100%', height: 260, backgroundColor: '#f0f0f0' },
  cardImagePremium: { width: '100%', height: '100%' },
  cardMetaPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reporterAvatarSmall: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EDF2F7', alignItems: 'center', justifyContent: 'center' },
  cardMetaText: { fontSize: 13, color: '#718096', fontWeight: '500' },
  cardMetaDivider: { fontSize: 13, color: '#CBD5E0' },
  cardBodyPremium: { paddingHorizontal: 16, paddingBottom: 12 },
  cardTitlePremium: { fontSize: 18, fontWeight: '700', color: '#1A202C', letterSpacing: -0.2, lineHeight: 24 },
  cardDescPremium: { fontSize: 14, color: '#4A5568', lineHeight: 22 },
  cardFooterPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  votePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 6, paddingVertical: 2 },
  voteAction: { padding: 6, borderRadius: 16 },
  voteScore: { fontSize: 14, fontWeight: '700', color: '#1A202C', minWidth: 24, textAlign: 'center' },
  commentPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 },
  commentBtnText: { fontSize: 14, color: '#4A5568', fontWeight: '600' },
  categoryChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  categoryChipText: { fontSize: 11, fontWeight: '700' },

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
});
