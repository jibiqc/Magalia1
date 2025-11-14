import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

/**
 * MagicLinkHandler: Handles magic link token validation.
 * - Reads token from URL query parameter
 * - Calls backend /auth/magic endpoint (which sets session cookie and redirects)
 * - On success: backend redirects to app, so we handle that
 * - On failure: shows error message with "Back to login" button
 */
export default function MagicLinkHandler() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError("No token provided.");
      setLoading(false);
      return;
    }

    async function validateToken() {
      try {
        // Call backend magic link endpoint
        // The backend sets the HttpOnly cookie and returns a redirect
        // We follow the redirect and then verify auth
        const API_BASE =
          (window.__API_BASE ?? import.meta?.env?.VITE_API_BASE ?? "http://127.0.0.1:8000")
            .replace(/\/$/, "");
        const url = `${API_BASE}/auth/magic?token=${encodeURIComponent(token)}`;
        
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          redirect: "follow", // Follow redirects
        });

        if (!response.ok) {
          // Backend returned an error
          const errorData = await response.json().catch(() => ({}));
          throw new Error(JSON.stringify({ detail: errorData.detail || `HTTP ${response.status}` }));
        }

        // Backend accepted token and set cookie (may have redirected)
        // Verify authentication with /auth/me
        try {
          await api.getMe();
          // Authenticated, redirect to main app
          navigate("/", { replace: true });
        } catch (authError) {
          // Cookie might not be set yet, but backend accepted token
          // Try redirecting anyway - ProtectedLayout will handle auth check
          navigate("/", { replace: true });
        }
      } catch (err) {
        // Extract error message if available
        let errorMessage =
          "This sign-in link is invalid or has expired. Please request a new one.";
        if (err.message) {
          try {
            const errorData = JSON.parse(err.message);
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } catch {
            // Use default message
          }
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token, navigate]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--ink, #333)",
        }}
      >
        Validating sign-in link...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg, #f5f5f5)",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            background: "var(--card, #fff)",
            padding: "32px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              marginBottom: "24px",
              color: "rgb(200, 0, 0)",
              fontSize: "16px",
            }}
          >
            {error}
          </p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: 600,
              background: "var(--accent, #0066cc)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

