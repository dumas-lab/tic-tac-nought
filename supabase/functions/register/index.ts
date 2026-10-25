import {
  createAccount,
  enforceRateLimit,
  handleTaken,
  json,
  normalizeHandle,
  readJson,
  serve,
  validatePassword
} from "../_shared/http.ts";

Deno.serve((req) =>
  serve(req, async () => {
    const body = await readJson(req);
    const { handle, norm } = normalizeHandle(body.handle);
    const password = validatePassword(body.password);

    await enforceRateLimit(req);
    if (await handleTaken(norm)) return json(req, { error: "handle_taken" }, 409);

    await createAccount(handle, password);
    return json(req, { ok: true, handle }, 201);
  })
);
