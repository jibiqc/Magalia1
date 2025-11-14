import { log } from "../utils/logger.js";

// Use localhost instead of 127.0.0.1 to match frontend domain for cookie sharing
const API_BASE =
  (window.__API_BASE ?? import.meta?.env?.VITE_API_BASE ?? "http://localhost:8000")
    .replace(/\/$/, "");

// Configurable timeout (default 10s)
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || "10000", 10);

async function apiCall(method, path, body) {
  const url = `${API_BASE}${path}`;
  log.debug("[apiCall] Making request to:", url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    log.debug("[apiCall] Timeout triggered, aborting request");
    ctrl.abort();
  }, API_TIMEOUT);
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
      let errorDetail = null;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await res.json();
          log.debug("[apiCall] Error response JSON:", errorData);
          if (errorData.detail) {
            errorDetail = errorData.detail;
          }
        } catch (e) {
          log.error("[apiCall] Failed to parse error JSON:", e);
          // Response is not valid JSON, will use fallback
        }
      } else {
        log.debug("[apiCall] Response is not JSON, content-type:", contentType);
      }
      const error = new Error(`HTTP ${res.status} on ${url}`);
      error.status = res.status;
      error.detail = errorDetail || `HTTP ${res.status}`;
      log.debug("[apiCall] Throwing error with detail:", error.detail);
      throw error;
    }
    return res.status === 204 ? null : await res.json();
  } catch (fetchError) {
    log.debug("[apiCall] Caught fetch error:", fetchError);
    log.debug("[apiCall] Error name:", fetchError.name);
    log.debug("[apiCall] Error message:", fetchError.message);
    
    // Handle fetch errors (network, timeout, abort, etc.)
    // AbortError is thrown when ctrl.abort() is called (timeout or manual abort)
    if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout') || fetchError === 'timeout' || (typeof fetchError === 'string' && fetchError === 'timeout')) {
      const timeoutError = new Error('Request timeout. Please check your connection and try again.');
      timeoutError.status = 0;
      timeoutError.detail = 'Request timeout. Please check your connection and try again.';
      log.debug("[apiCall] Throwing timeout error");
      throw timeoutError;
    }
    // Re-throw if it's already our formatted error (from !res.ok above)
    if (fetchError.status && fetchError.detail) {
      log.debug("[apiCall] Re-throwing formatted error:", fetchError.detail);
      throw fetchError;
    }
    // For other fetch errors, wrap them
    const wrappedError = new Error(fetchError.message || 'Network error');
    wrappedError.status = 0;
    wrappedError.detail = fetchError.message || 'Network error. Please check your connection.';
    log.debug("[apiCall] Throwing wrapped error:", wrappedError.detail);
    throw wrappedError;
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
    await downloadFile(`${API_BASE}/quotes/${quoteId}/export/word`, `quote_${quoteId}.docx`);
  },

  async exportQuoteExcel(quoteId) {
    await downloadFile(`${API_BASE}/quotes/${quoteId}/export/excel`, `quote_${quoteId}.xlsx`);
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

// Helper function for downloading files
async function downloadFile(url, defaultFilename) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const blob = await res.blob();
  // Extract filename from Content-Disposition header or use default
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = defaultFilename;
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
}

// Expose apiCall for advanced usage
api.apiCall = apiCall;

// DEBUG facultatif pour tests dans la console:
if (typeof window !== "undefined") window.api = api;

