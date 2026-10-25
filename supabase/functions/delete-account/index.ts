import {
  deleteAccount,
  getUser,
  json,
  readJson,
  serve
} from "../_shared/http.ts";

Deno.serve((req) =>
  serve(req, async () => {
    const user = await getUser(req);
    const body = await readJson(req);
    if (body.confirm !== "DELETE") {
      return json(req, { error: "confirmation_required" }, 400);
    }

    await deleteAccount(user.id);
    return json(req, { ok: true });
  })
);
