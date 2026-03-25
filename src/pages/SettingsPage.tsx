import { useState, useEffect } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  role?: string;
}

const roleColor: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary border-primary/30",
  intermediary: "bg-info/10 text-info border-info/30",
  staff: "bg-muted text-muted-foreground",
};

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  intermediary: "Intermediary",
  staff: "Staff",
};

const SettingsPage = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserWithRole | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "", email: "", password: "", role: "intermediary",
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load users"); setLoading(false); return; }

    const { data: roles } = await supabase.from("user_roles").select("*");
    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));

    const enriched: UserWithRole[] = (profiles || []).map((p) => ({
      ...p,
      role: roleMap.get(p.user_id) || "unknown",
    }));
    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async () => {
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          role: formData.role,
        },
      });

      if (res.error) throw new Error(res.error.message || "Failed to create user");
      
      const responseData = res.data;
      if (responseData?.error) throw new Error(responseData.error);

      toast.success(`User "${formData.full_name}" created successfully`);
      setAddOpen(false);
      setFormData({ full_name: "", email: "", password: "", role: "intermediary" });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    } finally { setSaving(false); }
  };

  useSetPageTitle("Settings & User Management");

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">User Management</CardTitle>
              <Button className="gap-2" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Phone</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColor[u.role || ""] || ""}>{roleLabel[u.role || ""] || u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingUser(u); setViewOpen(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Create a new account for an intermediary or staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="Enter full name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" placeholder="user@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" placeholder="Min 6 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intermediary">Intermediary</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Viewing user information</DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-3 py-2">
              <div><Label className="text-muted-foreground text-xs">Name</Label><p className="font-medium">{viewingUser.full_name || "—"}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Email</Label><p>{viewingUser.email}</p></div>
                <div><Label className="text-muted-foreground text-xs">Phone</Label><p>{viewingUser.phone || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Role</Label><Badge variant="outline" className={roleColor[viewingUser.role || ""]}>{roleLabel[viewingUser.role || ""] || viewingUser.role}</Badge></div>
                <div><Label className="text-muted-foreground text-xs">Status</Label><Badge variant="outline" className={viewingUser.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>{viewingUser.is_active ? "Active" : "Inactive"}</Badge></div>
              </div>
              <div><Label className="text-muted-foreground text-xs">Created</Label><p className="text-sm">{new Date(viewingUser.created_at).toLocaleDateString()}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsPage;
