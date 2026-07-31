import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SchoolProvider } from "@/store/school";
import { AuthProvider } from "@/store/auth";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subjects";
import Teachers from "./pages/Teachers";
import Exams from "./pages/Exams";
import MarkSheets from "./pages/MarkSheets";
import MarkEntry from "./pages/MarkEntry";
import Marks from "./pages/Marks";
import Conflicts from "./pages/Conflicts";
import Transcripts from "./pages/Transcripts";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Timetable from "./pages/TimeTable";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <SchoolProvider>
            <Toaster />
            <Sonner />
            <Analytics />
            <Routes>
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/classes" element={<Classes />} />
                  <Route path="/subjects" element={<Subjects />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/exams" element={<Exams />} />
                  <Route path="/sheets" element={<MarkSheets />} />
                  <Route path="/entry" element={<MarkEntry />} />
                  <Route path="/marks" element={<Marks />} />
                  <Route path="/timetable" element={<Timetable />} />
                  <Route path="/conflicts" element={<Conflicts />} />
                  <Route path="/transcripts" element={<Transcripts />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SchoolProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
