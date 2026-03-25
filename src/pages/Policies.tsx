import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, Pencil, Trash2, Eye, Upload, FileDown, ChevronDown } from "lucide-react";
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

const Policies = () => {
  const navigate = useNavigate();
  const { profileId, role } = useAuth();
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

  // Upload & Extract state
  const [extractionStep, setExtractionStep] = useState(0);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    policy_number: "", client_id: "", insurer_id: "", policy_type: "general",
    premium_amount: "", coverage_amount: "", start_date: "", end_date: "",
    status: "active" as string,
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [polRes, cliRes, insRes] = await Promise.all([
      supabase.from("policies").select("*, clients(full_name), insurers(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("insurers").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (polRes.data) setPolicies(polRes.data as PolicyWithRelations[]);
    if (cliRes.data) setClients(cliRes.data);
    if (insRes.data) setInsurers(insRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const policyTypes = useMemo(() => {
    const types = new Set(policies.map((p) => p.policy_type));
    return Array.from(types).sort();
  }, [policies]);

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

  const uploadDocument = async (policyId: string): Promise<string | null> => {
    if (!docFile) return null;
    setUploading(true);
    const ext = docFile.name.split(".").pop();
    const path = `${policyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("policy-documents").upload(path, docFile);
    setUploading(false);
    if (error) { toast.error("Document upload failed"); return null; }
    return path;
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
        const docUrl = await uploadDocument(editingPolicy.id);
        const updatePayload = docUrl ? { ...payload, original_document_url: docUrl } : payload;
        const { error } = await supabase.from("policies").update(updatePayload).eq("id", editingPolicy.id);
        if (error) throw error;
        toast.success("Policy updated successfully");
      } else {
        const { data, error } = await supabase.from("policies").insert({ ...payload, intermediary_id: profileId }).select().single();
        if (error) throw error;
        if (docFile && data) {
          const docUrl = await uploadDocument(data.id);
          if (docUrl) await supabase.from("policies").update({ original_document_url: docUrl }).eq("id", data.id);
        }
        toast.success("Policy created successfully", {
          action: {
            label: "Send Quotation",
            onClick: () => navigate(`/quotations?policy_id=${data.id}&client_id=${data.client_id}&amount=${data.premium_amount}`),
          },
        });
      }
      setFormOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    const { error } = await supabase.from("policies").delete().eq("id", deletingPolicy.id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Policy deleted"); fetchData(); }
    setDeleteOpen(false);
    setDeletingPolicy(null);
  };

  // Upload & Extract flow
  const handleUploadAndExtract = async () => {
    if (!uploadFile || !profileId) return;
    setExtractionStep(0);
    setExtractedData(null);

    try {
      // Step 0: Uploading
      const ext = uploadFile.name.split(".").pop();
      const tempId = crypto.randomUUID();
      const path = `${tempId}/${Date.now()}.${ext}`;
      
      const { error: uploadErr } = await supabase.storage.from("policy-documents").upload(path, uploadFile);
      if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);
      toast.info("Document uploaded, starting AI analysis...");

      // Step 1: AI analyzing
      setExtractionStep(1);

      // Create a placeholder policy to store extracted data
      const { data: newPolicy, error: createErr } = await supabase.from("policies").insert({
        policy_number: "EXTRACTING-" + Date.now(),
        client_id: clients[0]?.id || profileId, // temp placeholder
        intermediary_id: profileId,
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        original_document_url: path,
        status: "active" as const,
      }).select().single();

      if (createErr) throw new Error("Failed to create policy record: " + createErr.message);

      // Step 2: Extracting fields
      setExtractionStep(2);
      toast.info("AI is extracting policy fields...");

      const { data: extractResult, error: extractErr } = await supabase.functions.invoke("extract-policy-data", {
        body: { policyId: newPolicy.id, documentPath: path },
      });

      if (extractErr) throw new Error("Extraction failed");

      // Step 3: Done
      setExtractionStep(3);
      toast.success("Data extracted successfully! Review the fields below.");
      setExtractedData({ ...extractResult.data, _policyId: newPolicy.id, _documentPath: path });

      setTimeout(() => {
        setUploadExtractOpen(false);
        setReviewOpen(true);
        prefillFormFromExtracted(extractResult.data, newPolicy.id);
      }, 1000);

    } catch (e: any) {
      toast.error(e.message || "Extraction failed");
      setUploadExtractOpen(false);
    }
  };

  const [reviewFormData, setReviewFormData] = useState<any>({});

  const prefillFormFromExtracted = (data: any, policyId: string) => {
    const pd = data?.policyDetails || {};
    const vd = data?.vehicleDetails || {};
    const pr = data?.premiumDetails || {};
    const cd = data?.clientDetails || {};
    const id = data?.insurerDetails || {};
    const ad = data?.agentDetails || {};
    const ai = data?.additionalInfo || {};

    setReviewFormData({
      _policyId: policyId,
      // Policy Info
      policy_number: pd.policyNumber || "",
      policy_type: pd.policyType || pd.coverType || "general",
      start_date: pd.periodFrom || pd.insuranceStartDate || "",
      end_date: pd.periodTo || pd.insuranceEndDate || "",
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
      year_of_manufacture: vd.yearOfManufacture || "",
      // Premium
      basic_od: pr.ownDamage?.basicOD || "",
      addon_zero_dep: pr.ownDamage?.addOnZeroDep || "",
      addon_consumables: pr.ownDamage?.addOnConsumables || "",
      addon_rsa: pr.ownDamage?.addOnRSA || "",
      addon_engine_protect: pr.ownDamage?.addOnEngineProtect || "",
      addon_ncb_protect: pr.ownDamage?.addOnNCBProtect || "",
      od_total: pr.ownDamage?.total || "",
      basic_tp: pr.liability?.basicTP || "",
      pa_cover_owner: pr.liability?.paCoverOwnerDriver || "",
      ll_paid_driver: pr.liability?.llForPaidDriver || "",
      tp_total: pr.liability?.total || "",
      net_premium: pr.netPremium || "",
      gst_amount: pr.gstAmount || "",
      final_premium: pr.finalPremium || "",
      compulsory_deductible: pr.compulsoryDeductible || "",
      voluntary_deductible: pr.voluntaryDeductible || "",
      ncb_percentage: pr.ncbPercentage || "",
      // Client & Insurer
      client_name: cd.name || "",
      client_address: cd.address || "",
      client_email: cd.email || "",
      client_phone: cd.phone || "",
      client_gstin: cd.gstIn || "",
      nominee_name: cd.nominee?.name || "",
      nominee_relationship: cd.nominee?.relationship || "",
      insurer_name: id.name || "",
      insurer_branch: id.branchAddress || "",
      insurer_helpline: id.helplineNumber || "",
      // Agent
      agent_name: ad.name || "",
      agent_code: ad.code || "",
      agent_contact: ad.contact || "",
      // Additional
      hypothecation: ai.hypothecation || "",
      limitations: ai.limitationsLiability || "",
      // Previous policy
      prev_insurer: pd.previousPolicy?.insurer || "",
      prev_policy_number: pd.previousPolicy?.policyNumber || "",
      prev_valid_from: pd.previousPolicy?.validFrom || "",
      prev_valid_to: pd.previousPolicy?.validTo || "",
      // Payment
      payment_mode: pd.paymentDetails?.mode || "",
      // Dropdowns
      client_id: "",
      insurer_id: "",
    });
  };

  const handleSaveExtracted = async () => {
    if (!reviewFormData._policyId) return;
    if (!reviewFormData.client_id) {
      toast.error("Please select a client"); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("policies").update({
        policy_number: reviewFormData.policy_number || "N/A",
        client_id: reviewFormData.client_id,
        insurer_id: reviewFormData.insurer_id || null,
        policy_type: reviewFormData.policy_type || "motor",
        premium_amount: Number(reviewFormData.final_premium) || Number(reviewFormData.net_premium) || 0,
        coverage_amount: null,
        start_date: reviewFormData.start_date || new Date().toISOString().split("T")[0],
        end_date: reviewFormData.end_date || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        status: "active" as const,
      }).eq("id", reviewFormData._policyId);

      if (error) throw error;
      toast.success("Policy saved from extracted data", {
        action: {
          label: "Send Quotation",
          onClick: () => navigate(`/quotations?policy_id=${reviewFormData._policyId}&client_id=${reviewFormData.client_id}&amount=${Number(reviewFormData.final_premium) || Number(reviewFormData.net_premium) || 0}`),
        },
      });
      setReviewOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleExtractOcr = async (policy: PolicyWithRelations) => {
    if (!policy.original_document_url) { toast.error("No document uploaded"); return; }
    toast.info("Extracting data from document...");
    try {
      const { data, error } = await supabase.functions.invoke("extract-policy-data", {
        body: { policyId: policy.id, documentPath: policy.original_document_url },
      });
      if (error) throw error;
      toast.success("Data extracted successfully");
      fetchData();
    } catch (e: any) { toast.error(e.message || "OCR extraction failed"); }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

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
            {renderField("Agent Name", ad.name)}
            {renderField("Agent Code", ad.code)}
          </div>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <DashboardLayout title="Policies">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by policy # or client..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
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
            {policyTypes.length > 1 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {policyTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setUploadFile(null); setExtractionStep(0); setUploadExtractOpen(true); }}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Policy PDF</DialogTitle>
            <DialogDescription>Upload a policy document to automatically extract data using AI</DialogDescription>
          </DialogHeader>
          {extractionStep === 0 ? (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Drag & drop or click to select a PDF</p>
                <Input
                  type="file"
                  accept=".pdf"
                  className="max-w-xs mx-auto"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile && <p className="text-sm font-medium mt-2 text-primary">{uploadFile.name}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadExtractOpen(false)}>Cancel</Button>
                <Button onClick={handleUploadAndExtract} disabled={!uploadFile} className="gap-2">
                  <Upload className="h-4 w-4" /> Upload & Extract
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
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Data</DialogTitle>
            <DialogDescription>Verify and correct the AI-extracted data before saving</DialogDescription>
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
                  <Input value={reviewFormData.policy_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, policy_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Input value={reviewFormData.policy_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, policy_type: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={reviewFormData.start_date || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={reviewFormData.end_date || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input value={reviewFormData.invoice_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, invoice_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input value={reviewFormData.customer_id || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, customer_id: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={reviewFormData.gstin || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, gstin: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cover Type</Label>
                  <Input value={reviewFormData.cover_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, cover_type: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Manufacturer</Label><Input value={reviewFormData.manufacturer || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, manufacturer: e.target.value })} /></div>
                <div className="space-y-2"><Label>Model</Label><Input value={reviewFormData.model || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, model: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Variant</Label><Input value={reviewFormData.variant || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, variant: e.target.value })} /></div>
                <div className="space-y-2"><Label>Registration Number</Label><Input value={reviewFormData.registration_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, registration_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Engine Number</Label><Input value={reviewFormData.engine_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, engine_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Chassis Number</Label><Input value={reviewFormData.chassis_number || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, chassis_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Fuel Type</Label><Input value={reviewFormData.fuel_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, fuel_type: e.target.value })} /></div>
                <div className="space-y-2"><Label>Seating Capacity</Label><Input type="number" value={reviewFormData.seating_capacity || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, seating_capacity: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cubic Capacity</Label><Input type="number" value={reviewFormData.cubic_capacity || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, cubic_capacity: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Body Type</Label><Input value={reviewFormData.body_type || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, body_type: e.target.value })} /></div>
                <div className="space-y-2"><Label>Year of Manufacture</Label><Input type="number" value={reviewFormData.year_of_manufacture || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, year_of_manufacture: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="premium" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Own Damage</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Basic OD</Label><Input type="number" value={reviewFormData.basic_od || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, basic_od: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Zero Dep</Label><Input type="number" value={reviewFormData.addon_zero_dep || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_zero_dep: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Consumables</Label><Input type="number" value={reviewFormData.addon_consumables || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_consumables: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">RSA</Label><Input type="number" value={reviewFormData.addon_rsa || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_rsa: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Engine Protect</Label><Input type="number" value={reviewFormData.addon_engine_protect || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, addon_engine_protect: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">OD Total</Label><Input type="number" value={reviewFormData.od_total || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, od_total: e.target.value })} /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Liability</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Basic TP</Label><Input type="number" value={reviewFormData.basic_tp || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, basic_tp: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">PA Cover Owner</Label><Input type="number" value={reviewFormData.pa_cover_owner || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, pa_cover_owner: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">LL Paid Driver</Label><Input type="number" value={reviewFormData.ll_paid_driver || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, ll_paid_driver: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">TP Total</Label><Input type="number" value={reviewFormData.tp_total || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, tp_total: e.target.value })} /></div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Net Premium</Label><Input type="number" value={reviewFormData.net_premium || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, net_premium: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">GST</Label><Input type="number" value={reviewFormData.gst_amount || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, gst_amount: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold">Final Premium</Label><Input type="number" value={reviewFormData.final_premium || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, final_premium: e.target.value })} className="border-primary" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">NCB %</Label><Input type="number" value={reviewFormData.ncb_percentage || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, ncb_percentage: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Compulsory Deductible</Label><Input type="number" value={reviewFormData.compulsory_deductible || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, compulsory_deductible: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Voluntary Deductible</Label><Input type="number" value={reviewFormData.voluntary_deductible || ""} onChange={(e) => setReviewFormData({ ...reviewFormData, voluntary_deductible: e.target.value })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="client" className="space-y-4 mt-3">
              <div className="space-y-2">
                <Label>Select Client *</Label>
                <Select value={reviewFormData.client_id || ""} onValueChange={(v) => setReviewFormData({ ...reviewFormData, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Match to existing client" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
                {reviewFormData.client_name && <p className="text-xs text-muted-foreground">Extracted: {reviewFormData.client_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Client Address</Label><Input value={reviewFormData.client_address || ""} readOnly className="bg-muted/30" /></div>
                <div className="space-y-2"><Label>Client Phone</Label><Input value={reviewFormData.client_phone || ""} readOnly className="bg-muted/30" /></div>
              </div>
              <div className="space-y-2">
                <Label>Select Insurer</Label>
                <Select value={reviewFormData.insurer_id || ""} onValueChange={(v) => setReviewFormData({ ...reviewFormData, insurer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Match to existing insurer" /></SelectTrigger>
                  <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
                {reviewFormData.insurer_name && <p className="text-xs text-muted-foreground">Extracted: {reviewFormData.insurer_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nominee Name</Label><Input value={reviewFormData.nominee_name || ""} readOnly className="bg-muted/30" /></div>
                <div className="space-y-2"><Label>Nominee Relationship</Label><Input value={reviewFormData.nominee_relationship || ""} readOnly className="bg-muted/30" /></div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Previous Policy</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Insurer</Label><Input value={reviewFormData.prev_insurer || ""} readOnly className="bg-muted/30" /></div>
                  <div className="space-y-1"><Label className="text-xs">Policy No</Label><Input value={reviewFormData.prev_policy_number || ""} readOnly className="bg-muted/30" /></div>
                  <div className="space-y-1"><Label className="text-xs">Valid From</Label><Input value={reviewFormData.prev_valid_from || ""} readOnly className="bg-muted/30" /></div>
                  <div className="space-y-1"><Label className="text-xs">Valid To</Label><Input value={reviewFormData.prev_valid_to || ""} readOnly className="bg-muted/30" /></div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Agent Name</Label><Input value={reviewFormData.agent_name || ""} readOnly className="bg-muted/30" /></div>
                <div className="space-y-2"><Label>Agent Code</Label><Input value={reviewFormData.agent_code || ""} readOnly className="bg-muted/30" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Payment Mode</Label><Input value={reviewFormData.payment_mode || ""} readOnly className="bg-muted/30" /></div>
                <div className="space-y-2"><Label>Hypothecation</Label><Input value={reviewFormData.hypothecation || ""} readOnly className="bg-muted/30" /></div>
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
                    <SelectItem value="general">General</SelectItem><SelectItem value="health">Health</SelectItem>
                    <SelectItem value="motor">Motor</SelectItem><SelectItem value="life">Life</SelectItem>
                    <SelectItem value="property">Property</SelectItem><SelectItem value="travel">Travel</SelectItem>
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
    </DashboardLayout>
  );
};

export default Policies;
