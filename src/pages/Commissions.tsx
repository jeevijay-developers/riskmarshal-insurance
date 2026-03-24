import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Commission {
  id: string;
  intermediary_id: string;
  insurer_id: string | null;
  policy_id: string | null;
  premium_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  intermediary_name?: string;
  insurer_name?: string;
  policy_number?: string;
}

interface Profile { id: string; full_name: string; }
interface Insurer { id: string; name: string; }
interface Policy { id: string; policy_number: string; premium_amount: number; }

const emptyForm = {
  intermediary_id: "", insurer_id: "", policy_id: "",
  premium_amount: "", commission_rate: "", status: "pending" as "pending" | "paid" | "cancelled",
};

const Commissions = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Commission | null>(null);
  const [viewing, setViewing] = useState<Commission | null>(null);
  const [deleting, setDeleting] = useState<Commission | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    const [cRes, pRes, iRes, polRes] = await Promise.all([
      supabase.from("commissions").select("*, profiles:intermediary_id(full_name), insurers:insurer_id(name), policies:policy_id(policy_number)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("insurers").select("id, name").eq("is_active", true),
      supabase.from("policies").select("id, policy_number, premium_amount"),
    ]);

    if (cRes.data) {
      setCommissions(cRes.data.map((c: any) => ({
        ...c,
        intermediary_name: c.profiles?.full_name || "Unknown",
        insurer_name: c.insurers?.name || "—",
        policy_number: c.policies?.policy_number || "—",
      })));
    }
    if (pRes.data) setProfiles(pRes.data);
    if (iRes.data) setInsurers(iRes.data);
    if (polRes.data) setPolicies(polRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() =>
    commissions.filter(c => {
      const matchSearch = (c.intermediary_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.policy_number || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [commissions, search, statusFilter]
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c: Commission) => {
    setEditing(c);
    setForm({
      intermediary_id: c.intermediary_id,
      insurer_id: c.insurer_id || "",
      policy_id: c.policy_id || "",
      premium_amount: String(c.premium_amount),
      commission_rate: String(c.commission_rate),
      status: c.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.intermediary_id) { toast.error("Intermediary is required"); return; }
    const premium = Number(form.premium_amount) || 0;
    const rate = Number(form.commission_rate) || 0;
    const payload = {
      intermediary_id: form.intermediary_id,
      insurer_id: form.insurer_id || null,
      policy_id: form.policy_id || null,
      premium_amount: premium,
      commission_rate: rate,
      commission_amount: (premium * rate) / 100,
      status: form.status as "pending" | "paid" | "cancelled",
    };
    if (editing) {
      const { error } = await supabase.from("commissions").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Commission updated");
    } else {
      const { error } = await supabase.from("commissions").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Commission added");
    }
    setModalOpen(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("commissions").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commission deleted");
    setDeleteOpen(false);
    setDeleting(null);
    fetchAll();
  };

  // Auto-fill premium when policy selected
  const handlePolicyChange = (policyId: string) => {
    setForm(prev => {
      const pol = policies.find(p => p.id === policyId);
      return { ...prev, policy_id: policyId, premium_amount: pol ? String(pol.premium_amount) : prev.premium_amount };
    });
  };

  const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <DashboardLayout title="Commissions">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search commissions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> Add Commission</Button>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Intermediary</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Insurer</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Policy</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Premium</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Rate</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Commission</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No commissions found</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id} className="border-border/30">
                    <TableCell className="font-medium">{c.intermediary_name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.insurer_name}</TableCell>
                    <TableCell className="font-mono text-sm">{c.policy_number}</TableCell>
                    <TableCell>{formatCurrency(c.premium_amount)}</TableCell>
                    <TableCell>{c.commission_rate}%</TableCell>
                    <TableCell className="font-medium">{formatCurrency(c.commission_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.status === "paid" ? "bg-success/10 text-success border-success/30" :
                        c.status === "pending" ? "bg-warning/10 text-warning border-warning/30" :
                        "bg-muted text-muted-foreground"
                      }>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewing(c); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleting(c); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Commission" : "Add Commission"}</DialogTitle>
            <DialogDescription>{editing ? "Update commission details." : "Record a new commission."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Intermediary *</Label>
              <Select value={form.intermediary_id} onValueChange={v => setForm({ ...form, intermediary_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select intermediary" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Insurer</Label>
              <Select value={form.insurer_id} onValueChange={v => setForm({ ...form, insurer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
                <SelectContent>{insurers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Policy</Label>
              <Select value={form.policy_id} onValueChange={handlePolicyChange}>
                <SelectTrigger><SelectValue placeholder="Select policy" /></SelectTrigger>
                <SelectContent>{policies.map(p => <SelectItem key={p.id} value={p.id}>{p.policy_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Premium Amount</Label><Input type="number" value={form.premium_amount} onChange={e => setForm({ ...form, premium_amount: e.target.value })} /></div>
              <div><Label>Commission Rate (%)</Label><Input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} /></div>
            </div>
            <div className="text-sm text-muted-foreground">
              Commission: {formatCurrency((Number(form.premium_amount) || 0) * (Number(form.commission_rate) || 0) / 100)}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Commission"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commission Details</DialogTitle>
            <DialogDescription>Viewing commission information.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Intermediary:</span> <span className="font-medium">{viewing.intermediary_name}</span></div>
              <div><span className="text-muted-foreground">Insurer:</span> {viewing.insurer_name}</div>
              <div><span className="text-muted-foreground">Policy:</span> {viewing.policy_number}</div>
              <div><span className="text-muted-foreground">Premium:</span> {formatCurrency(viewing.premium_amount)}</div>
              <div><span className="text-muted-foreground">Rate:</span> {viewing.commission_rate}%</div>
              <div><span className="text-muted-foreground">Commission:</span> <span className="font-medium">{formatCurrency(viewing.commission_amount)}</span></div>
              <div><span className="text-muted-foreground">Status:</span> {viewing.status}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(viewing.created_at).toLocaleDateString()}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commission</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
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

export default Commissions;
