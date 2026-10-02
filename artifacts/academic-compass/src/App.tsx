import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { SchoolProvider } from "@/store/school";
import { AuthProvider } from "@/store/auth";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import SignOut from "./pages/SignOut";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const Classes = lazy(() => import("./pages/Classes"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Exams = lazy(() => import("./pages/Exams"));
const MarkSheets = lazy(() => import("./pages/MarkSheets"));
const MarkEntry = lazy(() => import("./pages/MarkEntry"));
const Marks = lazy(() => import("./pages/Marks"));
const Conflicts = lazy(() => import("./pages/Conflicts"));
const Transcripts = lazy(() => import("./pages/Transcripts"));
const Reports = lazy(() => import("./pages/Reports"));
const ParentContacts = lazy(() => import("./pages/ParentContacts"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Timetable = lazy(() => import("./pages/TimeTable"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="grid min-h-[60vh] place-items-center">
    <Spinner className="size-6 text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <SchoolProvider>
            <Toaster />
            <Sonner />
            {import.meta.env.PROD && <Analytics />}
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth" element={<Auth />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/signout" element={<SignOut />} />
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
                    <Route path="/parent-contacts" element={<ParentContacts />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </SchoolProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;