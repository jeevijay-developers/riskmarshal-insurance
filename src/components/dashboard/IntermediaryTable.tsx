import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface IntermediaryPerf {
  name: string;
  code: string | null;
  activePolicies: number;
  clients: number;
  revenue: number;
  totalCommission: number;
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: firstDay.toISOString().split("T")[0],
    to: lastDay.toISOString().split("T")[0],
  };
}

export function IntermediaryTable() {
  const defaultRange = getMonthRange();
  const [data, setData] = useState<IntermediaryPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name");

    if (profilesError || !profiles) { setLoading(false); return; }

    const [policiesRes, clientsRes, commissionsRes] = await Promise.all([
      supabase.from("policies").select("intermediary_id, status, premium_amount"),
      supabase.from("clients").select("intermediary_id"),
      supabase
        .from("commissions")
        .select("intermediary_id, commission_amount, created_at")
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`),
    ]);

    const policies = policiesRes.data || [];
    const clients = clientsRes.data || [];
    const commissions = commissionsRes.data || [];

    const perfMap = new Map<string, IntermediaryPerf>();
    for (const p of profiles) {
      perfMap.set(p.id, {
        name: p.full_name,
        code: null,
        activePolicies: 0,
        clients: 0,
        revenue: 0,
        totalCommission: 0,
      });
    }

    for (const pol of policies) {
      const entry = perfMap.get(pol.intermediary_id);
      if (entry) {
        if (pol.status === "active" || pol.status === "expiring") entry.activePolicies++;
        entry.revenue += Number(pol.premium_amount || 0);
      }
    }
    for (const cl of clients) {
      const entry = perfMap.get(cl.intermediary_id);
      if (entry) entry.clients++;
    }
    for (const cm of commissions) {
      const entry = perfMap.get(cm.intermediary_id);
      if (entry) entry.totalCommission += Number(cm.commission_amount || 0);
    }

    const results = Array.from(perfMap.values())
      .filter(e => e.activePolicies > 0 || e.clients > 0 || e.totalCommission > 0)
      .sort((a, b) => b.totalCommission - a.totalCommission || b.revenue - a.revenue);

    setData(results);
    setLoading(false);
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const handleThisMonth = () => {
    const range = getMonthRange();
    setFromDate(range.from);
    setToDate(range.to);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 md:pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Intermediary Performance</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input type="date" className="h-8 sm:h-9 text-xs w-24 sm:w-28 md:w-32" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input type="date" className="h-8 sm:h-9 text-xs w-24 sm:w-28 md:w-32" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs" onClick={handleThisMonth}>
              This Month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                <TableHead className="text-muted-foreground text-xs">Code</TableHead>
                <TableHead className="text-muted-foreground text-xs">Policies</TableHead>
                <TableHead className="text-muted-foreground text-xs">Clients</TableHead>
                <TableHead className="text-muted-foreground text-xs">Revenue</TableHead>
                <TableHead className="text-muted-foreground text-xs">Total Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((i) => (
                <TableRow key={i.name} className="border-border/30">
                  <TableCell className="font-medium text-sm">{i.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{i.code || "—"}</TableCell>
                  <TableCell className="text-sm">{i.activePolicies}</TableCell>
                  <TableCell className="text-sm">{i.clients}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(i.revenue)}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(i.totalCommission)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
