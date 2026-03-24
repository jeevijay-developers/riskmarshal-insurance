import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface IntermediaryPerf {
  name: string;
  activePolicies: number;
  clients: number;
  revenue: number;
}

export function IntermediaryTable() {
  const [data, setData] = useState<IntermediaryPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (!profiles) { setLoading(false); return; }

      const [policiesRes, clientsRes] = await Promise.all([
        supabase.from("policies").select("intermediary_id, status, premium_amount"),
        supabase.from("clients").select("intermediary_id"),
      ]);

      const policies = policiesRes.data || [];
      const clients = clientsRes.data || [];

      const perfMap = new Map<string, IntermediaryPerf>();
      for (const p of profiles) {
        perfMap.set(p.id, { name: p.full_name, activePolicies: 0, clients: 0, revenue: 0 });
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

      const results = Array.from(perfMap.values())
        .filter(e => e.activePolicies > 0 || e.clients > 0)
        .sort((a, b) => b.revenue - a.revenue);

      setData(results);
      setLoading(false);
    };
    fetch();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Intermediary Performance</CardTitle>
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
                <TableHead className="text-muted-foreground text-xs">Policies</TableHead>
                <TableHead className="text-muted-foreground text-xs">Clients</TableHead>
                <TableHead className="text-muted-foreground text-xs">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((i) => (
                <TableRow key={i.name} className="border-border/30">
                  <TableCell className="font-medium text-sm">{i.name}</TableCell>
                  <TableCell className="text-sm">{i.activePolicies}</TableCell>
                  <TableCell className="text-sm">{i.clients}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(i.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
