/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSearchBar } from "@/components/ResponsiveSearchBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Eye, Upload, FileDown, ChevronDown, Edit3, CheckCircle, AlertCircle, ChevronRight, Send, Loader2, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import PolicyExtractionLoader from "@/components/PolicyExtractionLoader";

type Policy = Tables<"policies">;

interface PolicyWithRelations extends Policy {
  clients?: { full_name: string } | null;
  insurers?: { name: string } | null;
}

const statusColor: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  expiring: "bg-warning/10 text-warning border-warning/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground",
};

const POLICY_TYPES = [
  // Motor
  { id: "TWP - EV", name: "TWP - EV", category: "Motor" },
  { id: "TWP - Non-EV", name: "TWP - Non-EV", category: "Motor" },
  { id: "PCP", name: "PCP", category: "Motor" },
  { id: "CVI", name: "CVI", category: "Motor" },
  { id: "PCV", name: "PCV", category: "Motor" },
  { id: "Misc D", name: "Misc D", category: "Motor" },
  // Non-Motor
  { id: "Fire", name: "Fire", category: "Non-Motor" },
  { id: "Burglary", name: "Burglary", category: "Non-Motor" },
  { id: "Package - Traclus", name: "Package - Traclus", category: "Non-Motor" },
  { id: "Package - MSME", name: "Package - MSME", category: "Non-Motor" },
  { id: "Package - Jewellers", name: "Package - Jewellers", category: "Non-Motor" },
  { id: "CAR/CPM/EAR", name: "CAR/CPM/EAR", category: "Non-Motor" },
  { id: "WC", name: "WC", category: "Non-Motor" },
  { id: "Liability (PL/CGL)", name: "Liability (PL/CGL)", category: "Non-Motor" },
  { id: "GPA", name: "GPA", category: "Non-Motor" },
  { id: "CHI", name: "CHI", category: "Non-Motor" },
  // Health
  { id: "Retail Health", name: "Retail Health", category: "Health" },
  { id: "Personal Accident", name: "Personal Accident", category: "Health" },
  // Life
  { id: "GIL", name: "GIL", category: "Life" },
  { id: "Term Plan", name: "Term Plan", category: "Life" },
  { id: "Gratuity", name: "Gratuity", category: "Life" },
];

const CATEGORY_ORDER: Record<string, number> = {
  "Motor": 0,
  "Non-Motor": 1,
  "Health": 2,
  "Life": 3,
};

