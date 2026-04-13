/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Plus, Eye, EyeOff, Trash2, X, Pencil, Ban, CheckCircle, Phone, UserSquare, Briefcase, Copy, Download, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  intermediary_code: string | null;
  is_active: boolean;
  created_at: string;
  role?: string;
}

interface Insurer {
  id: string;
  name: string;
}

interface InsurerAssociation {
  insurer_id: string;
  insurer_name: string;
  commission_rate: number;
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

const StaffPage = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserWithRole | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [statusTargetUser, setStatusTargetUser] = useState<UserWithRole | null>(null);
  const [viewingAssociations, setViewingAssociations] = useState<InsurerAssociation[]>([]);
  const [saving, setSaving] = useState(false);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    full_name: "", email: "", password: "", role: "intermediary",
    phone: "", intermediary_code: "",
  });

  // Insurer associations for the form (multiple insurers with commission rates)
  const [formAssociations, setFormAssociations] = useState<{ insurer_id: string; commission_rate: string }[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load users"); setLoading(false); return; }

    const { data: roles } = await supabase.from("user_roles").select("*");
    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));

    const enriched: UserWithRole[] = (profiles || []).map((p: any) => ({
      ...p,
      role: roleMap.get(p.user_id) || "unknown",
    }));
    setUsers(enriched);
    setLoading(false);
  };

  const fetchInsurers = async () => {
    const { data } = await supabase.from("insurers").select("id, name").eq("is_active", true).order("name");
    if (data) setInsurers(data);
  };

  useEffect(() => { fetchUsers(); fetchInsurers(); }, []);

  const addAssociationRow = () => {
    setFormAssociations([...formAssociations, { insurer_id: "", commission_rate: "" }]);
  };

  const removeAssociationRow = (index: number) => {
    setFormAssociations(formAssociations.filter((_, i) => i !== index));
  };

  const updateAssociation = (index: number, field: string, value: string) => {
    const updated = [...formAssociations];
    updated[index] = { ...updated[index], [field]: value };
    setFormAssociations(updated);
  };

  const handleCreateUser = async () => {
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (formData.role === "intermediary") {
      if (!formData.intermediary_code.trim()) {
        toast.error("Intermediary code is required");
        return;
      }
      if (!formData.phone.trim()) {
        toast.error("Contact number is required for intermediaries");
        return;
      }
      const validAssociations = formAssociations.filter(a => a.insurer_id && a.commission_rate);
      if (validAssociations.length === 0) {
        toast.error("At least one insurer association with commission rate is required");
        return;
      }
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          role: formData.role,
        }),
      });

      const responseData = await res.json();
      if (!res.ok || responseData.error) {
        throw new Error(responseData.error || `Request failed with status ${res.status}`);
      }

      const newUserId = responseData.user_id;

      // Update profile with intermediary-specific fields
      if (formData.role === "intermediary" && newUserId) {
        // Get the profile id for the new user
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", newUserId)
          .single();

        if (profileData) {
          // Update profile with intermediary_code and phone
          await supabase.from("profiles").update({
            intermediary_code: formData.intermediary_code.trim(),
            phone: formData.phone.trim(),
          }).eq("id", profileData.id);

          // Create intermediary_insurers records
          const validAssociations = formAssociations.filter(a => a.insurer_id && a.commission_rate);
          if (validAssociations.length > 0) {
            const records = validAssociations.map(a => ({
              intermediary_id: profileData.id,
              insurer_id: a.insurer_id,
              commission_rate: Number(a.commission_rate) || 0,
            }));
            const { error: assocErr } = await supabase.from("intermediary_insurers").insert(records);
            if (assocErr) {
              console.error("Failed to create insurer associations:", assocErr);
              toast.warning("User created but some insurer associations failed");
            }
          }
        }
      }

      toast.success(`User "${formData.full_name}" created successfully`);
      setCreatedCredentials({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.full_name.trim(),
      });
      setAddOpen(false);
      setCredentialsOpen(true);
      setFormData({ full_name: "", email: "", password: "", role: "intermediary", phone: "", intermediary_code: "" });
      setFormAssociations([]);
      setShowPassword(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    } finally { setSaving(false); }
  };

  const handleViewUser = async (u: UserWithRole) => {
    setViewingUser(u);
    setViewingAssociations([]);
    setViewOpen(true);

    // Fetch insurer associations for this user
    if (u.role === "intermediary") {
      const { data } = await supabase
        .from("intermediary_insurers")
        .select("insurer_id, commission_rate, insurers(name)")
        .eq("intermediary_id", u.id);
      if (data) {
        setViewingAssociations(data.map((d: any) => ({
          insurer_id: d.insurer_id,
          insurer_name: d.insurers?.name || "Unknown",
          commission_rate: d.commission_rate,
        })));
      }
    }
  };

  const handleEditClick = async (u: UserWithRole) => {
    setEditingUser(u);
    setFormData({
      full_name: u.full_name || "",
      email: u.email || "",
      password: "", // Password is not editable here directly due to auth restrictions
      role: u.role || "intermediary",
      phone: u.phone || "",
      intermediary_code: u.intermediary_code || "",
    });
    
    if (u.role === "intermediary") {
      const { data } = await supabase
        .from("intermediary_insurers")
        .select("insurer_id, commission_rate")
        .eq("intermediary_id", u.id);
      if (data) {
        setFormAssociations(data.map((d: any) => ({
          insurer_id: d.insurer_id,
          commission_rate: d.commission_rate.toString(),
        })));
      } else {
        setFormAssociations([]);
      }
    } else {
      setFormAssociations([]);
    }
    
    setEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!formData.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (formData.role === "intermediary") {
      if (!formData.intermediary_code.trim()) {
        toast.error("Intermediary code is required");
        return;
      }
      const validAssociations = formAssociations.filter(a => a.insurer_id && a.commission_rate);
      if (validAssociations.length === 0) {
        toast.error("At least one insurer association with commission rate is required");
        return;
      }
    }

    setSaving(true);
    try {
      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name.trim(),
          intermediary_code: formData.role === "intermediary" ? formData.intermediary_code.trim() : null,
          phone: formData.phone.trim(),
        })
        .eq("id", editingUser.id);
      
      if (profileErr) throw profileErr;

      // Update role if changed
      if (formData.role !== editingUser.role) {
        await supabase.from("user_roles").update({ role: formData.role }).eq("user_id", editingUser.id);
      }

      // Update associations if intermediary
      await supabase.from("intermediary_insurers").delete().eq("intermediary_id", editingUser.id);
      
      if (formData.role === "intermediary") {
        const validAssociations = formAssociations.filter(a => a.insurer_id && a.commission_rate);
        if (validAssociations.length > 0) {
          const records = validAssociations.map(a => ({
            intermediary_id: editingUser.id,
            insurer_id: a.insurer_id,
            commission_rate: Number(a.commission_rate) || 0,
          }));
          const { error: assocErr } = await supabase.from("intermediary_insurers").insert(records);
          if (assocErr) {
            console.error("Failed to update insurer associations:", assocErr);
            toast.warning("Profile updated but some insurer associations failed");
          }
        }
      }

      toast.success(`User "${formData.full_name}" updated successfully`);
      setEditOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggleClick = (user: UserWithRole) => {
    setStatusTargetUser(user);
    setStatusConfirmOpen(true);
  };

  const handleToggleStatus = async () => {
    if (!statusTargetUser) return;
    
    const newStatus = !statusTargetUser.is_active;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: newStatus })
        .eq("id", statusTargetUser.id);
      
      if (error) throw error;
      toast.success(`User successfully ${newStatus ? 'activated' : 'deactivated'}`);
      fetchUsers();
      setStatusConfirmOpen(false);
      setStatusTargetUser(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const copyAllCredentials = async () => {
    if (!createdCredentials) return;
    const text = `Account Credentials\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
    await navigator.clipboard.writeText(text);
    toast.success("All credentials copied");
  };

  const downloadCredentials = () => {
    if (!createdCredentials) return;
    const text = `Account Credentials\n${"=".repeat(30)}\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentials_${createdCredentials.email.split("@")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useSetPageTitle("Staff Management");

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">User Management</CardTitle>
              <Button className="gap-2" size="sm" onClick={() => {
                setFormData({ full_name: "", email: "", password: "", role: "intermediary", phone: "", intermediary_code: "" });
                setFormAssociations([]);
                setShowPassword(false);
                setAddOpen(true);
              }}>
                <Plus className="h-4 w-4" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Code</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Phone</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{u.intermediary_code || "—"}</TableCell>
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
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleViewUser(u)} title="View User">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-info hover:text-info" onClick={() => handleEditClick(u)} title="Edit User">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className={u.is_active ? "h-8 w-8 text-destructive hover:text-destructive" : "h-8 w-8 text-success hover:text-success"} onClick={() => handleConfirmToggleClick(u)} title={u.is_active ? "Deactivate User" : "Activate User"}>
                            {u.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
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

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  className="pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
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

            {/* Intermediary-specific fields */}
            {formData.role === "intermediary" && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <p className="text-sm font-semibold text-muted-foreground">Intermediary Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Intermediary Code *</Label>
                      <Input placeholder="e.g., ILG49754" value={formData.intermediary_code} onChange={(e) => setFormData({ ...formData, intermediary_code: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Number *</Label>
                      <Input placeholder="e.g., 9425011003" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                  </div>

                  {/* Insurer Associations */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Insurer Associations *</Label>
                      <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addAssociationRow}>
                        <Plus className="h-3 w-3" /> Add Insurer
                      </Button>
                    </div>
                    {formAssociations.length === 0 && (
                      <p className="text-xs text-muted-foreground">Click "Add Insurer" to associate this intermediary with insurers and set commission rates.</p>
                    )}
                    {formAssociations.map((assoc, idx) => (
                      <div key={idx} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Insurer</Label>
                          <Select value={assoc.insurer_id} onValueChange={(v) => updateAssociation(idx, "insurer_id", v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select insurer" /></SelectTrigger>
                            <SelectContent>
                              {insurers.map((ins) => (
                                <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-28 space-y-1">
                          <Label className="text-xs">Commission %</Label>
                          <Input
                            type="number"
                            placeholder="e.g., 4"
                            className="h-9"
                            value={assoc.commission_rate}
                            onChange={(e) => updateAssociation(idx, "commission_rate", e.target.value)}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeAssociationRow(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Phone for non-intermediary roles */}
            {formData.role !== "intermediary" && (
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="Contact number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setShowPassword(false); }}>Cancel</Button>
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
            <div className="space-y-5 py-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="font-medium text-base">{viewingUser.full_name || "—"}</p>
              </div>
              {viewingUser.intermediary_code && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Intermediary Code</Label>
                  <p className="font-mono text-sm font-medium">{viewingUser.intermediary_code}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="text-sm">{viewingUser.email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="text-sm">{viewingUser.phone || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Role</Label>
                  <div><Badge variant="outline" className={roleColor[viewingUser.role || ""]}>{roleLabel[viewingUser.role || ""] || viewingUser.role}</Badge></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div><Badge variant="outline" className={viewingUser.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>{viewingUser.is_active ? "Active" : "Inactive"}</Badge></div>
                </div>
              </div>

              {/* Insurer Associations */}
              {viewingUser.role === "intermediary" && viewingAssociations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Insurer Associations</Label>
                  <div className="border rounded-md divide-y">
                    {viewingAssociations.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm font-medium">{a.insurer_name}</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {a.commission_rate}% commission
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Created</Label>
                <p className="text-sm">{new Date(viewingUser.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) setEditingUser(null);
      }}>
        <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update the details for {editingUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-4">
                <div
                  className={`w-full py-2 px-3 border rounded-md text-sm text-center ${formData.role === "staff" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground cursor-not-allowed bg-muted"}`}
                >
                  <UserSquare className="mr-2 h-4 w-4 inline" />
                  Internal Staff
                </div>
                <div
                  className={`w-full py-2 px-3 border rounded-md text-sm text-center ${formData.role === "intermediary" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground cursor-not-allowed bg-muted"}`}
                >
                  <Briefcase className="mr-2 h-4 w-4 inline" />
                  Intermediary
                </div>
              </div>
              <p className="text-xs text-muted-foreground">User roles cannot be changed once created.</p>
            </div>

            {formData.role === "intermediary" && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/50 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-intermediary-code">Intermediary Code</Label>
                  <Input
                    id="edit-intermediary-code"
                    value={formData.intermediary_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        intermediary_code: e.target.value,
                      })
                    }
                  />
                </div>
                
                <div className="space-y-2 pt-2 border-t mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Insurer Associations</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={addAssociationRow}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add
                    </Button>
                  </div>
                  
                  {formAssociations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-1">
                      No insurers mapped.
                    </p>
                  ) : (
                    <div className="space-y-3 mt-3 max-h-[140px] overflow-y-auto pr-1">
                      {formAssociations.map((assoc, index) => (
                        <div key={index} className="flex items-end gap-2 bg-background p-2 rounded-md border">
                          <div className="grid grid-cols-2 gap-2 flex-1">
                            <div className="space-y-1">
                              <Label className="text-xs">Insurer <span className="text-destructive">*</span></Label>
                              <Select
                                value={assoc.insurer_id}
                                onValueChange={(value) =>
                                  updateAssociation(index, "insurer_id", value)
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {insurers.map((ins) => (
                                    <SelectItem key={ins.id} value={ins.id}>
                                      {ins.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Comm. Rate % <span className="text-destructive">*</span></Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={assoc.commission_rate}
                                onChange={(e) =>
                                  updateAssociation(index, "commission_rate", e.target.value)
                                }
                                className="h-8"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/90 mb-[2px]"
                            onClick={() => removeAssociationRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Target Status Confirm Dialog */}
      <Dialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to {statusTargetUser?.is_active ? 'deactivate' : 'activate'} {statusTargetUser?.full_name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setStatusConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={statusTargetUser?.is_active ? "destructive" : "default"}
              onClick={handleToggleStatus}
              disabled={saving}
            >
              {saving ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={credentialsOpen} onOpenChange={(open) => {
        setCredentialsOpen(open);
        if (!open) setCreatedCredentials(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Created Successfully</DialogTitle>
            <DialogDescription>
              Save these credentials. The password cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="font-medium text-sm">{createdCredentials.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {createdCredentials.email}
                  </code>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(createdCredentials.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Password</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                    {createdCredentials.password}
                  </code>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(createdCredentials.password)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="gap-2" onClick={copyAllCredentials}>
              <ClipboardCheck className="h-4 w-4" /> Copy All
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadCredentials}>
              <Download className="h-4 w-4" /> Download .txt
            </Button>
            <Button onClick={() => { setCredentialsOpen(false); setCreatedCredentials(null); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default StaffPage;
