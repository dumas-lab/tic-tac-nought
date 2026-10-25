// Shared helpers for the Tic Tac Nought account functions.
// These functions hold the service-role key. Never expose it to the client.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function keyDictionary(name: string): Record<string, string> {
  try {
    const parsed = JSON.parse(Deno.env.get(name) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// New publishable/secret keys are injected as named JSON dictionaries. Keep
// the legacy fallbacks so the functions still work on older local stacks.
const PUBLISHABLE_KEYS = keyDictionary("SUPABASE_PUBLISHABLE_KEYS");
const SECRET_KEYS = keyDictionary("SUPABASE_SECRET_KEYS");
const SERVICE_ROLE_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = PUBLISHABLE_KEYS.default || Deno.env.get("SUPABASE_ANON_KEY") || "";

const ALLOWED_ORIGINS = new Set([
  "https://dumas-lab.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
]);

const RESERVED_HANDLES = new Set([
  "admin", "administrator", "mod", "moderator", "nought", "system",
  "support", "ttn", "tic", "tac", "toe", "guest", "anonymous",
  "null", "undefined", "root", "owner"
]);

export class HttpError extends Error {
  constructor(public status: number, public code: string, message = code) {
    super(message);
  }
}

export interface AuthUser {
  id: string;
  email?: string;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
}

function serviceHeaders(): HeadersInit {
  // Secret keys go on apikey only. Sending them as a Bearer token makes the
  // gateway try to parse them as a JWT and reject the request.
  return {
    apikey: SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  };
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || ALLOWED_ORIGINS.has(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req)
    }
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8192) {
    throw new HttpError(413, "payload_too_large");
  }
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function normalizeHandle(value: unknown): { handle: string; norm: string } {
  if (typeof value !== "string") throw new HttpError(400, "invalid_handle");
  const handle = value.trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(handle)) throw new HttpError(400, "invalid_handle");
  const norm = handle.toLowerCase();
  if (RESERVED_HANDLES.has(norm) || norm.startsWith("guest-")) {
    throw new HttpError(400, "reserved_handle");
  }
  return { handle, norm };
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new HttpError(400, "invalid_password");
  }
  return value;
}

function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(req: Request): Promise<void> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "ttn-pre-alpha";
  const ipHash = await sha256(`${salt}:${clientIp(req)}`);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_rate_limit`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ p_ip_hash: ipHash })
  });
  if (response.status === 429) throw new HttpError(429, "rate_limited");
  if (!response.ok) {
    console.error("register_rate_limit failed", response.status, await response.text());
    throw new HttpError(503, "backend_unavailable");
  }
}

export async function getUser(req: Request): Promise<AuthUser> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "not_authenticated");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: authorization }
  });
  if (!response.ok) throw new HttpError(401, "not_authenticated");
  return await response.json() as AuthUser;
}

export async function handleTaken(norm: string): Promise<boolean> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle_norm=eq.${encodeURIComponent(norm)}&select=id`,
    { headers: serviceHeaders() }
  );
  if (!response.ok) {
    console.error("handle lookup failed", response.status, await response.text());
    throw new HttpError(503, "backend_unavailable");
  }
  const rows = await response.json() as unknown[];
  return rows.length > 0;
}

export async function createAccount(handle: string, password: string): Promise<AuthUser> {
  const email = `${handle.toLowerCase()}@ttn.invalid`;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { handle }
    })
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!response.ok) {
    if (await handleTaken(handle.toLowerCase())) throw new HttpError(409, "handle_taken");
    console.error("createAccount failed", response.status, text);
    throw new HttpError(502, "registration_failed");
  }
  return body as AuthUser;
}

export async function deleteAccount(id: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: serviceHeaders()
  });
  if (!response.ok) {
    console.error("deleteAccount failed", response.status, await response.text());
    throw new HttpError(502, "delete_failed");
  }
}

export async function callRpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify(args)
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!response.ok) {
    console.error(`rpc ${name} failed`, response.status, text);
    throw new HttpError(502, "backend_unavailable");
  }
  return body as Record<string, unknown>;
}

export async function serve(req: Request, handler: () => Promise<Response>): Promise<Response> {
  if (!originAllowed(req)) return json(req, { error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError) {
      return json(req, { error: error.code, message: error.message }, error.status);
    }
    console.error(error);
    return json(req, { error: "internal_error" }, 500);
  }
}
