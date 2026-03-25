import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { policyId, documentPath } = await req.json();
    if (!policyId || !documentPath) {
      return new Response(JSON.stringify({ error: "policyId and documentPath are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("policy-documents")
      .download(documentPath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download document" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = fileData.type || "application/pdf";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64 } },
              {
                text: `You are an expert insurance document parser. Extract ALL available information from this insurance policy document and return ONLY valid JSON (no markdown, no code fences) with this exact structure. Use null for any field not found in the document.

{
  "vehicleDetails": {
    "manufacturer": "string or null",
    "model": "string or null",
    "variant": "string or null",
    "registrationNumber": "string or null",
    "engineNumber": "string or null",
    "chassisNumber": "string or null",
    "fuelType": "string or null",
    "seatingCapacity": "number or null",
    "cubicCapacity": "number or null",
    "bodyType": "string or null",
    "odometerReading": "number or null",
    "yearOfManufacture": "number or null",
    "color": "string or null"
  },
  "policyDetails": {
    "policyNumber": "string or null",
    "periodFrom": "YYYY-MM-DD or null",
    "periodTo": "YYYY-MM-DD or null",
    "insuranceStartDate": "YYYY-MM-DD or null",
    "insuranceEndDate": "YYYY-MM-DD or null",
    "invoiceNumber": "string or null",
    "invoiceDate": "YYYY-MM-DD or null",
    "customerId": "string or null",
    "gstIn": "string or null",
    "policyType": "string or null (e.g. Comprehensive, Third Party, Own Damage)",
    "coverType": "string or null (e.g. Package, Standalone OD, Standalone TP)",
    "paymentDetails": {
      "mode": "string or null (Cheque/Online/Cash)",
      "chequeNumber": "string or null",
      "bankName": "string or null",
      "transactionId": "string or null"
    },
    "previousPolicy": {
      "insurer": "string or null",
      "policyNumber": "string or null",
      "validFrom": "YYYY-MM-DD or null",
      "validTo": "YYYY-MM-DD or null"
    }
  },
  "premiumDetails": {
    "ownDamage": {
      "basicOD": "number or null",
      "addOnZeroDep": "number or null",
      "addOnConsumables": "number or null",
      "addOnRSA": "number or null",
      "addOnEngineProtect": "number or null",
      "addOnKeyReplace": "number or null",
      "addOnNCBProtect": "number or null",
      "addOnReturnToInvoice": "number or null",
      "otherAddOns": "number or null",
      "total": "number or null"
    },
    "liability": {
      "basicTP": "number or null",
      "paCoverOwnerDriver": "number or null",
      "paCoverPassengers": "number or null",
      "llForPaidDriver": "number or null",
      "llEmployees": "number or null",
      "otherLiability": "number or null",
      "total": "number or null"
    },
    "netPremium": "number or null",
    "gstAmount": "number or null",
    "gstPercentage": "number or null",
    "finalPremium": "number or null",
    "compulsoryDeductible": "number or null",
    "voluntaryDeductible": "number or null",
    "ncbPercentage": "number or null",
    "ncbDiscount": "number or null",
    "totalDiscount": "number or null"
  },
  "clientDetails": {
    "name": "string or null",
    "address": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "gstIn": "string or null",
    "panNumber": "string or null",
    "aadharNumber": "string or null",
    "dateOfBirth": "YYYY-MM-DD or null",
    "nominee": {
      "name": "string or null",
      "relationship": "string or null",
      "age": "number or null"
    }
  },
  "insurerDetails": {
    "name": "string or null",
    "branchAddress": "string or null",
    "helplineNumber": "string or null",
    "email": "string or null",
    "irdaRegNumber": "string or null"
  },
  "agentDetails": {
    "name": "string or null",
    "code": "string or null",
    "contact": "string or null",
    "licenseNumber": "string or null"
  },
  "additionalInfo": {
    "limitationsLiability": "string or null",
    "termsConditions": "string or null",
    "specialConditions": "string or null",
    "hypothecation": "string or null",
    "qrCodeLink": "string or null"
  }
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no code blocks, no explanation text.`,
              },
            ],
          }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(JSON.stringify({ error: "OCR extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResult = await geminiResponse.json();
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let extractedData;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw_text: textContent };
    } catch {
      extractedData = { raw_text: textContent };
    }

    const { error: updateError } = await supabase
      .from("policies")
      .update({ ocr_extracted_data: extractedData })
      .eq("id", policyId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
