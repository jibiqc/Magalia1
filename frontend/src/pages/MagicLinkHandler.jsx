import React, { useEffect, useState } from "react";
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
        // The backend sets the HttpOnly cookie and returns JSON (no redirect to avoid CORS)
        // Use localhost instead of 127.0.0.1 to match frontend domain for cookie sharing
        const API_BASE =
          (window.__API_BASE ?? import.meta?.env?.VITE_API_BASE ?? "http://localhost:8000")
            .replace(/\/$/, "");
        const url = `${API_BASE}/auth/magic?token=${encodeURIComponent(token)}`;
        
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          // Backend returned an error
          const errorData = await response.json().catch(() => ({}));
          throw new Error(JSON.stringify({ detail: errorData.detail || `HTTP ${response.status}` }));
        }

        // Backend accepted token and set cookie (returns JSON with success message)
        const responseData = await response.json().catch(() => ({}));
        console.log("[MagicLinkHandler] Token validated successfully, response:", responseData);
        
        // Wait a moment for cookie to be set
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify authentication with /auth/me to ensure cookie is set
        try {
          const user = await api.getMe();
          console.log("[MagicLinkHandler] Authentication verified, user:", user);
          // Authenticated, redirect to main app
          navigate("/", { replace: true });
        } catch (authError) {
          console.error("[MagicLinkHandler] Failed to verify auth after token validation:", authError);
          // Cookie might not be set yet, wait a bit more and try again
          await new Promise(resolve => setTimeout(resolve, 300));
          try {
            const user = await api.getMe();
            console.log("[MagicLinkHandler] Authentication verified on retry, user:", user);
            navigate("/", { replace: true });
          } catch (retryError) {
            console.error("[MagicLinkHandler] Auth verification failed on retry:", retryError);
            // Show error instead of redirecting - cookie might not be set
            setError("Authentication successful but session cookie was not set. Please try again.");
          }
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
        console.error("[MagicLinkHandler] Error validating token:", err);
        console.error("[MagicLinkHandler] Error message:", errorMessage);
        setError(errorMessage);
        // Don't redirect automatically - let user see the error and click "Back to login"
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

