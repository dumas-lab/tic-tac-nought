#!/usr/bin/env node
// Tic Tac Nought admin CLI. Uses the service-role key; never ship this to clients.
// Defaults to the test project. Pass --live to target the live project.

import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const envPath = process.env.TTN_ENV_FILE || path.join(root, ".env.supabase.local");
const args = process.argv.slice(2);
const useLive = args.includes("--live");
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

const prefix = useLive ? "TTN_LIVE" : "TTN_TEST";
const url = env[`${prefix}_SUPABASE_URL`];
const serviceKey = env[`${prefix}_SERVICE_ROLE_KEY`];
const anonKey = env[`${prefix}_SUPABASE_KEY`];

if (!url || !serviceKey) {
  console.error(`Missing ${prefix}_SUPABASE_URL or ${prefix}_SERVICE_ROLE_KEY.`);
  process.exit(1);
}

const positional = args.filter((arg) => !arg.startsWith("--"));
const command = positional.shift() || "help";
const yes = args.includes("--yes");
const dryRun = !yes || args.includes("--dry-run");
const RESERVED = new Set([
  "admin", "administrator", "mod", "moderator", "nought", "system",
  "support", "ttn", "tic", "tac", "toe", "guest", "anonymous",
  "null", "undefined", "root", "owner"
]);

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    "Content-Type": "application/json",
    ...extra
  };
}

async function request(pathname, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${url}${pathname}`, {
    method,
    headers: serviceHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed (${response.status}): ${text}`);
  }
  return { body: parsed, headers: response.headers, status: response.status };
}

function normalizeHandle(value) {
  if (typeof value !== "string") throw new Error("handle is required");
  const handle = value.trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(handle)) {
    throw new Error("handle must be 3-20 characters using letters, numbers, _ or -");
  }
  const norm = handle.toLowerCase();
  if (RESERVED.has(norm) || norm.startsWith("guest-")) {
    throw new Error("that handle is reserved");
  }
  return { handle, norm };
}

async function findProfile(handle) {
  const norm = String(handle || "").trim().toLowerCase();
  if (!norm) throw new Error("handle is required");
  const result = await request(`/rest/v1/profiles?handle_norm=eq.${encodeURIComponent(norm)}&select=*`);
  if (!result.body.length) throw new Error(`no profile found for "${handle}"`);
  return result.body[0];
}

async function countRows(pathname) {
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    method: "HEAD",
    headers: serviceHeaders({ Prefer: "count=exact" })
  });
  if (!response.ok) throw new Error(`count ${pathname} failed (${response.status})`);
  const range = response.headers.get("content-range") || "*/0";
  return Number(range.split("/").pop() || 0);
}

