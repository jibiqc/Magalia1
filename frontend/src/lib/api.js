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
      credentials: "omit",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
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

  // Quotes
  async getQuote(quoteId) {
    return apiCall("GET", `/quotes/${quoteId}`);
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

  // --- Services catalog API ---
  searchServices,
  getPopularServices,
  getServiceById,
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

// DEBUG facultatif pour tests dans la console:
if (typeof window !== "undefined") window.api = api;

