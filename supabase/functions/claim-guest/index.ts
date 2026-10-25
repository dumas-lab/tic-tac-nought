import {
  callRpc,
  createAccount,
  deleteAccount,
  enforceRateLimit,
  getUser,
  handleTaken,
  json,
  normalizeHandle,
  readJson,
  serve,
  validatePassword
} from "../_shared/http.ts";

Deno.serve((req) =>
  serve(req, async () => {
    const guest = await getUser(req);
    if (!guest.is_anonymous) return json(req, { error: "not_guest" }, 403);

    const body = await readJson(req);
    const { handle, norm } = normalizeHandle(body.handle);
    const password = validatePassword(body.password);

    await enforceRateLimit(req);
    if (await handleTaken(norm)) return json(req, { error: "handle_taken" }, 409);

    const account = await createAccount(handle, password);

    let claim: Record<string, unknown>;
    try {
      claim = await callRpc("claim_guest_score", {
        p_guest: guest.id,
        p_new: account.id
      });
    } catch (error) {
      await deleteAccount(account.id).catch((cleanupError) => console.error(cleanupError));
      throw error;
    }

    try {
      await deleteAccount(guest.id);
    } catch (error) {
      // Put the account back so the guest keeps the score and can retry.
      await deleteAccount(account.id).catch((cleanupError) => console.error(cleanupError));
      throw error;
    }

    return json(req, {
      ok: true,
      handle,
      transferred: Boolean(claim.transferred),
      best: claim.best ?? null
    }, 201);
  })
);