async function adminListUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const result = await request(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const batch = result.body.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

async function updateAuthUser(id, body) {
  return request(`/auth/v1/admin/users/${id}`, { method: "PUT", body });
}

async function deleteAuthUser(id) {
  return request(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
}

async function renameAccount(oldHandle, newHandle) {
  const profile = await findProfile(oldHandle);
  if (profile.is_guest) throw new Error("guests cannot be renamed; they are deleted after claiming");
  const { handle, norm } = normalizeHandle(newHandle);
  if (norm === profile.handle_norm) return { changed: false, handle: profile.handle };

  const existing = await request(`/rest/v1/profiles?handle_norm=eq.${encodeURIComponent(norm)}&select=id`);
  if (existing.body.length) throw new Error(`handle "${handle}" is already taken`);

  const oldEmail = `${profile.handle_norm}@ttn.invalid`;
  const newEmail = `${norm}@ttn.invalid`;
  await updateAuthUser(profile.id, {
    email: newEmail,
    email_confirm: true,
    user_metadata: { handle }
  });

  try {
    await request(`/rest/v1/profiles?id=eq.${profile.id}`, {
      method: "PATCH",
      body: { handle, handle_norm: norm },
      headers: { Prefer: "return=minimal" }
    });
  } catch (error) {
    await updateAuthUser(profile.id, {
      email: oldEmail,
      email_confirm: true,
      user_metadata: { handle: profile.handle }
    }).catch(() => {});
    throw error;
  }

  return { changed: true, oldHandle: profile.handle, handle };
}

function printHelp() {
  console.log(`Tic Tac Nought admin (${useLive ? "LIVE" : "test"}: ${url})

Usage: node scripts/admin.mjs <command> [args] [--live] [--yes]

Commands:
  stats                         Counts for accounts, guests, scores, and saves
  health                        Call the database health RPC
  list [--limit N]              List profiles (default 50)
  reset-password <handle> <pw>  Set an account password (admin-only reset)
  rename <old> <new>            Rename an account and its synthetic login email
  ban <handle> [reason]         Block score submission and save sync
  unban <handle>                Restore an account
  hide-score <handle>           Remove a best score from the public board
  unhide-score <handle>         Restore a hidden best score
  flag-score <handle>           Hold a best score for review
  unflag-score <handle>         Approve a flagged best score
  delete-account <handle> --yes Permanently delete an account and its data
  prune-guests [--days N] --yes Delete anonymous guests older than N days (default 30)

Safety:
  --live   Target ttn-live instead of ttn-test.
  --yes    Required for destructive commands. prune-guests is a dry run without it.
`);
}

async function main() {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;

    case "stats": {
      const accounts = await countRows("profiles?select=id&is_guest=eq.false");
      const guests = await countRows("profiles?select=id&is_guest=eq.true");
      const banned = await countRows("profiles?select=id&banned=eq.true");
      const scores = await countRows("best_scores?select=user_id");
      const hidden = await countRows("best_scores?select=user_id&hidden=eq.true");
      const flagged = await countRows("best_scores?select=user_id&flagged=eq.true");
      const saves = await countRows("saves?select=user_id");
      const submissions = await countRows("score_submissions?select=id");
      console.log(JSON.stringify({ accounts, guests, banned, scores, hidden, flagged, saves, submissions }, null, 2));
      return;
    }

    case "health": {
      const response = await fetch(`${url}/rest/v1/rpc/health`, {
        method: "POST",
        headers: {
          apikey: anonKey || serviceKey,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      console.log(response.status, await response.text());
      if (!response.ok) process.exitCode = 1;
      return;
    }

    case "list": {
      const limitArg = args.indexOf("--limit");
      const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be 1-500");
      const result = await request(
        `/rest/v1/profiles?select=handle,is_guest,banned,created_at,best_scores(score,hidden,flagged)&order=created_at.desc&limit=${limit}`
      );
      for (const row of result.body) {
        const best = Array.isArray(row.best_scores) ? row.best_scores[0] : row.best_scores;
        const score = best ? ` best=${best.score}${best.hidden ? " hidden" : ""}${best.flagged ? " flagged" : ""}` : "";
        const flags = `${row.is_guest ? " guest" : ""}${row.banned ? " BANNED" : ""}`;
        console.log(`${row.handle}${flags}${score}  ${row.created_at}`);
      }
      return;
    }

    case "reset-password": {
      const handle = positional[0];
      const password = positional[1];
      if (!password || password.length < 8 || password.length > 128) {
        throw new Error("usage: reset-password <handle> <password (8-128 chars)>");
      }
      const profile = await findProfile(handle);
      if (profile.is_guest) throw new Error("guests do not have passwords");
      await updateAuthUser(profile.id, { password });
      console.log(`password reset for ${profile.handle}`);
      return;
    }

    case "rename": {
      const result = await renameAccount(positional[0], positional[1]);
      if (!result.changed) {
        console.log(`handle already ${result.handle}`);
      } else {
        console.log(`renamed ${result.oldHandle} -> ${result.handle}`);
      }
      return;
    }

    case "ban": {
      const profile = await findProfile(positional[0]);
      const reason = positional.slice(1).join(" ").trim() || "policy violation";
      await request(`/rest/v1/profiles?id=eq.${profile.id}`, {
        method: "PATCH",
        body: { banned: true, ban_reason: reason },
        headers: { Prefer: "return=minimal" }
      });
      console.log(`banned ${profile.handle}: ${reason}`);
      return;
    }

    case "unban": {
      const profile = await findProfile(positional[0]);
      await request(`/rest/v1/profiles?id=eq.${profile.id}`, {
        method: "PATCH",
        body: { banned: false, ban_reason: null },
        headers: { Prefer: "return=minimal" }
      });
      console.log(`unbanned ${profile.handle}`);
      return;
    }

    case "hide-score":
    case "unhide-score":
    case "flag-score":
    case "unflag-score": {
      const profile = await findProfile(positional[0]);
      const field = command.includes("hide") ? "hidden" : "flagged";
      const value = command.startsWith("un") ? false : true;
      const result = await request(`/rest/v1/best_scores?user_id=eq.${profile.id}`, {
        method: "PATCH",
        body: { [field]: value },
        headers: { Prefer: "return=representation" }
      });
      if (!result.body.length) throw new Error(`${profile.handle} has no best score`);
      console.log(`${command} ${profile.handle}`);
      return;
    }

    case "delete-account": {
      const profile = await findProfile(positional[0]);
      if (!yes) {
        throw new Error(`refusing to delete ${profile.handle} without --yes`);
      }
      await deleteAuthUser(profile.id);
      console.log(`deleted ${profile.handle}`);
      return;
    }

    case "prune-guests": {
      const daysArg = args.indexOf("--days");
      const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 30;
      if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("--days must be 1-3650");
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const users = await adminListUsers();
      const guests = users.filter((user) => user.is_anonymous && new Date(user.created_at).getTime() < cutoff);
      if (!guests.length) {
        console.log(`no guests older than ${days} days`);
        return;
      }
      if (dryRun) {
        console.log(`dry run: ${guests.length} guest(s) older than ${days} days`);
        for (const guest of guests.slice(0, 20)) console.log(`  ${guest.id}  ${guest.created_at}`);
        if (guests.length > 20) console.log(`  ... and ${guests.length - 20} more`);
        console.log("pass --yes to delete them");
        return;
      }
      let deleted = 0;
      for (const guest of guests) {
        await deleteAuthUser(guest.id);
        deleted += 1;
      }
      console.log(`deleted ${deleted} guest(s) older than ${days} days`);
      return;
    }

    default:
      printHelp();
      process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
