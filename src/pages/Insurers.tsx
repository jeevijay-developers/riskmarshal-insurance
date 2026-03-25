import { useState, useEffect, useMemo } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Insurer {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = { name: "", contact_email: "", contact_phone: "", is_active: true };

const Insurers = () => {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [viewing, setViewing] = useState<Insurer | null>(null);
  const [deleting, setDeleting] = useState<Insurer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchInsurers = async () => {
    const { data } = await supabase.from("insurers").select("*").order("name");
    if (data) setInsurers(data);
    setLoading(false);
  };

  useEffect(() => { fetchInsurers(); }, []);

  const filtered = useMemo(() =>
    insurers.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.contact_email || "").toLowerCase().includes(search.toLowerCase())),
    [insurers, search]
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (i: Insurer) => {
    setEditing(i);
    setForm({ name: i.name, contact_email: i.contact_email || "", contact_phone: i.contact_phone || "", is_active: i.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("insurers").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Insurer updated");
    } else {
      const { error } = await supabase.from("insurers").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Insurer added");
    }
    setModalOpen(false);
    fetchInsurers();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("insurers").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Insurer deleted");
    setDeleteOpen(false);
    setDeleting(null);
    fetchInsurers();
  };

  return (
    <DashboardLayout title="Insurers">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search insurers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button className="gap-2" onClick={openAdd}><Plus className="h-4 w-4" /> Add Insurer</Button>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Phone</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No insurers found</TableCell></TableRow>
                ) : filtered.map(i => (
                  <TableRow key={i.id} className="border-border/30">
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="text-muted-foreground">{i.contact_email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.contact_phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={i.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                        {i.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewing(i); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleting(i); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Insurer" : "Add Insurer"}</DialogTitle>
            <DialogDescription>{editing ? "Update insurer details." : "Add a new insurer."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Insurer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insurer Details</DialogTitle>
            <DialogDescription>Viewing insurer information.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{viewing.name}</span></div>
              <div><span className="text-muted-foreground">Email:</span> {viewing.contact_email || "—"}</div>
              <div><span className="text-muted-foreground">Phone:</span> {viewing.contact_phone || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> {viewing.is_active ? "Active" : "Inactive"}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(viewing.created_at).toLocaleDateString()}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Insurer</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleting?.name}"? This cannot be undone.</AlertDialogDescription>
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

export default Insurers;
