/**
 * REST API client.
 */

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");
const BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as any).message === "string" &&
      (err as any).message.toLowerCase().includes("failed to fetch"))
  );
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = localStorage.getItem("ac_token");
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("ac_token");
        localStorage.removeItem("ac_user");
        if (window.location.pathname !== "/auth") window.location.assign("/auth");
      }
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message ?? "Request failed");
    }
    return res.json();
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(
        `Cannot reach the server at ${API_ORIGIN || window.location.origin}. ` +
        "If you are in production, set VITE_API_ORIGIN to your deployed API URL. " +
        "If you are in development, make sure the API server is running."
      );
    }
    throw err;
  }
}

export const api = {
  get:    <T>(path: string)                  => request<T>("GET",    path),
  post:   <T>(path: string, body: unknown)   => request<T>("POST",   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>("PUT",    path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>("PATCH",  path, body),
  delete: <T>(path: string)                  => request<T>("DELETE", path),
};
