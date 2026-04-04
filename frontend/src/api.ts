const API_URL = "http://127.0.0.1:8000/api/v1";

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
    role: string
  ) => {
    const res = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
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

  getMapIssues: async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/map`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch map issues");
    return res.json();
  },

  getIssueDetails: async (id: number) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/issues/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch issue details");
    return res.json();
  }
};
