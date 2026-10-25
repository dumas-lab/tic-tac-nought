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
  const response = await request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    token,
    key: token === serviceKey ? serviceKey : anonKey,
    body: args
  });
  return response;
}

async function adminCreateUser({ handle, password }) {
  const email = `${handle.toLowerCase()}@ttn.invalid`;
  const response = await request("/auth/v1/admin/users", {
    method: "POST",
    token: serviceKey,
    key: serviceKey,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { handle }
    }
  });
  if (response.ok && response.body?.id) createdUsers.add(response.body.id);
  return { ...response, email };
}

async function signupAccount({ handle, password }) {
  const email = `${handle.toLowerCase()}@ttn.invalid`;
  const response = await request("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { handle } }
  });
  if (response.ok && response.body?.user?.id) createdUsers.add(response.body.user.id);
  return { ...response, email };
}

async function signupAnonymous() {
  const response = await request("/auth/v1/signup", { method: "POST", body: {} });
  if (response.ok && response.body?.user?.id) createdUsers.add(response.body.user.id);
  return response;
}

async function login(email, password) {
  return request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password }
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

async function ageSubmissions(userId) {
  const old = new Date(Date.now() - 120000).toISOString();
  const response = await request(`/rest/v1/score_submissions?user_id=eq.${userId}`, {
    method: "PATCH",
    token: serviceKey,
    key: serviceKey,
    body: { submitted_at: old },
    headers: { Prefer: "return=minimal" }
  });
  assert(response.ok, `could not age submissions for ${userId}`);
}

