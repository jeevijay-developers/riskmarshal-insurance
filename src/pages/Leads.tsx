import { useState, useEffect, useMemo } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Eye, UserPlus, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type Profile = Tables<"profiles">;

const statusColor: Record<string, string> = {
  new: "bg-info/10 text-info border-info/30",
  contacted: "bg-warning/10 text-warning border-warning/30",
  in_discussion: "bg-primary/10 text-primary border-primary/30",
  converted: "bg-success/10 text-success border-success/30",
  lost: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabel: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  in_discussion: "In Discussion",
  converted: "Converted",
  lost: "Lost",
};

const Leads = () => {
  const { profileId, role } = useAuth();
  const isAdmin = role === "super_admin";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "", email: "", phone: "", source: "website",
    insurance_type_interest: "", message: "", assigned_intermediary_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      isAdmin ? supabase.from("profiles").select("*") : Promise.resolve({ data: [], error: null }),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || l.full_name.toLowerCase().includes(s) || (l.email?.toLowerCase().includes(s)) || (l.phone?.includes(s));
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, searchTerm, statusFilter]);

  const openAdd = () => {
    setEditingLead(null);
    setFormData({ full_name: "", email: "", phone: "", source: "website", insurance_type_interest: "", message: "", assigned_intermediary_id: "" });
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      full_name: lead.full_name,
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "website",
      insurance_type_interest: lead.insurance_type_interest || "",
      message: lead.message || "",
      assigned_intermediary_id: lead.assigned_intermediary_id || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        source: formData.source || null,
        insurance_type_interest: formData.insurance_type_interest.trim() || null,
        message: formData.message.trim() || null,
        assigned_intermediary_id: formData.assigned_intermediary_id || null,
      };
      if (editingLead) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editingLead.id);
        if (error) throw error;
        toast.success("Lead updated");
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
        toast.success("Lead added");
      }
      setFormOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus as Lead["status"] }).eq("id", lead.id);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Status changed to ${statusLabel[newStatus]}`);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deletingLead) return;
    const { error } = await supabase.from("leads").delete().eq("id", deletingLead.id);
    if (error) toast.error("Failed to delete lead");
    else { toast.success("Lead deleted"); fetchData(); }
    setDeleteOpen(false);
    setDeletingLead(null);
  };

  const handleConvert = async () => {
    if (!convertingLead || !profileId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clients").insert({
        full_name: convertingLead.full_name,
        email: convertingLead.email,
        phone: convertingLead.phone,
        intermediary_id: convertingLead.assigned_intermediary_id || profileId,
      });
      if (error) throw error;
      await supabase.from("leads").update({ status: "converted" as Lead["status"] }).eq("id", convertingLead.id);
      toast.success("Lead converted to client!");
      setConvertOpen(false);
      setConvertingLead(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Conversion failed");
    } finally { setSaving(false); }
  };

  const getProfileName = (id: string | null) => profiles.find((p) => p.id === id)?.full_name || "—";

  return (
    <DashboardLayout title="Leads">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="in_discussion">In Discussion</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> Add Lead</Button>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Source</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Interest</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Assigned To</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leads found</TableCell></TableRow>
                ) : (
                  filteredLeads.map((l) => (
                    <TableRow key={l.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{l.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{l.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{l.source || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{l.insurance_type_interest || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{getProfileName(l.assigned_intermediary_id)}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select value={l.status} onValueChange={(v) => handleStatusChange(l, v)}>
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <Badge variant="outline" className={`${statusColor[l.status]} text-xs`}>{statusLabel[l.status]}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabel).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={statusColor[l.status]}>{statusLabel[l.status]}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingLead(l); setViewOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {l.status !== "converted" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => { setConvertingLead(l); setConvertOpen(true); }}>
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingLead(l); setDeleteOpen(true); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
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

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription>{editingLead ? "Update lead information" : "Enter details for the new lead"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="Lead name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Insurance Interest</Label>
                <Input placeholder="Health, Motor, Life..." value={formData.insurance_type_interest} onChange={(e) => setFormData({ ...formData, insurance_type_interest: e.target.value })} />
              </div>
            </div>
            {isAdmin && profiles.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to Intermediary</Label>
                <Select value={formData.assigned_intermediary_id} onValueChange={(v) => setFormData({ ...formData, assigned_intermediary_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea placeholder="Additional notes..." value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingLead ? "Update" : "Add Lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Viewing lead information</DialogDescription>
          </DialogHeader>
          {viewingLead && (
            <div className="space-y-3 py-2">
              <div><Label className="text-muted-foreground text-xs">Name</Label><p className="font-medium">{viewingLead.full_name}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Email</Label><p>{viewingLead.email || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Phone</Label><p>{viewingLead.phone || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Source</Label><p className="capitalize">{viewingLead.source || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Interest</Label><p>{viewingLead.insurance_type_interest || "—"}</p></div>
              </div>
              <div><Label className="text-muted-foreground text-xs">Assigned To</Label><p>{getProfileName(viewingLead.assigned_intermediary_id)}</p></div>
              <div><Label className="text-muted-foreground text-xs">Status</Label><Badge variant="outline" className={statusColor[viewingLead.status]}>{statusLabel[viewingLead.status]}</Badge></div>
              {viewingLead.message && <div><Label className="text-muted-foreground text-xs">Message</Label><p className="text-sm">{viewingLead.message}</p></div>}
              <div><Label className="text-muted-foreground text-xs">Created</Label><p className="text-sm">{new Date(viewingLead.created_at).toLocaleDateString()}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deletingLead?.full_name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Client */}
      <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Client</AlertDialogTitle>
            <AlertDialogDescription>Convert "{convertingLead?.full_name}" into a client? Their contact details will be used to create a new client record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert} disabled={saving}>{saving ? "Converting..." : "Convert"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Leads;
