import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const API_URL = "http://192.168.1.8:8000/api/v1";

const getToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
};

export const api = {


  getStates: async () => {
    const res = await fetch(`${API_URL}/locations/states`);
    if (!res.ok) throw new Error("Failed to fetch states");
    return res.json();
  },

  getCities: async (stateId: number) => {
    const res = await fetch(`${API_URL}/locations/states/${stateId}/cities`);
    if (!res.ok) throw new Error("Failed to fetch cities");
    return res.json();
  },

  getDepartments: async () => {
    const res = await fetch(`${API_URL}/departments/`);
    if (!res.ok) throw new Error("Failed to fetch departments");
    return res.json();
  },

  getMe: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  registerPushToken: async (pushToken: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/push-token`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: pushToken })
    });
    if (!res.ok) throw new Error("Failed to register push token");
    return res.json();
  },

  getNotifications: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },

  markNotificationRead: async (id: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to mark notification as read");
    return res.json();
  },

  getUnreadCount: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch unread count");
    return res.json();
  },

  getIssues: async (lat?: number, lng?: number, radiusKm: number = 5.0) => {
    const token = await getToken();
    let url = `${API_URL}/issues/?`;
    if (lat !== undefined && lng !== undefined) {
      url += `lat=${lat}&lng=${lng}&radius_km=${radiusKm}`;
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch feed");
    return res.json();
  },

  getMyIssues: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch your reports");
    return res.json();
  },

  uploadAvatar: async (uri: string) => {
    const token = await getToken();
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('file', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: filename,
      type
    } as any);

    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload avatar");
    return res.json();
  },

  removeAvatar: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to remove avatar");
    return res.json();
  },

  updateUserMe: async (data: { username?: string; notifications_enabled?: boolean }) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || "Failed to update profile");
    }
    return res.json();
  },

  classifyIssueImage: async (imageUri: string) => {
    const token = await getToken();
    const filename = imageUri.split('/').pop() || 'issue.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    const formData = new FormData();
    // @ts-ignore
    formData.append('file', { uri: imageUri, name: filename, type });

    const res = await fetch(`${API_URL}/issues/classify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to classify image");
    }
    return res.json();
  },

  checkDuplicates: async (lat: number, lng: number, category_id: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/check-duplicates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat, lng, category_id, radius_m: 50 }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to check duplicates");
    }
    return res.json();
  },

  createIssue: async (title: string, description: string, category_id: number, lat: number, lng: number, image_url: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        description,
        category_id,
        lat,
        lng,
        image_url
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to submit report");
    }
    return res.json();
  },
  
  getCategories: async () => {
    const res = await fetch(`${API_URL}/issues/categories`);
    if (!res.ok) throw new Error("Failed to fetch categories");
    return res.json();
  },

  getIssueById: async (issueId: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch issue");
    return res.json();
  },

  reportIssue: async (issueId: number, reason: string, description?: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}/report`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reason, description })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to submit report");
    }
    return res.json();
  },
  
  deleteAccount: async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to delete account");
    }
    return res.json();
  },
  
  deleteIssue: async (issueId: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to delete issue");
    }
    return res.json();
  },

  getLevels: async (): Promise<Array<{ level: number; title: string; min_points: number; description?: string }>> => {
    const CACHE_KEY = 'civiclens_levels_cache';
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}

    const res = await fetch(`${API_URL}/levels`);
    if (!res.ok) throw new Error("Failed to fetch levels");
    const data = await res.json();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return data;
  },

  getComments: async (issueId: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}/comments`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("Failed to fetch comments");
    return res.json();
  },

  addComment: async (issueId: number, content: string) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error("Failed to add comment");
    return res.json();
  },

  deleteComment: async (issueId: number, commentId: number) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/issues/${issueId}/comments/${commentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("Failed to delete comment");
    return res.json();
  },

  recalculatePoints: async (): Promise<{ status: string; points: number; message: string }> => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/recalculate-points`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to recalculate points");
    return res.json();
  },
};
