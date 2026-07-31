import { Router, type RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getStore, type AppRole } from "../lib/store";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET ?? "";
const JWT_EXPIRES = "30d";
const APP_ROLES = [
  "admin",
  "principal",
  "hod",
  "class_teacher",
  "subject_teacher",
  "teacher",
  "senior_teacher",
] as const;

if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const signupSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(120).optional(),
});

const signinSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

const setApprovalSchema = z.object({
  userId: z.string().min(1),
  approved: z.boolean(),
});

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(APP_ROLES),
  action: z.enum(["add", "remove"]),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const adminResetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const createStaffSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  full_name: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  role: z.enum(APP_ROLES).optional().default("subject_teacher"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map(b => chars[b % chars.length]).join("");
}

function makeToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function validationError(error: z.ZodError) {
  return {
    message: "Invalid request body",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export async function rolesForUser(userId: string) {
  return (await getStore()).rolesForUser(userId);
}

export async function hasAnyRole(userId: string, roles: readonly string[]) {
  return (await getStore()).hasAnyRole(userId, roles);
}

export function requireRoles(...roles: string[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const allowed = await hasAnyRole(req.userId, roles);
      if (!allowed) return res.status(403).json({ message: "Forbidden" });
      return next();
    } catch (err) {
      console.error("[requireRoles]", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

export function authenticateJWT(req: any, res: any, next: any) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

router.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { email, password, full_name, department } = parsed.data;
    const store = await getStore();

    const existing = await store.getProfileByEmail(email);
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const isFirst = !(await store.hasAnyProfile());
    const approved = isFirst;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "", department: department || "" },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ message: authError?.message || "Failed to create user in Supabase Auth" });
    }

    const id = authData.user.id;
    await store.createProfile({
      id,
      email,
      passwordHash: "supabase-managed",
      fullName: full_name || null,
      department: department || null,
      approved,
      roles: isFirst ? ["admin", "principal"] : [],
    });

    const token = makeToken(id);
    return res.status(201).json({
      token,
      user: { id, email, full_name: full_name || null, department: department || null, approved },
    });
  } catch (err) {
    console.error("[signup]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

const DEV_BYPASS_APPROVAL = process.env.DEV_BYPASS_APPROVAL === "true" || process.env.NODE_ENV === "development";

router.post("/signin", async (req, res) => {
  try {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { email, password } = parsed.data;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const store = await getStore();
    let profile = await store.getProfileById(data.user.id);
    if (!profile) {
      await store.createProfile({
        id: data.user.id,
        email: data.user.email!,
        passwordHash: "supabase-managed",
        fullName: data.user.user_metadata?.full_name || null,
        department: data.user.user_metadata?.department || null,
        approved: true,
        roles: [],
      });
      profile = await store.getProfileById(data.user.id);
      if (!profile) return res.status(500).json({ message: "Internal server error" });
    }

    if (!profile.approved && process.env.DEV_BYPASS_APPROVAL === "true") {
      await store.setApproval(profile.id, true);
    }

    const currentRoles = await store.rolesForUser(profile.id);
    if (currentRoles.length === 0 && process.env.DEV_BYPASS_APPROVAL === "true") {
      await store.assignRole(profile.id, "teacher", "add");
    }

    const token = makeToken(profile.id);
    return res.json({
      token,
      user: { id: profile.id, email: profile.email, full_name: profile.fullName, department: profile.department, approved: profile.approved },
    });
  } catch (err) {
    console.error("[signin]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", authenticateJWT, async (req: any, res) => {
  try {
    const profile = await (await getStore()).getProfileById(req.userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    return res.json({ department: profile.department, approved: profile.approved, full_name: profile.fullName });
  } catch (err) {
    console.error("[me]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/roles", authenticateJWT, async (req: any, res) => {
  try {
    return res.json(await rolesForUser(req.userId));
  } catch (err) {
    console.error("[roles]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/profiles", authenticateJWT, requireRoles("admin", "principal"), async (_req: any, res) => {
  try {
    const result = (await (await getStore()).listProfiles()).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.fullName,
      department: p.department,
      approved: p.approved,
      created_at: p.createdAt.toISOString(),
      roles: p.roles,
    }));
    return res.json(result);
  } catch (err) {
    console.error("[profiles]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/set-approval", authenticateJWT, requireRoles("admin", "principal"), async (req: any, res) => {
  try {
    const parsed = setApprovalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { userId, approved } = parsed.data;
    await (await getStore()).setApproval(userId, approved);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[set-approval]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/assign-role", authenticateJWT, requireRoles("admin", "principal"), async (req: any, res) => {
  try {
    const parsed = assignRoleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { userId, role, action } = parsed.data;
    await (await getStore()).assignRole(userId, role as AppRole, action);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[assign-role]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/create-staff", authenticateJWT, requireRoles("admin", "principal"), async (req: any, res) => {
  try {
    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { email, full_name, department, role, password } = parsed.data;
    const store = await getStore();
    const existing = await store.getProfileByEmail(email);
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const finalPassword = password || generateTempPassword();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { full_name: full_name || "", department: department || "" },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ message: authError?.message || "Failed to create user in Supabase Auth" });
    }

    const id = authData.user.id;
    await store.createProfile({
      id,
      email,
      passwordHash: "supabase-managed",
      fullName: full_name || null,
      department: department || null,
      approved: true,
      roles: [role],
    });

    return res.status(201).json({
      id,
      email,
      full_name: full_name || null,
      department: department || null,
      approved: true,
      roles: [role],
      temp_password: finalPassword,
    });
  } catch (err) {
    console.error("[create-staff]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/profiles/:id", authenticateJWT, requireRoles("admin", "principal"), async (req: any, res) => {
  try {
    const userId = req.params.id;
    const store = await getStore();
    const profile = await store.getProfileById(userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    await store.deleteProfile(userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[delete-profile]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/change-password", authenticateJWT, async (req: any, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { currentPassword, newPassword } = parsed.data;
    const profile = await (await getStore()).getProfileById(req.userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.userId, { password: newPassword });
    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[change-password]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin-reset-password", authenticateJWT, requireRoles("admin", "principal"), async (req: any, res) => {
  try {
    const parsed = adminResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { userId, newPassword } = parsed.data;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin-reset-password]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationError(parsed.error));
    const { email, newPassword } = parsed.data;
    const profile = await (await getStore()).getProfileByEmail(email);
    if (!profile) return res.status(404).json({ message: "No account found with that email address" });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: newPassword });
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ ok: true, message: "Password has been reset successfully. You can now sign in with your new password." });
  } catch (err) {
    console.error("[forgot-password]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/supabase-callback", async (req, res) => {
  try {
    const supabaseUid = req.body?.supabase_uid as string | undefined;
    const email = req.body?.email as string | undefined;
    const full_name = req.body?.full_name as string | undefined;
    const department = req.body?.department as string | undefined;

    if (!supabaseUid || !email) {
      return res.status(400).json({ message: "Missing Supabase user info" });
    }

    const store = await getStore();
    let profile = await store.getProfileById(supabaseUid);

    if (!profile) {
      const isFirst = !(await store.hasAnyProfile());
      await store.createProfile({
        id: supabaseUid,
        email,
        passwordHash: "supabase-managed",
        fullName: full_name || null,
        department: department || null,
        approved: isFirst,
        roles: isFirst ? ["admin", "principal"] : [],
      });
      profile = await store.getProfileById(supabaseUid);
      if (!profile) return res.status(500).json({ message: "Internal server error" });
    }

    const tempPassword = generateTempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(supabaseUid, { password: tempPassword });
    if (error) return res.status(400).json({ message: error.message });

    return res.json({
      ok: true,
      temp_password: tempPassword,
      email: profile.email,
      full_name: profile.fullName,
      department: profile.department,
      approved: profile.approved,
    });
  } catch (err) {
    console.error("[supabase-callback]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
