import { Navigate } from "react-router-dom";

// Authentication is disabled — redirect to the dashboard.
export default function AuthCallback() {
  return <Navigate to="/" replace />;
}