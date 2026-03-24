import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Quotation = Tables<"quotations">;

interface QuotationWithRelations extends Quotation {
  clients?: { full_name: string } | null;
  policies?: { policy_number: string } | null;
}

const paymentColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  paid: "bg-success/10 text-success border-success/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground",
};

const paymentLabel: Record<string, string> = {
  pending: "Pending", paid: "Paid", expired: "Expired", cancelled: "Cancelled",
};

const Quotations = () => {
  const { profileId } = useAuth();
  const [quotations, setQuotations] = useState<QuotationWithRelations[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [policies, setPolicies] = useState<{ id: string; policy_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuotationWithRelations | null>(null);
  const [viewingItem, setViewingItem] = useState<QuotationWithRelations | null>(null);
  const [deletingItem, setDeletingItem] = useState<QuotationWithRelations | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "", policy_id: "", amount: "", sent_via: "email", payment_status: "pending",
  });

  const fetchData = async () => {
    setLoading(true);
    const [qRes, cRes, pRes] = await Promise.all([
      supabase.from("quotations").select("*, clients(full_name), policies(policy_number)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("policies").select("id, policy_number").order("policy_number"),
    ]);
    if (qRes.data) setQuotations(qRes.data as QuotationWithRelations[]);
    if (cRes.data) setClients(cRes.data);
    if (pRes.data) setPolicies(pRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || (q.clients?.full_name?.toLowerCase().includes(s)) || (q.policies?.policy_number?.toLowerCase().includes(s));
      const matchStatus = statusFilter === "all" || q.payment_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotations, searchTerm, statusFilter]);

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ client_id: "", policy_id: "", amount: "", sent_via: "email", payment_status: "pending" });
    setFormOpen(true);
  };

  const openEdit = (q: QuotationWithRelations) => {
    setEditingItem(q);
    setFormData({
      client_id: q.client_id,
      policy_id: q.policy_id || "",
      amount: q.amount ? String(q.amount) : "",
      sent_via: q.sent_via || "email",
      payment_status: q.payment_status,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.client_id) { toast.error("Client is required"); return; }
    if (!profileId) { toast.error("Profile not loaded"); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: formData.client_id,
        policy_id: formData.policy_id || null,
        amount: formData.amount ? Number(formData.amount) : null,
        sent_via: formData.sent_via,
        payment_status: formData.payment_status as Quotation["payment_status"],
      };
      if (editingItem) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Quotation updated");
      } else {
        const { error } = await supabase.from("quotations").insert({ ...payload, intermediary_id: profileId, sent_at: new Date().toISOString() });
        if (error) throw error;
        toast.success("Quotation created");
      }
      setFormOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    const { error } = await supabase.from("quotations").delete().eq("id", deletingItem.id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Quotation deleted"); fetchData(); }
    setDeleteOpen(false);
    setDeletingItem(null);
  };

  const formatCurrency = (n: number | null) => n ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n) : "—";

  return (
    <DashboardLayout title="Quotations">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search quotations..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> New Quotation</Button>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Client</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Policy</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Amount</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Sent Via</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Sent At</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Payment</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found</TableCell></TableRow>
                ) : (
                  filtered.map((q) => (
                    <TableRow key={q.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{q.clients?.full_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{q.policies?.policy_number || "—"}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(q.amount)}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{q.sent_via || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{q.sent_at ? new Date(q.sent_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={paymentColor[q.payment_status]}>{paymentLabel[q.payment_status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingItem(q); setViewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingItem(q); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Quotation" : "New Quotation"}</DialogTitle>
            <DialogDescription>{editingItem ? "Update quotation details" : "Create a new quotation"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linked Policy</Label>
              <Select value={formData.policy_id} onValueChange={(v) => setFormData({ ...formData, policy_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select policy (optional)" /></SelectTrigger>
                <SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.policy_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" placeholder="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sent Via</Label>
                <Select value={formData.sent_via} onValueChange={(v) => setFormData({ ...formData, sent_via: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={formData.payment_status} onValueChange={(v) => setFormData({ ...formData, payment_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingItem ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quotation Details</DialogTitle>
            <DialogDescription>Viewing quotation information</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-3 py-2">
              <div><Label className="text-muted-foreground text-xs">Client</Label><p className="font-medium">{viewingItem.clients?.full_name || "—"}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Policy</Label><p className="font-mono">{viewingItem.policies?.policy_number || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Amount</Label><p className="font-medium">{formatCurrency(viewingItem.amount)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Sent Via</Label><p className="capitalize">{viewingItem.sent_via || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Sent At</Label><p>{viewingItem.sent_at ? new Date(viewingItem.sent_at).toLocaleDateString() : "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Payment Status</Label><Badge variant="outline" className={paymentColor[viewingItem.payment_status]}>{paymentLabel[viewingItem.payment_status]}</Badge></div>
                <div><Label className="text-muted-foreground text-xs">Alert Count</Label><p>{viewingItem.alert_count}</p></div>
              </div>
              <div><Label className="text-muted-foreground text-xs">Created</Label><p className="text-sm">{new Date(viewingItem.created_at).toLocaleDateString()}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
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

export default Quotations;
