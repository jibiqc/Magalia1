import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

/**
 * ProtectedLayout: Auth guard that verifies user session before rendering children.
 * - On mount, calls /auth/me to check authentication
 * - Shows loading state while checking
 * - Redirects to /login if 401 (not authenticated)
 * - Renders children if authenticated
 */
export default function ProtectedLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      try {
        await api.getMe();
        setAuthenticated(true);
      } catch (error) {
        // 401 or any error means not authenticated
        setAuthenticated(false);
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--ink, #333)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return null; // Redirect is in progress
  }

  return <>{children}</>;
}

