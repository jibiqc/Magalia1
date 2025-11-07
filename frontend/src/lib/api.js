const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function apiCall(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
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
};

