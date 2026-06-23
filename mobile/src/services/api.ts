import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// In physical device development, this must be the actual LAN IP of your computer running the FastAPI backend.
// We observed 192.168.1.8 in your Metro logs, so we'll default to that!
const API_URL = "http://192.168.1.8:8000/api/v1";

export const api = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(`${API_URL}/login/access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Incorrect email or password");
    }
    return res.json();
  },

  // ─── Forgot Password ─────────────────────────────────────────────────────────
  forgotPasswordSendOtp: async (email: string) => {
    const res = await fetch(`${API_URL}/login/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to send reset OTP");
    }
    return res.json();
  },

  forgotPasswordVerifyOtp: async (email: string, otpCode: string) => {
    const res = await fetch(`${API_URL}/login/forgot-password/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Invalid OTP");
    }
    return res.json();
  },

  forgotPasswordReset: async (email: string, resetToken: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/login/forgot-password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reset_token: resetToken, new_password: newPassword }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to reset password");
    }
    return res.json();
  },

  register: async (
    email: string,
    password: string,
    username: string,
    role: string,
    stateId?: number,
    cityId?: number,
    departmentId?: number
  ) => {
    const res = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        username: username,
        role,
        state_id: stateId || null,
        city_id: cityId || null,
        department_id: departmentId || null
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(
        errorData?.detail || "Registration failed. Email might be taken."
      );
    }
    return res.json();
  },

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
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  getIssues: async (lat?: number, lng?: number, radiusKm: number = 5.0) => {
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch your reports");
    return res.json();
  },

  uploadAvatar: async (uri: string) => {
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to remove avatar");
    return res.json();
  },

  updateUserMe: async (data: { username?: string; notifications_enabled?: boolean }) => {
    const token = await AsyncStorage.getItem("access_token");
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

  requestPasswordChangeOtp: async (data: { current_password: string }) => {
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/users/me/password/request-otp`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || "Failed to request OTP");
    }
    return res.json();
  },

  changePassword: async (data: any) => {
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/users/me/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || "Failed to change password");
    }
    return res.json();
  },

  resendOtp: async (email: string, purpose: 'register' | 'login' | 'forgot_password') => {
    let endpoint;
    if (purpose === 'register') endpoint = '/users/register/resend-otp';
    else if (purpose === 'forgot_password') endpoint = '/login/forgot-password';
    else endpoint = '/login/resend-login-otp';
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to resend OTP");
    }
    return res.json();
  },

  verifyRegisterOtp: async (email: string, otpCode: string) => {
    const res = await fetch(`${API_URL}/users/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Invalid OTP");
    }
    return res.json();
  },

  verifyLoginOtp: async (email: string, otpCode: string) => {
    const res = await fetch(`${API_URL}/login/verify-login-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Invalid OTP");
    }
    return res.json();
  },

  classifyIssueImage: async (imageUri: string) => {
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/${issueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch issue");
    return res.json();
  },
  
  deleteAccount: async () => {
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
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

  // Levels config — cached in AsyncStorage, refreshed only if missing
  getLevels: async (): Promise<Array<{ level: number; title: string; min_points: number; description?: string }>> => {
    const CACHE_KEY = 'civiclens_levels_cache';
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}

    const res = await fetch(`${API_URL}/levels`);
    if (!res.ok) throw new Error("Failed to fetch levels");
    const data = await res.json();
    // Persist so subsequent app opens don't need to fetch again
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return data;
  },

  getComments: async (issueId: number) => {
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/${issueId}/comments`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("Failed to fetch comments");
    return res.json();
  },

  addComment: async (issueId: number, content: string) => {
    const token = await AsyncStorage.getItem("access_token");
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
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/${issueId}/comments/${commentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("Failed to delete comment");
    return res.json();
  },

  /**
   * Recalculates the current user's points from their actual live data.
   * Call this to fix any inconsistency caused by test deletions.
   * Formula: +1 per existing post + +1 per upvote received from others.
   */
  recalculatePoints: async (): Promise<{ status: string; points: number; message: string }> => {
    const token = await AsyncStorage.getItem('access_token');
    const res = await fetch(`${API_URL}/users/me/recalculate-points`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to recalculate points");
    return res.json();
  },
};
