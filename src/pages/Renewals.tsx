import { useState, useEffect, useMemo } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Eye, Bell, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Policy = Tables<"policies">;

interface RenewalPolicy extends Policy {
  clients?: { full_name: string } | null;
  insurers?: { name: string } | null;
}

const statusColor: Record<string, string> = {
  upcoming: "bg-info/10 text-info border-info/30",
  reminder_sent: "bg-warning/10 text-warning border-warning/30",
  renewed: "bg-success/10 text-success border-success/30",
  lapsed: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabel: Record<string, string> = {
  upcoming: "Upcoming",
  reminder_sent: "Reminder Sent",
  renewed: "Renewed",
  lapsed: "Lapsed",
};

const Renewals = () => {
  const { role } = useAuth();
  const isAdmin = role === "super_admin";
  const [policies, setPolicies] = useState<RenewalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<RenewalPolicy | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ policy: RenewalPolicy; status: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("policies")
      .select("*, clients(full_name), insurers(name)")
      .in("status", ["active", "expiring"])
      .order("end_date", { ascending: true });
    if (data) setPolicies(data as RenewalPolicy[]);
    if (error) toast.error("Failed to load renewals");
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const enriched = useMemo(() => {
    const today = new Date();
    return policies.map((p) => {
      const endDate = parseISO(p.end_date);
      const daysLeft = differenceInDays(endDate, today);
      return { ...p, daysLeft };
    });
  }, [policies]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || (p.clients?.full_name?.toLowerCase().includes(s)) || p.policy_number.toLowerCase().includes(s);
      const matchStatus = statusFilter === "all" || p.renewal_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [enriched, searchTerm, statusFilter]);

  const handleStatusChange = async (policy: RenewalPolicy, newStatus: string) => {
    setConfirmAction({ policy, status: newStatus });
    setConfirmOpen(true);
  };

  const executeStatusChange = async () => {
    if (!confirmAction) return;
    const { policy, status } = confirmAction;
    const { error } = await supabase.from("policies")
      .update({ renewal_status: status as Policy["renewal_status"] })
      .eq("id", policy.id);
    if (error) toast.error("Failed to update status");
    else { toast.success(`Renewal status updated to ${statusLabel[status]}`); fetchData(); }
    setConfirmOpen(false);
    setConfirmAction(null);
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <DashboardLayout title="Renewals">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search renewals..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="reminder_sent">Reminder Sent</SelectItem>
                <SelectItem value="renewed">Renewed</SelectItem>
                <SelectItem value="lapsed">Lapsed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Client</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Policy</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Insurer</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Expiry</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Days Left</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Premium</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No renewals found</TableCell></TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{p.clients?.full_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{p.policy_number}</TableCell>
                      <TableCell className="text-muted-foreground">{p.insurers?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.end_date}</TableCell>
                      <TableCell className={p.daysLeft <= 7 ? "text-destructive font-semibold" : p.daysLeft <= 30 ? "text-warning font-medium" : ""}>
                        {p.daysLeft <= 0 ? "Expired" : `${p.daysLeft} days`}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(p.premium_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor[p.renewal_status]}>{statusLabel[p.renewal_status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingItem(p); setViewOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {p.renewal_status === "upcoming" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-warning" title="Send Reminder" onClick={() => handleStatusChange(p, "reminder_sent")}>
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(p.renewal_status === "upcoming" || p.renewal_status === "reminder_sent") && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Mark Renewed" onClick={() => handleStatusChange(p, "renewed")}>
                              <CheckCircle className="h-3.5 w-3.5" />
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

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renewal Details</DialogTitle>
            <DialogDescription>Policy renewal information</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-3 py-2">
              <div><Label className="text-muted-foreground text-xs">Client</Label><p className="font-medium">{viewingItem.clients?.full_name || "—"}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Policy Number</Label><p className="font-mono">{viewingItem.policy_number}</p></div>
                <div><Label className="text-muted-foreground text-xs">Type</Label><p className="capitalize">{viewingItem.policy_type}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Insurer</Label><p>{viewingItem.insurers?.name || "—"}</p></div>
                <div><Label className="text-muted-foreground text-xs">Premium</Label><p className="font-medium">{formatCurrency(viewingItem.premium_amount)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Start Date</Label><p>{viewingItem.start_date}</p></div>
                <div><Label className="text-muted-foreground text-xs">End Date</Label><p>{viewingItem.end_date}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Days Left</Label><p className={(viewingItem as any).daysLeft <= 7 ? "text-destructive font-semibold" : ""}>{(viewingItem as any).daysLeft <= 0 ? "Expired" : `${(viewingItem as any).daysLeft} days`}</p></div>
                <div><Label className="text-muted-foreground text-xs">Renewal Status</Label><Badge variant="outline" className={statusColor[viewingItem.renewal_status]}>{statusLabel[viewingItem.renewal_status]}</Badge></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Status Change */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Renewal Status</AlertDialogTitle>
            <AlertDialogDescription>
              Change renewal status for policy "{confirmAction?.policy.policy_number}" to "{confirmAction ? statusLabel[confirmAction.status] : ""}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeStatusChange}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Renewals;
