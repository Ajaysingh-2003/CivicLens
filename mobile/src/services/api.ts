import AsyncStorage from '@react-native-async-storage/async-storage';

// In physical device development, this must be the actual LAN IP of your computer running the FastAPI backend.
// We observed 192.168.1.7 in your Metro logs, so we'll default to that!
const API_URL = "http://192.168.1.7:8000/api/v1";

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

  register: async (
    email: string,
    password: string,
    fullName: string,
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
        full_name: fullName,
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

  uploadAvatar: async () => {
    // For now this is mocked on the backend, so we don't actually need to send a formData file.
    const token = await AsyncStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
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
  }
};
