const API_URL = "http://127.0.0.1:8001/api/v1";

export const api = {
  login: async (email: string, password: string) => {
    // OAuth2 expects form-urlencoded for the password flow
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(`${API_URL}/login/access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Incorrect email or password");
    }
    return res.json();
  },

  register: async (email: string, password: string, fullName: string, role: string) => {
    const res = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
          email: email, 
          password: password, 
          full_name: fullName, 
          role: role 
      })
    });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to register account. Email might be taken.");
    }
    return res.json();
  }
}
