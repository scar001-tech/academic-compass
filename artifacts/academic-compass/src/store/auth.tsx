import { createContext, useContext, useCallback } from "react";

export type AppRole = "admin" | "principal" | "hod" | "class_teacher" | "subject_teacher" | "teacher" | "senior_teacher";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  department?: string | null;
  approved?: boolean;
}

interface Session {
  user: AuthUser;
  token: string;
}

interface AuthCtx {
  session: Session | null;
  user: AuthUser | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name?: string, department?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...r: AppRole[]) => boolean;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canEditTimetable: boolean;
  isTeacher: boolean;
  isSeniorTeacher: boolean;
  isHod: boolean;
  isPrincipal: boolean;
  isApproved: boolean;
  isReadOnly: boolean;
  canManageStaff: boolean;
  canManageStudents: boolean;
  canEnterMarks: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

// Authentication is disabled — every user is treated as the principal.
const PRINCIPAL_USER: AuthUser = { id: "principal", email: "", full_name: "Principal", department: null, approved: true };
const PRINCIPAL_ROLES: AppRole[] = ["admin", "principal"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session: Session | null = { token: "", user: PRINCIPAL_USER };
  const roles = PRINCIPAL_ROLES;
  const loading = false;

  const hasRole = useCallback((...r: AppRole[]) => r.some(x => roles.includes(x)), [roles]);

  const value: AuthCtx = {
    session,
    user: PRINCIPAL_USER,
    roles,
    loading,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    hasRole,
    refreshRoles: async () => {},
    refreshProfile: async () => {},
    canEditTimetable: true,
    isTeacher: true,
    isSeniorTeacher: true,
    isHod: true,
    isPrincipal: true,
    isApproved: true,
    isReadOnly: false,
    canManageStaff: true,
    canManageStudents: true,
    canEnterMarks: true,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}