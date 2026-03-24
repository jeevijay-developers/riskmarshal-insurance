import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

interface RenewalItem {
  id: string;
  clientName: string;
  policyNumber: string;
  expiryDate: string;
  daysLeft: number;
  premium: string;
}

function getUrgencyColor(days: number) {
  if (days <= 7) return "bg-destructive/15 text-destructive border-destructive/30";
  if (days <= 30) return "bg-warning/15 text-warning border-warning/30";
  return "bg-info/15 text-info border-info/30";
}

function getUrgencyLabel(days: number) {
  if (days <= 7) return "Critical";
  if (days <= 30) return "Urgent";
  return "Upcoming";
}

export function RenewalWidget() {
  const [renewals, setRenewals] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("policies")
        .select("id, policy_number, premium_amount, end_date, status, clients(full_name)")
        .in("status", ["active", "expiring"])
        .order("end_date", { ascending: true })
        .limit(6);

      if (data) {
        const today = new Date();
        const items: RenewalItem[] = data
          .map((p: any) => ({
            id: p.id,
            clientName: p.clients?.full_name || "Unknown",
            policyNumber: p.policy_number,
            expiryDate: p.end_date,
            daysLeft: differenceInDays(parseISO(p.end_date), today),
            premium: `₹${Number(p.premium_amount).toLocaleString("en-IN")}`,
          }))
          .filter((r) => r.daysLeft >= 0 && r.daysLeft <= 90);
        setRenewals(items);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Upcoming Renewals
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{renewals.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming renewals</p>
        ) : (
          renewals.map((renewal) => (
            <div
              key={renewal.id}
              className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{renewal.clientName}</p>
                <p className="text-xs text-muted-foreground">{renewal.policyNumber}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">{renewal.premium}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-2 py-0.5", getUrgencyColor(renewal.daysLeft))}
                >
                  {renewal.daysLeft}d — {getUrgencyLabel(renewal.daysLeft)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
