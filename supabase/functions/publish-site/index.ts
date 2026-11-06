// Rebuilds poweredbypfx.com after someone publishes website text.
// The GitHub token lives in Supabase's secrets, never in a web page.
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   GH_DEPLOY_TOKEN  fine-grained GitHub token: website repo only, Actions read & write
//   GH_REPO          the website repo, e.g. shreyakarnik/20261001
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });

  // Only signed-in people on the team list can trigger a rebuild.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: isTeam, error } = await sb.rpc("is_team");
  if (error || isTeam !== true) return reply(403, { error: "Not on the PFX team list" });

  const repo = Deno.env.get("GH_REPO");
  const token = Deno.env.get("GH_DEPLOY_TOKEN");
  if (!repo || !token) return reply(500, { error: "GH_REPO or GH_DEPLOY_TOKEN isn't set" });

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pfx-internal",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) return reply(502, { error: `GitHub said ${res.status}` });
  return reply(200, { ok: true });
});
