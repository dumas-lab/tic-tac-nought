import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const envPath = process.env.TTN_ENV_FILE || path.join(root, ".env.supabase.local");

async function loadEnv() {
  const env = { ...process.env };
  try {
    const text = await readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const at = trimmed.indexOf("=");
      const key = trimmed.slice(0, at);
      if (env[key] === undefined) env[key] = trimmed.slice(at + 1);
    }
  } catch {
    /* env vars may be supplied directly */
  }
  return env;
}

const env = await loadEnv();
const url = process.env.TTN_SUPABASE_URL || env.TTN_TEST_SUPABASE_URL;
const anonKey = process.env.TTN_SUPABASE_KEY || env.TTN_TEST_SUPABASE_KEY;
const serviceKey = process.env.TTN_SERVICE_ROLE_KEY || env.TTN_TEST_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase test configuration. Set TTN_TEST_SUPABASE_URL, TTN_TEST_SUPABASE_KEY, and TTN_TEST_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = "correct-horse-battery-staple";
const createdUsers = new Set();
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  passed += 1;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function request(pathname, { method = "GET", token, key = anonKey, body, headers = {} } = {}) {
  const response = await fetch(`${url}${pathname}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, ok: response.ok, body: parsed, text };
}

async function rpc(name, args = {}, token = anonKey) {
  return request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    token,
    key: token === serviceKey ? serviceKey : anonKey,
    body: args
  });
}

async function callFunction(name, { token, body, origin = "http://127.0.0.1:8080", ip, method = "POST" } = {}) {
  const headers = {
    apikey: anonKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(origin ? { Origin: origin } : {}),
    ...(ip ? { "x-real-ip": ip, "x-forwarded-for": ip } : {}),
    ...(method === "POST" ? { "Content-Type": "application/json" } : {})
  };
  if (method === "OPTIONS") {
    headers["Access-Control-Request-Method"] = "POST";
    headers["Access-Control-Request-Headers"] = "content-type";
  }
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return {
    status: response.status,
    ok: response.ok,
    body: parsed,
    text,
    headers: response.headers
  };
}

async function signupAnonymous() {
  const response = await request("/auth/v1/signup", { method: "POST", body: {} });
  if (response.ok && response.body?.user?.id) createdUsers.add(response.body.user.id);
  return response;
}

async function login(handle, pass = password) {
  return request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: `${handle.toLowerCase()}@ttn.invalid`, password: pass }
  });
}

async function deleteUser(id) {
  const response = await request(`/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    token: serviceKey,
    key: serviceKey
  });
  if (response.ok) createdUsers.delete(id);
  return response;
}

async function clearRegistrationEvents() {
  const response = await request("/rest/v1/registration_events?id=gt.0", {
    method: "DELETE",
    token: serviceKey,
    key: serviceKey,
    headers: { Prefer: "return=minimal" }
  });
  assert(response.ok, "could not clear registration events");
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`     ${error.message}`);
  }
}

function freshHandle(prefix) {
  return `${prefix}_${suffix}`.slice(0, 20);
}