const Policies = () => {
  const navigate = useNavigate();
  const { profileId, role, signOut } = useAuth();
  const isAdmin = role === "super_admin";
  const [policies, setPolicies] = useState<PolicyWithRelations[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadExtractOpen, setUploadExtractOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyWithRelations | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<PolicyWithRelations | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<PolicyWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Send Quotation modal state
  const [sendQuotationOpen, setSendQuotationOpen] = useState(false);
  const [sendingPolicy, setSendingPolicy] = useState<PolicyWithRelations | null>(null);
  const [sendPaymentLink, setSendPaymentLink] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendingQuotation, setSendingQuotation] = useState(false);

  // Intermediary list for admin to select who issued the policy
  const [intermediaries, setIntermediaries] = useState<{ id: string; full_name: string; intermediary_code?: string }[]>([]);

  // Post-save success modal state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successPolicy, setSuccessPolicy] = useState<PolicyWithRelations | null>(null);

  // Upload & Extract state
  const [extractionStep, setExtractionStep] = useState(0);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClientId, setUploadClientId] = useState("");
  const [uploadInsurerId, setUploadInsurerId] = useState("");
  const [uploadPolicyType, setUploadPolicyType] = useState(POLICY_TYPES[0].id);
  const [uploadIntermediaryId, setUploadIntermediaryId] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewEditMode, setReviewEditMode] = useState(true);

  const normalizeExtractedData = (result: any) => {
    const candidate =
      result?.data?.extractedFields ??
      result?.data?.ai?.parsed ??
      result?.data ??
      result?.extractedFields ??
      result?.ai?.parsed ??
      result;

    return candidate && typeof candidate === "object" ? candidate : {};
  };

  const getFunctionErrorMessage = async (error: any, fallback: string) => {
    if (!error) return fallback;

    const responseLike = error?.context;
    if (responseLike && typeof responseLike.clone === "function") {
      try {
        const rawText = await responseLike.clone().text();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            if (typeof parsed?.error === "string") return parsed.error;
            if (typeof parsed?.message === "string") return parsed.message;
          } catch {
            return rawText;
          }
        }
      } catch {
        // Ignore context parsing failures and fallback to standard message.
      }
    }

    return error?.message || fallback;
  };

  const toFriendlyAuthMessage = (message: string): string => {
    if (!message) return "Something went wrong";
    if (/missing authorization header|invalid jwt|jwt expired|unauthorized|no api key found/i.test(message)) {
      return "Your session has expired. Please sign in again and retry.";
    }
    return message;
  };

  const invokeExtractPolicyData = async (payload: { policyId: string; documentPath?: string; documentUrl?: string }) => {
    // The Supabase SDK (with autoRefreshToken: true) automatically attaches a
    // fresh JWT to every functions.invoke call. We do NOT manually refresh or
    // set Authorization headers — doing so causes token revocation conflicts
    // that result in 401 errors and phantom "session expired" sign-outs.
    const result = await supabase.functions.invoke("extract-policy-data", {
      body: payload,
    });

    // If the platform returned a 401, surface it as an auth error so the
    // caller's catch block can sign the user out automatically.
    if (result.error) {
      const ctx = (result.error as { context?: Response })?.context;
      if (ctx?.status === 401) {
        throw new Error("jwt expired");
      }
    }

    return result;
  };

  const toDateInputValue = (value: unknown): string => {
    if (!value) return "";

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

      const parts = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
      if (parts) {
        const day = parts[1].padStart(2, "0");
        const month = parts[2].padStart(2, "0");
        const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
        return `${year}-${month}-${day}`;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }

      return "";
    }

    if (typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    }

    return "";
  };

  const resolveExtractedPolicyType = (value: unknown): string => {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";

    const normalize = (input: string) => input.toLowerCase().replace(/[^a-z0-9]/g, "");

    const exactMatch = POLICY_TYPES.find((type) => type.id === raw);
    if (exactMatch) return exactMatch.id;

    const normalizedInput = normalize(raw);
    const normalizedMatch = POLICY_TYPES.find(
      (type) => normalize(type.id) === normalizedInput || normalize(type.name) === normalizedInput
    );
    if (normalizedMatch) return normalizedMatch.id;

    const aliasMap: Record<string, string> = {
      privatecarpackage: "PCP",
      privatecarpackagepolicy: "PCP",
      comprehensive: "PCP",
      comprehensivepolicy: "PCP",
      thirdparty: "TWP - Non-EV",
      thirdpartypolicy: "TWP - Non-EV",
      evthirdparty: "TWP - EV",
      electricthirdparty: "TWP - EV",
      privatecarevpackage: "TWP - EV",
      twpnonev: "TWP - Non-EV",
      twpev: "TWP - EV",
    };
    if (aliasMap[normalizedInput]) return aliasMap[normalizedInput];

    const containsMatch = POLICY_TYPES.find((type) => {
      const normalizedType = normalize(type.id);
      return normalizedInput.includes(normalizedType) || normalizedType.includes(normalizedInput);
    });
    if (containsMatch) return containsMatch.id;

    if (normalizedInput.includes("thirdparty")) {
      return normalizedInput.includes("ev") || normalizedInput.includes("electric") ? "TWP - EV" : "TWP - Non-EV";
    }

    if (normalizedInput.includes("privatecar") && normalizedInput.includes("package")) {
      return "PCP";
    }

    const categoryDefaultMap: Record<string, string> = {
      motor: "PCP",
      nonmotor: "Fire",
      health: "Retail Health",
      life: "GIL",
    };

    return categoryDefaultMap[normalizedInput] || "";
  };

  const [formData, setFormData] = useState({
    policy_number: "", client_id: "", insurer_id: "", policy_type: "general",
    premium_amount: "", coverage_amount: "", start_date: "", end_date: "",
    status: "active" as string,
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [polRes, cliRes, insRes, intRes] = await Promise.all([
      supabase.from("policies").select("*, clients(full_name), insurers(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("insurers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("profiles").select("id, full_name, intermediary_code").order("full_name"),
    ]);
    if (polRes.data) setPolicies(polRes.data as PolicyWithRelations[]);
    if (cliRes.data) setClients(cliRes.data);
    if (insRes.data) setInsurers(insRes.data);
    if (intRes.data) setIntermediaries(intRes.data as { id: string; full_name: string; intermediary_code?: string }[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const existingPolicyTypes = useMemo(() => {
    const types = new Set(policies.map((p) => p.policy_type));
    return Array.from(types).sort();
  }, [policies]);

  const groupedPolicyTypes = useMemo(() => {
    const groups: Record<string, { id: string; name: string }[]> = {};
    
    // Use the predefined list
    POLICY_TYPES.forEach(pt => {
      if (!groups[pt.category]) groups[pt.category] = [];
      groups[pt.category].push({ id: pt.id, name: pt.name });
    });

    // Add any "Other" types found in policies
    const knownIds = new Set(POLICY_TYPES.map(pt => pt.id));
    const others = existingPolicyTypes.filter(t => t && !knownIds.has(t));
    
    if (others.length > 0) {
      groups["Other"] = others.map(t => ({ 
        id: t, 
        name: t.charAt(0).toUpperCase() + t.slice(1) 
      }));
    }

    return Object.entries(groups)
      .sort((a, b) => (CATEGORY_ORDER[a[0]] ?? 99) - (CATEGORY_ORDER[b[0]] ?? 99))
      .map(([category, items]) => ({ category, items }));
  }, [existingPolicyTypes]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || p.policy_number.toLowerCase().includes(s) || (p.clients?.full_name?.toLowerCase().includes(s));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchType = typeFilter === "all" || p.policy_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [policies, searchTerm, statusFilter, typeFilter]);

  const openAdd = () => {
    setEditingPolicy(null);
    setFormData({ policy_number: "", client_id: "", insurer_id: "", policy_type: "general", premium_amount: "", coverage_amount: "", start_date: "", end_date: "", status: "active" });
    setDocFile(null);
    setFormOpen(true);
  };

  const openEdit = (p: PolicyWithRelations) => {
    setEditingPolicy(p);
    setFormData({
      policy_number: p.policy_number, client_id: p.client_id, insurer_id: p.insurer_id || "",
      policy_type: p.policy_type, premium_amount: String(p.premium_amount),
      coverage_amount: p.coverage_amount ? String(p.coverage_amount) : "",
      start_date: p.start_date, end_date: p.end_date, status: p.status,
    });
    setDocFile(null);
    setFormOpen(true);
  };

  const uploadToImageKit = async (file: File, policyId: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", `${policyId}_${Date.now()}.${file.name.split(".").pop()}`);
      formData.append("folder", "/policy-documents");
      const { data, error } = await supabase.functions.invoke("imagekit-upload", { body: formData });
      if (error || data?.error) { toast.error("Document upload failed"); return null; }
      return data.url as string;
    } catch {
      toast.error("Document upload failed");
      return null;
    }
  };

  const uploadToPolicyStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop() || "pdf";
    const filePath = `${profileId}/${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("policy-documents")
      .upload(filePath, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);
    return filePath;
  };

  const handleSave = async () => {
    if (!formData.policy_number.trim() || !formData.client_id || !formData.start_date || !formData.end_date) {
      toast.error("Policy number, client, and dates are required"); return;
    }
    if (!profileId) { toast.error("Profile not loaded"); return; }
    setSaving(true);
    try {
      const payload = {
        policy_number: formData.policy_number.trim(), client_id: formData.client_id,
        insurer_id: formData.insurer_id || null, policy_type: formData.policy_type,
        premium_amount: Number(formData.premium_amount) || 0,
        coverage_amount: formData.coverage_amount ? Number(formData.coverage_amount) : null,
        start_date: formData.start_date, end_date: formData.end_date,
        status: formData.status as Policy["status"],
      };
      if (editingPolicy) {
        const docUrl = docFile ? await uploadToImageKit(docFile, editingPolicy.id) : null;
        const updatePayload = docUrl ? { ...payload, original_document_url: docUrl } : payload;
        const { error } = await supabase.from("policies").update(updatePayload).eq("id", editingPolicy.id);
        if (error) throw error;
        toast.success("Policy updated successfully");
      } else {
        const { data, error } = await supabase.from("policies").insert({ ...payload, intermediary_id: profileId }).select("*, clients(full_name), insurers(name)").single();
        if (error) throw error;
        if (docFile && data) {
          const docUrl = await uploadToImageKit(docFile, data.id);
          if (docUrl) await supabase.from("policies").update({ original_document_url: docUrl }).eq("id", data.id);
        }
        // Auto-create commission record
        await autoCreateCommission(data.id, profileId, data.insurer_id, data.premium_amount);
        // Show success modal
        setSuccessPolicy(data as PolicyWithRelations);
        setSuccessModalOpen(true);
      }
      setFormOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    const { error } = await supabase.from("policies").delete().eq("id", deletingPolicy.id);
    if (error) {
      if (/foreign key constraint|violates foreign key constraint/i.test(error.message || "")) {
        toast.error("This policy is linked to related records and cannot be deleted yet. Please refresh and try again.");
      }
      const friendly = toFriendlyAuthMessage(error.message || "Failed to delete policy");
      if (!/foreign key constraint|violates foreign key constraint/i.test(error.message || "")) {
        toast.error(friendly);
      }
    } else {
      toast.success("Policy deleted");
      fetchData();
    }
    setDeleteOpen(false);
    setDeletingPolicy(null);
  };

  // Upload & Extract flow
  const handleUploadAndExtract = async () => {
    if (!uploadFile || !profileId) return;
    if (!uploadClientId) {
      setUploadError("Please select a client before uploading");
      return;
    }
    if (isAdmin && !uploadIntermediaryId) {
      setUploadError("Please select the intermediary who issued this policy");
      return;
    }

    let createdPolicyId: string | null = null;

    setUploadError(null);
    setExtractionStep(0);
    setExtractedData(null);
    setUploading(true);

    try {

      // Step 0: Upload to Supabase Storage so OCR can download by path
      const documentPath = await uploadToPolicyStorage(uploadFile);
      toast.info("Document uploaded, starting AI analysis...");

      // Step 1: AI analyzing
      setExtractionStep(1);

      // Create a placeholder policy to store extracted data
      const selectedIntermediaryId = (isAdmin && uploadIntermediaryId) ? uploadIntermediaryId : profileId;
      const { data: newPolicy, error: createErr } = await supabase.from("policies").insert({
        policy_number: "EXTRACTING-" + Date.now(),
        client_id: uploadClientId,
        insurer_id: uploadInsurerId || null,
        policy_type: uploadPolicyType || POLICY_TYPES[0].id,
        intermediary_id: selectedIntermediaryId,
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        original_document_url: documentPath,
        status: "active" as const,
      }).select().single();

      if (createErr) throw new Error("Failed to create policy record: " + createErr.message);
      createdPolicyId = newPolicy.id;

      // Step 2: Extracting fields
      setExtractionStep(2);
      toast.info("AI is extracting policy fields...");

      const { data: extractResult, error: extractErr } = await invokeExtractPolicyData({
        policyId: newPolicy.id,
        documentPath,
      });

      if (extractErr) {
        const detail = await getFunctionErrorMessage(extractErr, "Extraction failed");
        throw new Error(detail);
      }

      const normalizedExtractedData = normalizeExtractedData(extractResult);
      if (!Object.keys(normalizedExtractedData).length) {
        throw new Error("AI OCR returned no fields. Please upload a clearer document and try again.");
      }

      // Step 3: Done
      setExtractionStep(3);
      toast.success("Data extracted successfully! Review the fields below.");
      setExtractedData({ ...normalizedExtractedData, _policyId: newPolicy.id });

      setTimeout(() => {
        setUploadExtractOpen(false);
        setReviewEditMode(true);
        setReviewOpen(true);
        prefillFormFromExtracted(normalizedExtractedData, newPolicy.id, {
          clientId: uploadClientId,
          insurerId: uploadInsurerId,
          policyType: uploadPolicyType,
        });
      }, 1000);

    } catch (e: any) {
      if (createdPolicyId) {
        try { await supabase.from("policies").delete().eq("id", createdPolicyId); } catch { /* best-effort cleanup */ }
      }
      const rawMessage = e?.message || "Extraction failed";
      const isAuthError = /missing authorization header|invalid jwt|jwt expired|unauthorized|session has expired/i.test(rawMessage);
      const message = toFriendlyAuthMessage(rawMessage);

      if (isAuthError) {
        setUploadExtractOpen(false);
        toast.error("Your session has expired. Signing you out...", { duration: 3000 });
        setTimeout(() => signOut(), 1500);
        return;
      }

      toast.error(message);
      setUploadError(message);
      setExtractionStep(0);
    } finally {
      setUploading(false);
    }
  };

  const [reviewFormData, setReviewFormData] = useState<any>({});

  const prefillFormFromExtracted = (
    data: any,
    policyId: string,
    defaults?: { clientId?: string; insurerId?: string; policyType?: string }
  ) => {
    const pd = data?.policyDetails || {};
    const vd = data?.vehicleDetails || {};
    const pr = data?.premiumDetails || {};
    const cd = data?.clientDetails || {};
    const id = data?.insurerDetails || {};
    const bd = data?.branchDetails || {};
    const ad = data?.agentDetails || {};
    const an = data?.additionalNotes || {};

    setReviewFormData({
      _policyId: policyId,
      // Policy Info
      policy_number: pd.policyNumber || "",
      policy_type:
        resolveExtractedPolicyType(pd.policyType) ||
        resolveExtractedPolicyType(pd.coverType) ||
        resolveExtractedPolicyType(defaults?.policyType) ||
        POLICY_TYPES[0].id,
      start_date: toDateInputValue(pd.periodFrom || pd.insuranceStartDate || ""),
      end_date: toDateInputValue(pd.periodTo || pd.insuranceEndDate || ""),
      invoice_number: pd.invoiceNumber || "",
      invoice_date: pd.invoiceDate || "",
      customer_id: pd.customerId || "",
      gstin: pd.gstIn || "",
      cover_type: pd.coverType || "",
      // Vehicle
      manufacturer: vd.manufacturer || "",
      model: vd.model || "",
      variant: vd.variant || "",
      registration_number: vd.registrationNumber || "",
      engine_number: vd.engineNumber || "",
      chassis_number: vd.chassisNumber || "",
      fuel_type: vd.fuelType || "",
      seating_capacity: vd.seatingCapacity || "",
      cubic_capacity: vd.cubicCapacity || "",
      body_type: vd.bodyType || "",
      odometer_reading: vd.odometerReading || "",
      // Premium — uses MongoDB schema field names (gst, ncb, others)
      basic_od: pr.ownDamage?.basicOD || "",
      addon_zero_dep: pr.ownDamage?.addOnZeroDep || "",
      addon_consumables: pr.ownDamage?.addOnConsumables || "",
      addon_others: pr.ownDamage?.others || "",
      od_total: pr.ownDamage?.total || "",
      basic_tp: pr.liability?.basicTP || "",
      pa_cover_owner: pr.liability?.paCoverOwnerDriver || "",
      ll_paid_driver: pr.liability?.llForPaidDriver || "",
      ll_employees: pr.liability?.llEmployees || "",
      other_liability: pr.liability?.otherLiability || "",
      tp_total: pr.liability?.total || "",
      net_premium: pr.netPremium || "",
      gst_amount: pr.gst || "",
      final_premium: pr.finalPremium || "",
      compulsory_deductible: pr.compulsoryDeductible || "",
      voluntary_deductible: pr.voluntaryDeductible || "",
      ncb_percentage: pr.ncb || "",
      // Client
      client_name: cd.name || "",
      client_address: cd.address || "",
      client_email: cd.email || "",
      client_phone: cd.phone || "",
      client_gstin: cd.gstIn || "",
      nominee_name: cd.nominee?.name || "",
      nominee_relationship: cd.nominee?.relationship || "",
      // Insurer & Branch (separated in new schema)
      insurer_name: id.name || "",
      insurer_branch: bd.address || "",
      insurer_helpline: bd.helpline || "",
      // Agent
      agent_name: ad.name || "",
      agent_code: ad.code || "",
      agent_contact: ad.contact || "",
      // Additional Notes
      limitations: an.limitationsLiability || "",
      qr_code_link: data?.qrCodeLink || "",
      // Previous policy
      prev_insurer: pd.previousPolicy?.insurer || "",
      prev_policy_number: pd.previousPolicy?.policyNumber || "",
      prev_valid_from: toDateInputValue(pd.previousPolicy?.validFrom || ""),
      prev_valid_to: toDateInputValue(pd.previousPolicy?.validTo || ""),
      // Payment
      payment_mode: pd.paymentDetails?.mode || "",
      // Dropdowns
      client_id: defaults?.clientId || "",
      insurer_id: defaults?.insurerId || "",
    });
  };

  const parseNumber = (value: any): number | null => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const autoCreateCommission = async (policyId: string, intermediaryId: string, insurerId: string | null, premiumAmount: number) => {
    if (!insurerId || premiumAmount <= 0) return;
    try {
      // Look up the intermediary's commission rate for this insurer
      const { data: assoc } = await supabase
        .from("intermediary_insurers")
        .select("commission_rate")
        .eq("intermediary_id", intermediaryId)
        .eq("insurer_id", insurerId)
        .single();
      if (!assoc || !assoc.commission_rate) return;
      const rate = Number(assoc.commission_rate);
      const amount = (premiumAmount * rate) / 100;
      await supabase.from("commissions").insert({
        intermediary_id: intermediaryId,
        policy_id: policyId,
        insurer_id: insurerId,
        premium_amount: premiumAmount,
        commission_rate: rate,
        commission_amount: amount,
        status: "pending" as const,
      });
    } catch {
      // Non-critical — commission can be added manually later
    }
  };

  const buildReviewedOcrData = (data: any) => ({
    policyDetails: {
      policyNumber: data.policy_number || "",
      policyType: data.policy_type || "",
      periodFrom: data.start_date || "",
      periodTo: data.end_date || "",
      invoiceNumber: data.invoice_number || "",
      invoiceDate: data.invoice_date || "",
      customerId: data.customer_id || "",
      gstIn: data.gstin || "",
      coverType: data.cover_type || "",
      previousPolicy: {
        insurer: data.prev_insurer || "",
        policyNumber: data.prev_policy_number || "",
        validFrom: data.prev_valid_from || "",
        validTo: data.prev_valid_to || "",
      },
      paymentDetails: {
        mode: data.payment_mode || "",
      },
    },
    vehicleDetails: {
      manufacturer: data.manufacturer || "",
      model: data.model || "",
      variant: data.variant || "",
      registrationNumber: data.registration_number || "",
      engineNumber: data.engine_number || "",
      chassisNumber: data.chassis_number || "",
      fuelType: data.fuel_type || "",
      seatingCapacity: parseNumber(data.seating_capacity),
      cubicCapacity: parseNumber(data.cubic_capacity),
      bodyType: data.body_type || "",
      yearOfManufacture: parseNumber(data.year_of_manufacture),
    },
    premiumDetails: {
      ownDamage: {
        basicOD: parseNumber(data.basic_od),
        addOnZeroDep: parseNumber(data.addon_zero_dep),
        addOnConsumables: parseNumber(data.addon_consumables),
        addOnRSA: parseNumber(data.addon_rsa),
        addOnEngineProtect: parseNumber(data.addon_engine_protect),
        addOnNCBProtect: parseNumber(data.addon_ncb_protect),
        total: parseNumber(data.od_total),
      },
      liability: {
        basicTP: parseNumber(data.basic_tp),
        paCoverOwnerDriver: parseNumber(data.pa_cover_owner),
        llForPaidDriver: parseNumber(data.ll_paid_driver),
        total: parseNumber(data.tp_total),
      },
      netPremium: parseNumber(data.net_premium),
      gstAmount: parseNumber(data.gst_amount),
      finalPremium: parseNumber(data.final_premium),
      ncbPercentage: parseNumber(data.ncb_percentage),
      compulsoryDeductible: parseNumber(data.compulsory_deductible),
      voluntaryDeductible: parseNumber(data.voluntary_deductible),
    },
    clientDetails: {
      name: data.client_name || "",
      address: data.client_address || "",
      email: data.client_email || "",
      phone: data.client_phone || "",
      gstIn: data.client_gstin || "",
      nominee: {
        name: data.nominee_name || "",
        relationship: data.nominee_relationship || "",
      },
    },
    insurerDetails: {
      name: data.insurer_name || "",
      branchAddress: data.insurer_branch || "",
      helplineNumber: data.insurer_helpline || "",
    },
    agentDetails: {
      name: data.agent_name || "",
      code: data.agent_code || "",
      contact: data.agent_contact || "",
    },
    additionalInfo: {
      hypothecation: data.hypothecation || "",
      limitationsLiability: data.limitations || "",
    },
  });

  const handleSaveExtracted = async () => {
    if (!reviewFormData._policyId) return;
    if (!reviewFormData.client_id) {
      toast.error("Please select a client"); return;
    }
    setSaving(true);
    try {
      const premiumAmount = Number(reviewFormData.final_premium) || Number(reviewFormData.net_premium) || 0;
      const insurerId = reviewFormData.insurer_id || null;

      const { data: savedPolicy, error } = await supabase.from("policies").update({
        policy_number: reviewFormData.policy_number || "N/A",
        client_id: reviewFormData.client_id,
        insurer_id: insurerId,
        policy_type: reviewFormData.policy_type || "motor",
        premium_amount: premiumAmount,
        coverage_amount: null,
        start_date: reviewFormData.start_date || new Date().toISOString().split("T")[0],
        end_date: reviewFormData.end_date || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        status: "active" as const,
        ocr_extracted_data: buildReviewedOcrData(reviewFormData),
      }).eq("id", reviewFormData._policyId).select("*, clients(full_name), insurers(name)").single();

      if (error) throw error;

      // Auto-create commission record
      if (savedPolicy) {
        await autoCreateCommission(savedPolicy.id, savedPolicy.intermediary_id, insurerId, premiumAmount);
        // Show success modal
        setSuccessPolicy(savedPolicy as PolicyWithRelations);
        setSuccessModalOpen(true);
      }

      setReviewOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleExtractOcr = async (policy: PolicyWithRelations) => {
    if (!policy.original_document_url) { toast.error("No document uploaded"); return; }
    toast.info("Extracting data from document...");
    try {
      const documentRef = policy.original_document_url;
      const isLegacyUrl = /^https?:\/\//i.test(documentRef);
      const { data, error } = await invokeExtractPolicyData(
        isLegacyUrl
          ? { policyId: policy.id, documentUrl: documentRef }
          : { policyId: policy.id, documentPath: documentRef }
      );
      if (error) {
        const detail = await getFunctionErrorMessage(error, "OCR extraction failed");
        throw new Error(detail);
      }

      const normalizedExtractedData = normalizeExtractedData(data);
      if (!Object.keys(normalizedExtractedData).length) {
        throw new Error("AI OCR returned no fields. Please upload a clearer document and try again.");
      }

      toast.success("Data extracted successfully");
      fetchData();
    } catch (e: any) { toast.error(toFriendlyAuthMessage(e.message || "OCR extraction failed")); }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const openSendQuotation = (p: PolicyWithRelations) => {
    setSendingPolicy(p);
    setSendPaymentLink("");
    setSendWhatsApp(false);
    setSendEmail(true);
    setSendQuotationOpen(true);
  };

  const handleSendQuotation = async () => {
    if (!sendingPolicy || !profileId) return;
    if (!sendWhatsApp && !sendEmail) {
      toast.error("Please select at least one channel (WhatsApp or Email)");
      return;
    }
    setSendingQuotation(true);
    try {
      const channels: string[] = [];
      if (sendWhatsApp) channels.push("whatsapp");
      if (sendEmail) channels.push("email");

      // Create quotation record
      const { data: quotation, error: qErr } = await supabase
        .from("quotations")
        .insert({
          client_id: sendingPolicy.client_id,
          policy_id: sendingPolicy.id,
          amount: sendingPolicy.premium_amount || null,
          sent_via: channels.join(","),
          payment_status: "pending" as const,
          intermediary_id: profileId,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // Invoke send-quotation edge function if email channel selected
      if (sendEmail && quotation) {
        const { error: fnErr } = await supabase.functions.invoke("send-quotation", {
          body: { quotationId: quotation.id },
        });
        if (fnErr) toast.warning("Quotation created but email delivery failed");
      }

      setSendQuotationOpen(false);
      toast.success("Quotation sent successfully", {
        description: `Sent via ${channels.join(" & ")} for ${sendingPolicy.policy_number}`,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to send quotation");
    } finally {
      setSendingQuotation(false);
    }
  };

  const renderField = (label: string, value: any) => {
    if (!value && value !== 0) return null;
    return (
      <div>
        <Label className="text-muted-foreground text-xs">{label}</Label>
        <p className="text-sm font-medium">{typeof value === "number" ? formatCurrency(value) : String(value)}</p>
      </div>
    );
  };

  const renderOcrView = (data: any) => {
    if (!data) return null;
    const pd = data.policyDetails || {};
    const vd = data.vehicleDetails || {};
    const pr = data.premiumDetails || {};
    const cd = data.clientDetails || {};
    const id = data.insurerDetails || {};
    const ad = data.agentDetails || {};

    return (
      <Tabs defaultValue="policy" className="w-full">
        <TabsList className="grid w-full grid-cols-5 text-xs">
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
          <TabsTrigger value="client">Client</TabsTrigger>
          <TabsTrigger value="more">More</TabsTrigger>
        </TabsList>
        <TabsContent value="policy" className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {renderField("Policy Number", pd.policyNumber)}
            {renderField("Policy Type", pd.policyType || pd.coverType)}
            {renderField("Period From", pd.periodFrom)}
            {renderField("Period To", pd.periodTo)}
            {renderField("Invoice No", pd.invoiceNumber)}
            {renderField("Customer ID", pd.customerId)}
            {renderField("GSTIN", pd.gstIn)}
          </div>
          {pd.previousPolicy && (pd.previousPolicy.insurer || pd.previousPolicy.policyNumber) && (
            <Card className="mt-2">
              <CardHeader className="py-2 px-3"><CardTitle className="text-xs text-muted-foreground">Previous Policy</CardTitle></CardHeader>
              <CardContent className="px-3 pb-2 grid grid-cols-2 gap-2">
                {renderField("Insurer", pd.previousPolicy.insurer)}
                {renderField("Policy No", pd.previousPolicy.policyNumber)}
                {renderField("Valid From", pd.previousPolicy.validFrom)}
                {renderField("Valid To", pd.previousPolicy.validTo)}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="vehicle" className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {renderField("Manufacturer", vd.manufacturer)}
            {renderField("Model", vd.model)}
            {renderField("Variant", vd.variant)}
            {renderField("Registration", vd.registrationNumber)}
            {renderField("Engine No", vd.engineNumber)}
            {renderField("Chassis No", vd.chassisNumber)}
            {renderField("Fuel Type", vd.fuelType)}
            {renderField("Seating", vd.seatingCapacity)}
            {renderField("CC", vd.cubicCapacity)}
            {renderField("Body Type", vd.bodyType)}
            {renderField("Year", vd.yearOfManufacture)}
          </div>
        </TabsContent>
        <TabsContent value="premium" className="space-y-3 mt-3">
          {pr.ownDamage && (
            <Card>
              <CardHeader className="py-2 px-3"><CardTitle className="text-xs text-muted-foreground">Own Damage</CardTitle></CardHeader>
              <CardContent className="px-3 pb-2 grid grid-cols-2 gap-2">
                {renderField("Basic OD", pr.ownDamage.basicOD)}
                {renderField("Zero Dep", pr.ownDamage.addOnZeroDep)}
                {renderField("Consumables", pr.ownDamage.addOnConsumables)}
                {renderField("RSA", pr.ownDamage.addOnRSA)}
                {renderField("Engine Protect", pr.ownDamage.addOnEngineProtect)}
                {renderField("NCB Protect", pr.ownDamage.addOnNCBProtect)}
                {renderField("OD Total", pr.ownDamage.total)}
              </CardContent>
            </Card>
          )}
          {pr.liability && (
            <Card>
              <CardHeader className="py-2 px-3"><CardTitle className="text-xs text-muted-foreground">Liability</CardTitle></CardHeader>
              <CardContent className="px-3 pb-2 grid grid-cols-2 gap-2">
                {renderField("Basic TP", pr.liability.basicTP)}
                {renderField("PA Cover Owner", pr.liability.paCoverOwnerDriver)}
                {renderField("LL Paid Driver", pr.liability.llForPaidDriver)}
                {renderField("TP Total", pr.liability.total)}
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            {renderField("Net Premium", pr.netPremium)}
            {renderField("GST", pr.gstAmount)}
            {renderField("Final Premium", pr.finalPremium)}
            {renderField("NCB %", pr.ncbPercentage)}
            {renderField("Compulsory Deductible", pr.compulsoryDeductible)}
            {renderField("Voluntary Deductible", pr.voluntaryDeductible)}
          </div>
        </TabsContent>
        <TabsContent value="client" className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {renderField("Name", cd.name)}
            {renderField("Address", cd.address)}
            {renderField("Email", cd.email)}
            {renderField("Phone", cd.phone)}
            {renderField("GSTIN", cd.gstIn)}
            {renderField("PAN", cd.panNumber)}
          </div>
          {cd.nominee && cd.nominee.name && (
            <Card className="mt-2">
              <CardHeader className="py-2 px-3"><CardTitle className="text-xs text-muted-foreground">Nominee</CardTitle></CardHeader>
              <CardContent className="px-3 pb-2 grid grid-cols-3 gap-2">
                {renderField("Name", cd.nominee.name)}
                {renderField("Relationship", cd.nominee.relationship)}
                {renderField("Age", cd.nominee.age)}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="more" className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {renderField("Insurer", id.name)}
            {renderField("Branch", id.branchAddress)}
            {renderField("Helpline", id.helplineNumber)}
            {renderField("Intermediary Name", ad.name)}
            {renderField("Intermediary Code", ad.code)}
            {renderField("Intermediary Contact", ad.contact)}
          </div>
        </TabsContent>
      </Tabs>
    );
  };

  useSetPageTitle("Policies");

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
          <ResponsiveSearchBar
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Search by policy # or client..."
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {existingPolicyTypes.length > 0 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {groupedPolicyTypes.map(({ category, items }) => (
                    <div key={category}>
                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 pointer-events-none mb-1">
                        {category}
                      </div>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ResponsiveSearchBar>
          <div className="flex w-full lg:w-auto flex-wrap items-center justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={() => {
                setUploadFile(null);
                setUploadError(null);
                setExtractedData(null);
                setExtractionStep(0);
                setReviewEditMode(true);
                setUploadIntermediaryId("");
                setUploadExtractOpen(true);
              }}>
              <Upload className="h-4 w-4" /> Upload & Extract
            </Button>
            <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> New Policy</Button>
          </div>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Policy #</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Client</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Type</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Insurer</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Premium</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Expiry</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredPolicies.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No policies found</TableCell></TableRow>
                ) : (
                  filteredPolicies.map((p) => (
                    <TableRow key={p.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-mono text-sm font-medium">{p.policy_number}</TableCell>
                      <TableCell>{p.clients?.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{p.policy_type}</TableCell>
                      <TableCell className="text-muted-foreground">{p.insurers?.name || "—"}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(p.premium_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.end_date}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{p.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingPolicy(p); setViewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Send Quotation" onClick={() => openSendQuotation(p)}><Send className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingPolicy(p); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Upload & Extract Dialog */}
      <Dialog open={uploadExtractOpen} onOpenChange={(open) => { if (!open && extractionStep > 0 && extractionStep < 3) return; setUploadExtractOpen(open); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto dashboard-scrollbarless">
          <DialogHeader>
            <DialogTitle>Upload Policy & Extract Data</DialogTitle>
            <DialogDescription>Select details, upload a policy document, then review and edit extracted fields</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {[
              { key: "upload", label: "Upload" },
              { key: "extract", label: "Extract" },
              { key: "review", label: "Review" },
            ].map((item, index) => {
              const activeIndex = extractionStep === 0 ? 0 : extractionStep < 3 ? 1 : 2;
              return (
                <div key={item.key} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${index <= activeIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {index < activeIndex ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground">{item.label}</span>
                  {index < 2 && <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50" />}
                </div>
              );
            })}
          </div>
          {extractionStep === 0 ? (
            <div className="space-y-4 py-4">
              {uploadError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {uploadError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select value={uploadClientId} onValueChange={setUploadClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Insurer (optional)</Label>
                  <Select value={uploadInsurerId || "none"} onValueChange={(value) => setUploadInsurerId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Select value={uploadPolicyType} onValueChange={setUploadPolicyType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groupedPolicyTypes.map(({ category, items }) => (
                        <div key={category}>
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 pointer-events-none mb-1">
                            {category}
                          </div>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Issued By (Intermediary) *</Label>
                    <Select value={uploadIntermediaryId} onValueChange={setUploadIntermediaryId}>
                      <SelectTrigger><SelectValue placeholder="Select intermediary" /></SelectTrigger>
                      <SelectContent>
                        {intermediaries.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.full_name}{i.intermediary_code ? ` (${i.intermediary_code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Drag and drop or click to select a policy file</p>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  className="max-w-xs mx-auto"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile && <p className="text-sm font-medium mt-2 text-primary">{uploadFile.name}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadExtractOpen(false)}>Cancel</Button>
                <Button onClick={handleUploadAndExtract} disabled={!uploadFile || uploading} className="gap-2">
                  <Upload className="h-4 w-4" /> {uploading ? "Extracting..." : "Upload & Extract"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <PolicyExtractionLoader currentStep={extractionStep} />
          )}
        </DialogContent>
      </Dialog>

      {/* Review Extracted Data Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto dashboard-scrollbarless">
          <DialogHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <DialogTitle>Review Extracted Data</DialogTitle>
              <DialogDescription>Verify and correct extracted information before saving policy</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setReviewEditMode((prev) => !prev)}>
              {reviewEditMode ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done Editing
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Fields
                </>
              )}
            </Button>
          </DialogHeader>
          <Tabs defaultValue="policy" className="w-full">
            <TabsList className="grid w-full grid-cols-5 text-xs">
              <TabsTrigger value="policy">Policy Info</TabsTrigger>
              <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="client">Client & Insurer</TabsTrigger>
              <TabsTrigger value="additional">Additional</TabsTrigger>
            </TabsList>

            <TabsContent value="policy" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input disabled={!reviewEditMode} value={reviewFormData.policy_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, policy_number: e.target.value })} />
                </div>
                 <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Select 
                    disabled={!reviewEditMode} 
                    value={reviewFormData.policy_type || ""} 
                    onValueChange={(v) => setReviewFormData({ ...reviewFormData, policy_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groupedPolicyTypes.map(({ category, items }) => (
                        <div key={category}>
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 pointer-events-none mb-1">
                            {category}
                          </div>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input disabled={!reviewEditMode} type="date" value={reviewFormData.start_date || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input disabled={!reviewEditMode} type="date" value={reviewFormData.end_date || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input disabled={!reviewEditMode} value={reviewFormData.invoice_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, invoice_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input disabled={!reviewEditMode} value={reviewFormData.customer_id || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, customer_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input disabled={!reviewEditMode} value={reviewFormData.gstin || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, gstin: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cover Type</Label>
                  <Input disabled={!reviewEditMode} value={reviewFormData.cover_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, cover_type: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Manufacturer</Label><Input disabled={!reviewEditMode} value={reviewFormData.manufacturer || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, manufacturer: e.target.value })} /></div>
                <div className="space-y-2"><Label>Model</Label><Input disabled={!reviewEditMode} value={reviewFormData.model || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, model: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Variant</Label><Input disabled={!reviewEditMode} value={reviewFormData.variant || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, variant: e.target.value })} /></div>
                <div className="space-y-2"><Label>Registration Number</Label><Input disabled={!reviewEditMode} value={reviewFormData.registration_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, registration_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Engine Number</Label><Input disabled={!reviewEditMode} value={reviewFormData.engine_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, engine_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Chassis Number</Label><Input disabled={!reviewEditMode} value={reviewFormData.chassis_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, chassis_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Fuel Type</Label><Input disabled={!reviewEditMode} value={reviewFormData.fuel_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, fuel_type: e.target.value })} /></div>
                <div className="space-y-2"><Label>Seating Capacity</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.seating_capacity || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, seating_capacity: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cubic Capacity</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.cubic_capacity || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, cubic_capacity: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Body Type</Label><Input disabled={!reviewEditMode} value={reviewFormData.body_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, body_type: e.target.value })} /></div>
                <div className="space-y-2"><Label>Year of Manufacture</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.year_of_manufacture || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, year_of_manufacture: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="premium" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Own Damage</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Basic OD</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.basic_od || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, basic_od: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Zero Dep</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.addon_zero_dep || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_zero_dep: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Consumables</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.addon_consumables || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_consumables: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">RSA</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.addon_rsa || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_rsa: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Engine Protect</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.addon_engine_protect || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_engine_protect: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">OD Total</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.od_total || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, od_total: e.target.value })} /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Liability</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Basic TP</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.basic_tp || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, basic_tp: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">PA Cover Owner</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.pa_cover_owner || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, pa_cover_owner: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">LL Paid Driver</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.ll_paid_driver || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, ll_paid_driver: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">TP Total</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.tp_total || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, tp_total: e.target.value })} /></div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Net Premium</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.net_premium || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, net_premium: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">GST</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.gst_amount || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, gst_amount: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold">Final Premium</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.final_premium || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, final_premium: e.target.value })} className="border-primary" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">NCB %</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.ncb_percentage || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, ncb_percentage: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Compulsory Deductible</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.compulsory_deductible || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, compulsory_deductible: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Voluntary Deductible</Label><Input disabled={!reviewEditMode} type="number" value={reviewFormData.voluntary_deductible || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, voluntary_deductible: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="client" className="space-y-4 mt-3">
              <div className="space-y-2">
                <Label>Select Client *</Label>
                <Select value={reviewFormData.client_id || ""} onValueChange={(v) => setReviewFormData({ ...reviewFormData, client_id: v })} disabled={!reviewEditMode}>
                  <SelectTrigger><SelectValue placeholder="Match to existing client" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
                {reviewFormData.client_name && <p className="text-xs text-muted-foreground">Extracted: {reviewFormData.client_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Client Name</Label><Input disabled={!reviewEditMode} value={reviewFormData.client_name || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, client_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Client Address</Label><Input disabled={!reviewEditMode} value={reviewFormData.client_address || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, client_address: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Client Phone</Label><Input disabled={!reviewEditMode} value={reviewFormData.client_phone || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, client_phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Client Email</Label><Input disabled={!reviewEditMode} value={reviewFormData.client_email || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, client_email: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Select Insurer</Label>
                <Select value={reviewFormData.insurer_id || ""} onValueChange={(v) => setReviewFormData({ ...reviewFormData, insurer_id: v })} disabled={!reviewEditMode}>
                  <SelectTrigger><SelectValue placeholder="Match to existing insurer" /></SelectTrigger>
                  <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                {reviewFormData.insurer_name && <p className="text-xs text-muted-foreground">Extracted: {reviewFormData.insurer_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Insurer Name</Label><Input disabled={!reviewEditMode} value={reviewFormData.insurer_name || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, insurer_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Insurer Branch</Label><Input disabled={!reviewEditMode} value={reviewFormData.insurer_branch || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, insurer_branch: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nominee Name</Label><Input disabled={!reviewEditMode} value={reviewFormData.nominee_name || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, nominee_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nominee Relationship</Label><Input disabled={!reviewEditMode} value={reviewFormData.nominee_relationship || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, nominee_relationship: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Previous Policy</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Insurer</Label><Input disabled={!reviewEditMode} value={reviewFormData.prev_insurer || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, prev_insurer: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Policy No</Label><Input disabled={!reviewEditMode} value={reviewFormData.prev_policy_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, prev_policy_number: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Valid From</Label><Input disabled={!reviewEditMode} type="date" value={reviewFormData.prev_valid_from || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, prev_valid_from: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Valid To</Label><Input disabled={!reviewEditMode} type="date" value={reviewFormData.prev_valid_to || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, prev_valid_to: e.target.value })} /></div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Intermediary Name</Label><Input disabled={!reviewEditMode} value={reviewFormData.agent_name || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, agent_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Intermediary Code</Label><Input disabled={!reviewEditMode} value={reviewFormData.agent_code || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, agent_code: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Intermediary Contact</Label><Input disabled={!reviewEditMode} value={reviewFormData.agent_contact || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, agent_contact: e.target.value })} /></div>
                <div className="space-y-2"><Label>Payment Mode</Label><Input disabled={!reviewEditMode} value={reviewFormData.payment_mode || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, payment_mode: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Hypothecation</Label><Input disabled={!reviewEditMode} value={reviewFormData.hypothecation || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, hypothecation: e.target.value })} /></div>
                <div className="space-y-2"><Label>Limitations</Label><Input disabled={!reviewEditMode} value={reviewFormData.limitations || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, limitations: e.target.value })} /></div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveExtracted} disabled={saving}>{saving ? "Saving..." : "Save Policy"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "New Policy"}</DialogTitle>
            <DialogDescription>{editingPolicy ? "Update policy details" : "Create a new insurance policy"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Policy Number *</Label><Input placeholder="POL-2024-001" value={formData.policy_number} onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Policy Type</Label>
                <Select value={formData.policy_type} onValueChange={(v) => setFormData({ ...formData, policy_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groupedPolicyTypes.map(({ category, items }) => (
                      <div key={category}>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/30 pointer-events-none mb-1">
                          {category}
                        </div>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Insurer</Label>
                <Select value={formData.insurer_id} onValueChange={(v) => setFormData({ ...formData, insurer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
                  <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Premium Amount</Label><Input type="number" placeholder="0" value={formData.premium_amount} onChange={(e) => setFormData({ ...formData, premium_amount: e.target.value })} /></div>
              <div className="space-y-2"><Label>Coverage Amount</Label><Input type="number" placeholder="0" value={formData.coverage_amount} onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} /></div>
            </div>
            {editingPolicy && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem><SelectItem value="expiring">Expiring</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Upload Document</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>{saving ? "Saving..." : editingPolicy ? "Update" : "Create Policy"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Policy Details</DialogTitle>
            <DialogDescription>Viewing policy information</DialogDescription>
          </DialogHeader>
          {viewingPolicy && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Policy Number</Label><p className="font-mono font-medium">{viewingPolicy.policy_number}</p></div>
                <div><Label className="text-muted-foreground text-xs">Status</Label><Badge variant="outline" className={statusColor[viewingPolicy.status]}>{viewingPolicy.status}</Badge></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Client</Label><p>{viewingPolicy.clients?.full_name || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Insurer</Label><p>{viewingPolicy.insurers?.name || "—"}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-muted-foreground text-xs">Type</Label><p className="capitalize">{viewingPolicy.policy_type}</p></div>
                <div><Label className="text-muted-foreground text-xs">Premium</Label><p className="font-medium">{formatCurrency(viewingPolicy.premium_amount)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Coverage</Label><p>{viewingPolicy.coverage_amount ? formatCurrency(viewingPolicy.coverage_amount) : "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Start Date</Label><p>{viewingPolicy.start_date}</p></div>
                <div><Label className="text-muted-foreground text-xs">End Date</Label><p>{viewingPolicy.end_date}</p></div>
              </div>

              {viewingPolicy.original_document_url && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => handleExtractOcr(viewingPolicy)}>
                    <FileDown className="h-3 w-3" /> Re-Extract Data (OCR)
                  </Button>
                </div>
              )}

              {viewingPolicy.ocr_extracted_data && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Extracted Policy Data</Label>
                  {renderOcrView(viewingPolicy.ocr_extracted_data)}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                        <ChevronDown className="h-3 w-3" /> Raw Data
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40">{JSON.stringify(viewingPolicy.ocr_extracted_data, null, 2)}</pre>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Quotation Modal */}
      <Dialog open={sendQuotationOpen} onOpenChange={setSendQuotationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Quotation</DialogTitle>
            <DialogDescription>
              Send the quotation to the client via WhatsApp or Email.
              {sendingPolicy && (
                <span className="block mt-1 text-foreground font-medium">
                  Policy: {sendingPolicy.policy_number} — {formatCurrency(sendingPolicy.premium_amount)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Link (optional)</Label>
              <Input
                placeholder="https://razorpay.com/pay/..."
                value={sendPaymentLink}
                onChange={(e) => setSendPaymentLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the payment link from Razorpay, PhonePe, etc.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Send via</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    id="sq-whatsapp"
                    checked={sendWhatsApp}
                    disabled
                    onCheckedChange={(c) => setSendWhatsApp(!!c)}
                  />
                  <label htmlFor="sq-whatsapp" className="text-sm cursor-not-allowed">WhatsApp</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sq-email"
                    checked={sendEmail}
                    onCheckedChange={(c) => setSendEmail(!!c)}
                  />
                  <label htmlFor="sq-email" className="text-sm cursor-pointer">Email</label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendQuotationOpen(false)} disabled={sendingQuotation}>
              Cancel
            </Button>
            <Button
              onClick={handleSendQuotation}
              disabled={sendingQuotation || (!sendWhatsApp && !sendEmail)}
            >
              {sendingQuotation ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send Quotation</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Save Success Modal */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Policy Saved Successfully
            </DialogTitle>
            <DialogDescription>Your policy has been saved. What would you like to do next?</DialogDescription>
          </DialogHeader>
          {successPolicy && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Policy #</span>
                    <p className="font-mono font-medium">{successPolicy.policy_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Premium</span>
                    <p className="font-medium">{formatCurrency(successPolicy.premium_amount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Client</span>
                    <p>{successPolicy.clients?.full_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Insurer</span>
                    <p>{successPolicy.insurers?.name || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => {
              setSuccessModalOpen(false);
              if (successPolicy) {
                setViewingPolicy(successPolicy);
                setViewOpen(true);
              }
            }}>
              <Eye className="h-4 w-4 mr-2" />
              View Policy
            </Button>
            <Button onClick={() => {
              setSuccessModalOpen(false);
              if (successPolicy) {
                openSendQuotation(successPolicy);
              }
            }}>
              <Send className="h-4 w-4 mr-2" />
              Send Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete policy "{deletingPolicy?.policy_number}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Policies;
