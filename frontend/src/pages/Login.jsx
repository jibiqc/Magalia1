import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Login page: Email-based magic link authentication.
 * - If already authenticated, redirects to main app
 * - Shows email input and "Send magic link" button
 * - Displays success/error messages
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: null, text: "" });
  const navigate = useNavigate();

  // Check if already authenticated on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        await api.getMe();
        // Already authenticated, redirect to main app
        navigate("/", { replace: true });
      } catch (error) {
        // Not authenticated, stay on login page
      }
    }
    checkAuth();
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage({ type: null, text: "" });

    try {
      await api.requestLink(email.trim());
      setMessage({ type: "success", text: "Check your inbox." });
      setEmail(""); // Clear input on success
    } catch (error) {
      // Extract error message from error object
      // apiCall exposes error.detail with the backend's error message
      console.log("[Login] Caught error:", error);
      console.log("[Login] error.detail:", error.detail);
      console.log("[Login] error.status:", error.status);
      console.log("[Login] error.message:", error.message);
      
      let errorMessage = "An error occurred. Please try again.";
      
      // Prioritize backend detail message if available (this is the exact message from backend)
      // Check if error.detail exists and is not just the HTTP status code
      if (error.detail && typeof error.detail === 'string' && !error.detail.startsWith('HTTP ')) {
        errorMessage = error.detail;
        console.log("[Login] Using error.detail:", errorMessage);
      } else if (error.message) {
        // Fallback to status-based messages if detail not available
        if (error.message.includes("429")) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (error.message.includes("400")) {
          errorMessage = "Only @eetvl.com email addresses are allowed.";
        }
        console.log("[Login] Using fallback message:", errorMessage);
      }
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

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
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "24px", fontSize: "24px" }}>
          Magal'IA Login
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@eetvl.com"
              required
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              fontWeight: 600,
              background: loading ? "#ccc" : "var(--accent, #0066cc)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>

        {message.text && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "6px",
              background:
                message.type === "success"
                  ? "rgba(0, 200, 0, 0.1)"
                  : "rgba(200, 0, 0, 0.1)",
              color:
                message.type === "success"
                  ? "rgb(0, 150, 0)"
                  : "rgb(200, 0, 0)",
              fontSize: "14px",
            }}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

