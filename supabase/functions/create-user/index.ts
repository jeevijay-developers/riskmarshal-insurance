import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify the caller is authenticated and has super_admin role.
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT and resolve caller identity.
    const {
      data: { user: caller },
      error: authError,
    } = await adminClient.auth.getUser(token);
    if (authError || !caller) throw new Error("Unauthorized");

    // Check if caller is super_admin
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleData) throw new Error("Only super_admin can create users");

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name || !role) {
      throw new Error("email, password, full_name, and role are required");
    }

    // Create user with service role (bypasses disable_signup)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) throw createError;

    // Assign role
    const { error: roleInsertError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
    });

    if (roleInsertError) throw roleInsertError;

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Only super_admin can create users" ? 403 : 400;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
