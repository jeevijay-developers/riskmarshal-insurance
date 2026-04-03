import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";

export function RevenueChart() {
  const [data, setData] = useState<{ month: string; revenue: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        return { label: format(d, "MMM"), start: startOfMonth(d), end: endOfMonth(d) };
      });

      const { data: policies } = await supabase
        .from("policies")
        .select("premium_amount, start_date")
        .gte("start_date", format(months[0].start, "yyyy-MM-dd"))
        .lte("start_date", format(months[5].end, "yyyy-MM-dd"));

      const result = months.map(m => {
        const rev = (policies || [])
          .filter(p => {
            const d = parseISO(p.start_date);
            return d >= m.start && d <= m.end;
          })
          .reduce((sum, p) => sum + Number(p.premium_amount || 0), 0);
        return { month: m.label, revenue: rev };
      });

      setData(result);
    };
    fetch();
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Monthly Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] md:h-[250px] lg:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ className: "fill-muted-foreground", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ className: "fill-muted-foreground", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Bar dataKey="revenue" className="fill-primary" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
