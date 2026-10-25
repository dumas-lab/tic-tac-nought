/*
 * Local fallback configuration. scripts/build-web.mjs replaces this file in
 * dist/web for online test/live builds. Never put a service-role key here.
 */
window.TTN_ONLINE_CONFIG = Object.freeze({
  enabled: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  version: "0.3.1"
});
