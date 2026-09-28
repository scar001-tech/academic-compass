import { Navigate } from "react-router-dom";

// Authentication is disabled — redirect to the dashboard.
export default function Auth() {
  return <Navigate to="/" replace />;
}