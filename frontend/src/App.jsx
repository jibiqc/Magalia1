import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import MagicLinkHandler from "./pages/MagicLinkHandler.jsx";
import ProtectedLayout from "./components/ProtectedLayout.jsx";
import QuoteEditor from "./pages/QuoteEditor.jsx";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/magic" element={<MagicLinkHandler />} />
      <Route
        path="/*"
        element={
          <ProtectedLayout>
            <QuoteEditor />
          </ProtectedLayout>
        }
      />
    </Routes>
  );
}

export default App;