async function main() {
  console.log(`Testing functions at ${url}/functions/v1`);

  await run("CORS preflight", async () => {
    const allowed = await callFunction("register", { method: "OPTIONS", origin: "http://127.0.0.1:8080" });
    assertEqual(allowed.status, 204, "allowed preflight should return 204");
    assertEqual(allowed.headers.get("access-control-allow-origin"), "http://127.0.0.1:8080", "preflight should echo the allowed origin");

    const blocked = await callFunction("register", {
      method: "OPTIONS",
      origin: "https://evil.example",
      body: {}
    });
    assertEqual(blocked.status, 403, "blocked preflight should return 403");
    assertEqual(blocked.headers.get("access-control-allow-origin"), null, "blocked preflight should not allow the origin");
  });

  await clearRegistrationEvents();

  const handle = freshHandle("Fn");
  await run("register creates an account", async () => {
    const registered = await callFunction("register", {
      body: { handle, password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(registered.status, 201, `register should return 201: ${registered.text}`);
    assertEqual(registered.body.ok, true, "register should report ok");
    assertEqual(registered.body.handle, handle, "register should echo the handle");

    const session = await login(handle);
    assert(session.ok, `registered account should log in: ${session.text}`);
    createdUsers.add(session.body.user.id);

    const account = await rpc("get_my_account", {}, session.body.access_token);
    assert(account.ok, "registered account should read its profile");
    assertEqual(account.body.profile.handle, handle, "profile handle should match");
    assertEqual(account.body.profile.is_guest, false, "registered profile should be an account");
  });

  await run("register validation", async () => {
    const duplicate = await callFunction("register", {
      body: { handle: handle.toUpperCase(), password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(duplicate.status, 409, "duplicate handle should return 409");

    const invalid = await callFunction("register", {
      body: { handle: "ab", password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(invalid.status, 400, "short handle should return 400");

    const reserved = await callFunction("register", {
      body: { handle: "admin", password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(reserved.status, 400, "reserved handle should return 400");

    const shortPassword = await callFunction("register", {
      body: { handle: freshHandle("Pw"), password: "short" },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(shortPassword.status, 400, "short password should return 400");
  });

  await run("register rate limit", async () => {
    await clearRegistrationEvents();
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const handles = [];
    try {
      for (let i = 0; i < 6; i += 1) {
        const candidate = `Rate${i}_${suffix}`.slice(0, 20);
        handles.push(candidate);
        const response = await callFunction("register", {
          body: { handle: candidate, password },
          ip
        });
        if (i < 5) {
          assertEqual(response.status, 201, `registration ${i + 1} should succeed: ${response.text}`);
        } else {
          assertEqual(response.status, 429, "sixth registration from one IP should be rate limited");
        }
      }
    } finally {
      for (const candidate of handles) {
        const session = await login(candidate);
        if (session.ok) {
          createdUsers.add(session.body.user.id);
          await deleteUser(session.body.user.id);
        }
      }
    }
  });

  await clearRegistrationEvents();

  const claimHandle = freshHandle("ClaimFn");
  const guestSession = await signupAnonymous();
  assert(guestSession.ok, "guest signup should succeed");
  const guest = guestSession.body.user;
  const guestToken = guestSession.body.access_token;

  await run("claim-guest creates an account and transfers the score", async () => {
    const submit = await rpc("submit_score", {
      p_run_id: `fnclaim${suffix}`,
      p_score: 4242,
      p_round: 5,
      p_board_size: 5,
      p_level: 2
    }, guestToken);
    assert(submit.ok, `guest score submit failed: ${submit.text}`);

    const claimed = await callFunction("claim-guest", {
      token: guestToken,
      body: { handle: claimHandle, password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(claimed.status, 201, `claim-guest should return 201: ${claimed.text}`);
    assertEqual(claimed.body.ok, true, "claim should report ok");
    assertEqual(claimed.body.transferred, true, "claim should transfer the guest score");
    assertEqual(Number(claimed.body.best.score), 4242, "claim should return the transferred score");

    const session = await login(claimHandle);
    assert(session.ok, `claimed account should log in: ${session.text}`);
    createdUsers.add(session.body.user.id);

    const account = await rpc("get_my_account", {}, session.body.access_token);
    assertEqual(account.body.profile.handle, claimHandle, "claimed account handle should match");
    assertEqual(Number(account.body.best.score), 4242, "claimed account should own the guest score");

    const oldGuest = await rpc("get_my_account", {}, guestToken);
    assert([401, 403].includes(oldGuest.status), `deleted guest token should no longer work (got ${oldGuest.status})`);
  });

  await run("claim-guest rejects non-guests and duplicate handles", async () => {
    const session = await login(claimHandle);
    assert(session.ok, "claimed account should log in");
    const notGuest = await callFunction("claim-guest", {
      token: session.body.access_token,
      body: { handle: freshHandle("Other"), password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(notGuest.status, 403, "non-guest should not claim");

    const guest2 = await signupAnonymous();
    assert(guest2.ok, "second guest signup should succeed");
    const duplicate = await callFunction("claim-guest", {
      token: guest2.body.access_token,
      body: { handle: claimHandle, password },
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    });
    assertEqual(duplicate.status, 409, "claim with an existing handle should return 409");
  });

  await run("delete-account removes the account", async () => {
    const session = await login(claimHandle);
    assert(session.ok, "claimed account should log in");

    const missingConfirm = await callFunction("delete-account", {
      token: session.body.access_token,
      body: { confirm: "delete" }
    });
    assertEqual(missingConfirm.status, 400, "delete without exact confirmation should return 400");

    const deleted = await callFunction("delete-account", {
      token: session.body.access_token,
      body: { confirm: "DELETE" }
    });
    assertEqual(deleted.status, 200, `delete-account should return 200: ${deleted.text}`);

    const after = await login(claimHandle);
    assert(!after.ok, "deleted account should not log in");
  });

  await run("delete-account removes a guest", async () => {
    const guest = await signupAnonymous();
    assert(guest.ok, "guest signup should succeed");
    const deleted = await callFunction("delete-account", {
      token: guest.body.access_token,
      body: { confirm: "DELETE" }
    });
    assertEqual(deleted.status, 200, "guest account deletion should succeed");
    const after = await rpc("get_my_account", {}, guest.body.access_token);
    assert([401, 403].includes(after.status), `deleted guest token should no longer work (got ${after.status})`);
  });
}

try {
  await main();
} finally {
  for (const id of [...createdUsers]) {
    await deleteUser(id).catch(() => {});
  }
}

console.log(`\n${passed} assertions passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
