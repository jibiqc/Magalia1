const API_BASE =
  (window.__API_BASE ?? import.meta?.env?.VITE_API_BASE ?? "http://127.0.0.1:8000")
    .replace(/\/$/, "");

async function apiCall(method, path, body) {
  const url = `${API_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), 10000); // 10s hard timeout
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "include",
    });
    if (!res.ok) {
      // Try to extract error detail from response
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorDetail = errorData.detail;
        }
      } catch {
        // Response is not JSON, use status
      }
      const error = new Error(`HTTP ${res.status} on ${url}`);
      error.status = res.status;
      error.detail = errorDetail;
      throw error;
    }
    return res.status === 204 ? null : await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Destinations
  async getDestinations(query = "") {
    const q = query ? `?query=${encodeURIComponent(query)}&limit=50` : "?limit=50";
    return apiCall("GET", `/destinations${q}`);
  },

  async createDestination(name) {
    return apiCall("POST", "/destinations", { name });
  },

  async getDestinationPhotos(destId, limit = 5) {
    return apiCall("GET", `/destinations/photos?dest_id=${destId}&limit=${limit}`);
  },

  async upsertDestinationPhoto(payload) {
    return apiCall("POST", "/destinations/photos", payload);
  },

  // Quotes
  async getQuote(quoteId) {
    return apiCall("GET", `/quotes/${quoteId}`);
  },

  async searchQuotes(query, limit = 10) {
    if (!query || !query.trim()) return [];
    return apiCall("GET", `/quotes/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`);
  },

  async patchQuoteDays(quoteId, payload) {
    return apiCall("PATCH", `/quotes/${quoteId}/days`, payload);
  },

  async repriceQuote(quoteId) {
    return apiCall("POST", `/quotes/${quoteId}/reprice`);
  },

  async saveQuote(quoteId, payload) {
    return apiCall("PUT", `/quotes/${quoteId}`, payload);
  },

  async createOrSaveQuote(payload) {
    // Create new quote with POST
    return apiCall("POST", "/quotes", payload);
  },

  async exportQuoteWord(quoteId) {
    // Download Word export file
    const url = `${API_BASE}/quotes/${quoteId}/export/word`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    const blob = await res.blob();
    // Extract filename from Content-Disposition header or use default
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = `quote_${quoteId}.docx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  async exportQuoteExcel(quoteId) {
    // Download Excel export file
    const url = `${API_BASE}/quotes/${quoteId}/export/excel`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    const blob = await res.blob();
    // Extract filename from Content-Disposition header or use default
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = `quote_${quoteId}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    // Trigger download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  // --- Services catalog API ---
  searchServices,
  getPopularServices,
  getServiceById,

  // --- Auth API ---
  async requestLink(email) {
    return apiCall("POST", "/auth/request-link", { email });
  },

  async getMe() {
    return apiCall("GET", "/auth/me");
  },

  async logout() {
    return apiCall("POST", "/auth/logout");
  },

};

// Named exports for services API
export async function searchServices({ q, dest, category, limit = 20 }) {
  const p = new URLSearchParams();
  if (!q) throw new Error("q is required");
  p.set("q", q);
  if (dest) p.set("dest", dest);
  if (category) p.set("category", category);
  p.set("limit", String(limit));
  return apiCall("GET", `/services/search?${p.toString()}`);
}

export async function getPopularServices({ dest, category = "Activity", limit = 12 }) {
  const p = new URLSearchParams();
  if (dest) p.set("dest", dest);
  if (category) p.set("category", category);
  p.set("limit", String(limit));
  return apiCall("GET", `/services/popular?${p.toString()}`);
}

export async function getServiceById(id) {
  if (!id) throw new Error("id is required");
  return apiCall("GET", `/services/${id}`);
}

// Expose apiCall for advanced usage
api.apiCall = apiCall;

// DEBUG facultatif pour tests dans la console:
if (typeof window !== "undefined") window.api = api;

