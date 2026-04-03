import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { quotationId } = await req.json();
    if (!quotationId) throw new Error("quotationId is required");

    // Fetch quotation with related data
    const { data: quotation, error: qErr } = await adminClient
      .from("quotations")
      .select(
        "*, clients(full_name, email, phone), policies(policy_number, policy_type, premium_amount, start_date, end_date, insurers(name))"
      )
      .eq("id", quotationId)
      .single();

    if (qErr || !quotation) throw new Error("Quotation not found");

    const client = (quotation as any).clients;
    const policy = (quotation as any).policies;

    if (!client?.email) {
      throw new Error("Client does not have an email address");
    }

    const insurerName = policy?.insurers?.name || "N/A";
    const policyNumber = policy?.policy_number || "N/A";
    const policyType = policy?.policy_type || "N/A";
    const premiumAmount = quotation.amount
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(Number(quotation.amount))
      : "N/A";
    const startDate = policy?.start_date || "N/A";
    const endDate = policy?.end_date || "N/A";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">Insurance Quotation</h2>
        <p>Dear <strong>${client.full_name}</strong>,</p>
        <p>Please find below the details of your insurance quotation:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Policy Number</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${policyNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Policy Type</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${policyType}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Insurer</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${insurerName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Premium Amount</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold; color: #2563eb;">${premiumAmount}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Coverage Period</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${startDate} to ${endDate}</td>
          </tr>
        </table>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          This is an automated email from RiskMarshal Insurance Management.
        </p>
      </div>
    `;

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "RiskMarshal <onboarding@resend.dev>",
        to: [client.email],
        subject: `Insurance Quotation — ${policyNumber}`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend API error: ${errBody}`);
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