function accountEmail(handle) {
  return `${handle.toLowerCase()}@ttn.invalid`;
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

async function main() {
  console.log(`Testing ${url}`);

  let health = await rpc("health");
  for (let attempt = 0; attempt < 10 && !health.ok; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    health = await rpc("health");
  }
  assert(health.ok, `health RPC should be public (${health.status}: ${health.text})`);
  assertEqual(health.body?.ok, true, "health should report ok");

  // -------------------------------------------------------------------------
  // Guest identity and guest restrictions
  // -------------------------------------------------------------------------
  const guestSession = await signupAnonymous();
  assert(guestSession.ok, "anonymous signup should succeed");
  const guest = guestSession.body.user;
  const guestToken = guestSession.body.access_token;
  assertEqual(guest.is_anonymous, true, "anonymous user should be marked anonymous");

  let guestAccount;
  await run("guest profile and restrictions", async () => {
    const account = await rpc("get_my_account", {}, guestToken);
    assert(account.ok, "guest should read own account");
    guestAccount = account.body;
    assert(/^Guest-[A-Z0-9]{6}$/.test(guestAccount.profile.handle), "guest handle should be auto-generated");
    assertEqual(guestAccount.profile.is_guest, true, "guest profile should be a guest");

    const save = await rpc("get_save", {}, guestToken);
    assertEqual(save.status, 403, "guest get_save should be forbidden");

    const sync = await rpc("sync_save", {
      p_base_revision: 0,
      p_payload: { app: "tic-tac-nought", schema: 1, data: { state: { mode: "endless" } } }
    }, guestToken);
    assertEqual(sync.status, 403, "guest sync_save should be forbidden");
  });

  const guestRun = `guestrun${suffix}`;
  await run("guest score submission", async () => {
    const submit = await rpc("submit_score", {
      p_run_id: guestRun,
      p_score: 5000,
      p_round: 5,
      p_board_size: 5,
      p_level: 2
    }, guestToken);
    assert(submit.ok, `guest submit failed: ${submit.text}`);
    assertEqual(submit.body.accepted, true, "guest score should be accepted");
    assertEqual(submit.body.is_guest, true, "guest score response should mark guest");
    assertEqual(submit.body.improved, true, "first guest score should improve");
    assert(submit.body.rank >= 1, "guest score should have a rank");

    const duplicate = await rpc("submit_score", {
      p_run_id: guestRun,
      p_score: 5000,
      p_round: 5,
      p_board_size: 5,
      p_level: 2
    }, guestToken);
    assert(duplicate.ok, "duplicate guest submit should succeed");
    assertEqual(duplicate.body.duplicate, true, "duplicate guest submit should be idempotent");

    const rateLimited = await rpc("submit_score", {
      p_run_id: `guestrate${suffix}`,
      p_score: 5001,
      p_round: 5,
      p_board_size: 5,
      p_level: 2
    }, guestToken);
    assertEqual(rateLimited.status, 429, "second guest submit inside 30s should be rate limited");
  });

  // -------------------------------------------------------------------------
  // Account creation, handle rules, score progression
  // -------------------------------------------------------------------------
  const handle = `Tester_${suffix}`.slice(0, 20);
  const password = "correct-horse-battery-staple";
  const accountSignup = await signupAccount({ handle, password });
  assert(accountSignup.ok, `account signup failed: ${accountSignup.text}`);
  const account = accountSignup.body.user;
  const accountToken = accountSignup.body.access_token;
  assertEqual(account.is_anonymous, false, "account should not be anonymous");

  await run("account profile", async () => {
    const accountInfo = await rpc("get_my_account", {}, accountToken);
    assert(accountInfo.ok, "account should read own account");
    assertEqual(accountInfo.body.profile.handle, handle, "account handle should match signup");
    assertEqual(accountInfo.body.profile.is_guest, false, "account profile should not be a guest");
  });

  await run("handle validation", async () => {
    const reserved = await signupAccount({ handle: "admin", password });
    assert(!reserved.ok, "reserved handle should be rejected");

    const duplicate = await signupAccount({ handle: handle.toUpperCase(), password });
    assert(!duplicate.ok, "case-insensitive duplicate handle should be rejected");

    const invalid = await signupAccount({ handle: "ab", password });
    assert(!invalid.ok, "short handle should be rejected");

    const guestPrefix = await signupAccount({ handle: "Guest-ABC123", password });
    assert(!guestPrefix.ok, "guest prefix should be rejected");
  });

  await run("account score progression", async () => {
    const first = await rpc("submit_score", {
      p_run_id: `acctfirst${suffix}`,
      p_score: 10000,
      p_round: 10,
      p_board_size: 5,
      p_level: 3
    }, accountToken);
    assert(first.ok, `first account submit failed: ${first.text}`);
    assertEqual(first.body.improved, true, "first account score should improve");

    const rateLimited = await rpc("submit_score", {
      p_run_id: `acctrate${suffix}`,
      p_score: 9000,
      p_round: 9,
      p_board_size: 5,
      p_level: 3
    }, accountToken);
    assertEqual(rateLimited.status, 429, "second account submit inside 30s should be rate limited");

    await ageSubmissions(account.id);

    const lower = await rpc("submit_score", {
      p_run_id: `acctlower${suffix}`,
      p_score: 8000,
      p_round: 8,
      p_board_size: 5,
      p_level: 3
    }, accountToken);
    assert(lower.ok, `lower account submit failed: ${lower.text}`);
    assertEqual(lower.body.improved, false, "lower score should not improve the best");
    assertEqual(Number(lower.body.best.score), 10000, "best should remain the higher score");

    await ageSubmissions(account.id);

    const higher = await rpc("submit_score", {
      p_run_id: `accthigher${suffix}`,
      p_score: 12000,
      p_round: 12,
      p_board_size: 6,
      p_level: 4
    }, accountToken);
    assert(higher.ok, `higher account submit failed: ${higher.text}`);
    assertEqual(higher.body.improved, true, "higher score should improve the best");
    assertEqual(Number(higher.body.best.score), 12000, "best should update");
    assertEqual(higher.body.flagged, false, "normal score should not be flagged");
    assert(higher.body.rank >= 1, "normal score should be ranked");
  });

  // -------------------------------------------------------------------------
  // Save sync and conflicts
  // -------------------------------------------------------------------------
  const savePayload = (marker) => ({
    app: "tic-tac-nought",
    schema: 1,
    data: {
      state: {
        mode: "endless",
        marker,
        leaderboard: [{ name: handle, score: 12000 }]
      },
      settings: { sound: "on" }
    }
  });

  await run("save sync revisions", async () => {
    const empty = await rpc("get_save", {}, accountToken);
    assert(empty.ok, "account should read empty save");
    assertEqual(empty.body.status, "empty", "new account should have no save");

    const first = await rpc("sync_save", {
      p_base_revision: 0,
      p_payload: savePayload("first"),
      p_device_id: "test-device"
    }, accountToken);
    assert(first.ok, `first save sync failed: ${first.text}`);
    assertEqual(first.body.status, "ok", "first save should be accepted");
    assertEqual(first.body.revision, 1, "first save revision should be 1");

    const stale = await rpc("sync_save", {
      p_base_revision: 0,
      p_payload: savePayload("stale"),
      p_device_id: "test-device"
    }, accountToken);
    assert(stale.ok, `stale save sync failed: ${stale.text}`);
    assertEqual(stale.body.status, "conflict", "stale save should conflict");
    assertEqual(stale.body.revision, 1, "conflict should report current revision");

    const second = await rpc("sync_save", {
      p_base_revision: 1,
      p_payload: savePayload("second"),
      p_device_id: "test-device"
    }, accountToken);
    assert(second.ok, `second save sync failed: ${second.text}`);
    assertEqual(second.body.status, "ok", "second save should be accepted");
    assertEqual(second.body.revision, 2, "second save revision should be 2");

    const current = await rpc("get_save", {}, accountToken);
    assert(current.ok, "account should read current save");
    assertEqual(current.body.revision, 2, "current save revision should be 2");
    assertEqual(current.body.payload.data.state.marker, "second", "current save should hold latest payload");

    const info = await rpc("get_my_account", {}, accountToken);
    assertEqual(info.body.save.revision, 2, "account summary should include save revision");

    const exported = await rpc("export_account", {}, accountToken);
    assert(exported.ok, "account export should succeed");
    assertEqual(exported.body.kind, "account-export", "export kind should match");
    assertEqual(exported.body.save.revision, 2, "export should include save revision");
    assertEqual(exported.body.save.payload.data.state.marker, "second", "export should include save payload");
  });

  await run("save validation", async () => {
    const invalidApp = await rpc("sync_save", {
      p_base_revision: 2,
      p_payload: { app: "other", schema: 1, data: { state: {} } }
    }, accountToken);
    assertEqual(invalidApp.status, 400, "wrong app should be rejected");

    const invalidSchema = await rpc("sync_save", {
      p_base_revision: 2,
      p_payload: { app: "tic-tac-nought", schema: "one", data: { state: {} } }
    }, accountToken);
    assertEqual(invalidSchema.status, 400, "non-numeric schema should be rejected");

    const missingState = await rpc("sync_save", {
      p_base_revision: 2,
      p_payload: { app: "tic-tac-nought", schema: 1, data: {} }
    }, accountToken);
    assertEqual(missingState.status, 400, "missing state should be rejected");
  });

  await run("direct table access is denied", async () => {
    for (const table of ["profiles", "saves", "best_scores", "score_submissions", "leaderboard_state", "registration_events"]) {
      const response = await request(`/rest/v1/${table}?select=*`, { token: accountToken });
      assert(response.status === 401 || response.status === 403, `${table} should not be readable directly (got ${response.status})`);
    }
  });

  // -------------------------------------------------------------------------
  // Leaderboard, flags, bans
  // -------------------------------------------------------------------------
  await run("leaderboard and version polling", async () => {
    const first = await rpc("get_leaderboard", {});
    assert(first.ok, `anonymous leaderboard failed: ${first.text}`);
    assertEqual(first.body.changed, true, "first leaderboard read should be changed");
    assert(Array.isArray(first.body.rows), "leaderboard rows should be an array");
    const accountRow = first.body.rows.find((row) => row.handle === handle);
    assert(accountRow, "account should appear on the leaderboard");
    assertEqual(Number(accountRow.score), 12000, "leaderboard should show the account best");

    const same = await rpc("get_leaderboard", { p_version: first.body.version }, accountToken);
    assert(same.ok, "versioned leaderboard read failed");
    assertEqual(same.body.changed, false, "unchanged version should return changed false");

    const mine = await rpc("get_leaderboard", {}, accountToken);
    assert(mine.body.me, "signed-in leaderboard should include me");
    assertEqual(mine.body.me.handle, handle, "me row should match the account");
  });

  const flagHandle = `Flag_${suffix}`.slice(0, 20);
  const flagSignup = await signupAccount({ handle: flagHandle, password });
  assert(flagSignup.ok, `flag account signup failed: ${flagSignup.text}`);
  const flagUser = flagSignup.body.user;
  const flagToken = flagSignup.body.access_token;

  await run("flagged score moderation", async () => {
    const submit = await rpc("submit_score", {
      p_run_id: `flagrun${suffix}`,
      p_score: 20000000,
      p_round: 20,
      p_board_size: 7,
      p_level: 5
    }, flagToken);
    assert(submit.ok, `flagged submit failed: ${submit.text}`);
    assertEqual(submit.body.flagged, true, "high score should be flagged");
    assertEqual(submit.body.rank, null, "flagged score should not be ranked");

    const board = await rpc("get_leaderboard", {});
    assert(!board.body.rows.some((row) => row.handle === flagHandle), "flagged score should stay off the public board");

    const clear = await request(`/rest/v1/best_scores?user_id=eq.${flagUser.id}`, {
      method: "PATCH",
      token: serviceKey,
      key: serviceKey,
      body: { flagged: false },
      headers: { Prefer: "return=minimal" }
    });
    assert(clear.ok, "admin should clear the flag");

    const reviewed = await rpc("get_leaderboard", {});
    const row = reviewed.body.rows.find((entry) => entry.handle === flagHandle);
    assert(row, "reviewed score should appear on the public board");
    assertEqual(Number(row.score), 20000000, "reviewed score should be the flagged score");

    const hide = await request(`/rest/v1/best_scores?user_id=eq.${flagUser.id}`, {
      method: "PATCH",
      token: serviceKey,
      key: serviceKey,
      body: { hidden: true },
      headers: { Prefer: "return=minimal" }
    });
    assert(hide.ok, "admin should hide the score");

    const hidden = await rpc("get_leaderboard", {});
    assert(!hidden.body.rows.some((entry) => entry.handle === flagHandle), "hidden score should stay off the public board");

    const unhide = await request(`/rest/v1/best_scores?user_id=eq.${flagUser.id}`, {
      method: "PATCH",
      token: serviceKey,
      key: serviceKey,
      body: { hidden: false },
      headers: { Prefer: "return=minimal" }
    });
    assert(unhide.ok, "admin should unhide the score");
  });

  await run("ban and unban", async () => {
    const ban = await request(`/rest/v1/profiles?id=eq.${account.id}`, {
      method: "PATCH",
      token: serviceKey,
      key: serviceKey,
      body: { banned: true, ban_reason: "test" },
      headers: { Prefer: "return=minimal" }
    });
    assert(ban.ok, "admin should ban the account");

    const board = await rpc("get_leaderboard", {});
    assert(!board.body.rows.some((row) => row.handle === handle), "banned account should leave the public board");

    const submit = await rpc("submit_score", {
      p_run_id: `banned${suffix}`,
      p_score: 13000,
      p_round: 13,
      p_board_size: 6,
      p_level: 4
    }, accountToken);
    assertEqual(submit.status, 403, "banned account should not submit");

    const unban = await request(`/rest/v1/profiles?id=eq.${account.id}`, {
      method: "PATCH",
      token: serviceKey,
      key: serviceKey,
      body: { banned: false, ban_reason: null },
      headers: { Prefer: "return=minimal" }
    });
    assert(unban.ok, "admin should unban the account");

    const after = await rpc("get_leaderboard", {});
    assert(after.body.rows.some((row) => row.handle === handle), "unbanned account should return to the board");
  });

  // -------------------------------------------------------------------------
  // Guest claim
  // -------------------------------------------------------------------------
  const claimHandle = `Claim_${suffix}`.slice(0, 20);
  const claimSignup = await signupAccount({ handle: claimHandle, password });
  assert(claimSignup.ok, `claim account signup failed: ${claimSignup.text}`);
  const claimUser = claimSignup.body.user;

  const guest2Session = await signupAnonymous();
  assert(guest2Session.ok, "second anonymous signup should succeed");
  const guest2 = guest2Session.body.user;
  const guest2Token = guest2Session.body.access_token;

  await run("guest score transfer", async () => {
    const submit = await rpc("submit_score", {
      p_run_id: `guestclaim${suffix}`,
      p_score: 7000,
      p_round: 7,
      p_board_size: 5,
      p_level: 2
    }, guest2Token);
    assert(submit.ok, `guest claim score failed: ${submit.text}`);

    const claim = await rpc("claim_guest_score", {
      p_guest: guest2.id,
      p_new: claimUser.id
    }, serviceKey);
    assert(claim.ok, `claim RPC failed: ${claim.text}`);
    assertEqual(claim.body.transferred, true, "guest score should transfer to the new account");
    assertEqual(Number(claim.body.best.score), 7000, "new account should own the guest score");

    const deleted = await deleteUser(guest2.id);
    assert(deleted.ok, "guest user should be deleted after claim");

    const accountInfo = await rpc("get_my_account", {}, claimSignup.body.access_token);
    assertEqual(accountInfo.body.profile.handle, claimHandle, "claimed account should keep its handle");
    assertEqual(Number(accountInfo.body.best.score), 7000, "claimed score should survive guest deletion");
  });

  await run("guest claim does not replace a better account score", async () => {
    const better = await rpc("submit_score", {
      p_run_id: `claimbetter${suffix}`,
      p_score: 9000,
      p_round: 9,
      p_board_size: 5,
      p_level: 3
    }, claimSignup.body.access_token);
    assert(better.ok, `claim account score failed: ${better.text}`);

    const guest3Session = await signupAnonymous();
    assert(guest3Session.ok, "third anonymous signup should succeed");
    const guest3 = guest3Session.body.user;
    const guest3Token = guest3Session.body.access_token;

    const lower = await rpc("submit_score", {
      p_run_id: `guestlower${suffix}`,
      p_score: 6000,
      p_round: 6,
      p_board_size: 5,
      p_level: 2
    }, guest3Token);
    assert(lower.ok, `lower guest score failed: ${lower.text}`);

    const claim = await rpc("claim_guest_score", {
      p_guest: guest3.id,
      p_new: claimUser.id
    }, serviceKey);
    assert(claim.ok, `second claim RPC failed: ${claim.text}`);
    assertEqual(claim.body.transferred, false, "lower guest score should not replace the account best");
    assertEqual(Number(claim.body.best.score), 9000, "account best should remain higher");

    const deleted = await deleteUser(guest3.id);
    assert(deleted.ok, "second guest user should be deleted after claim");
  });

  // -------------------------------------------------------------------------
  // Login and account deletion
  // -------------------------------------------------------------------------
  await run("account login", async () => {
    const session = await login(accountEmail(handle), password);
    assert(session.ok, `account login failed: ${session.text}`);
    assertEqual(session.body.user.id, account.id, "login should return the same account");
  });

  await run("account deletion cascades", async () => {
    const deleted = await deleteUser(account.id);
    assert(deleted.ok, "account deletion should succeed");

    const session = await login(accountEmail(handle), password);
    assert(!session.ok, "deleted account should not log in");

    const board = await rpc("get_leaderboard", {});
    assert(!board.body.rows.some((row) => row.handle === handle), "deleted account should leave the board");
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
