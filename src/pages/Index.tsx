import { useState, useEffect } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { RenewalWidget } from "@/components/dashboard/RenewalWidget";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { IntermediaryTable } from "@/components/dashboard/IntermediaryTable";
import { FileText, Users, Clock, DollarSign, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { role } = useAuth();
  const isAdmin = role === "super_admin";

  const [stats, setStats] = useState({
    activePolicies: 0,
    totalClients: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    totalRevenue: 0,
    activeLeads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [policiesRes, clientsRes, quotationsRes, commissionsRes, leadsRes] = await Promise.all([
          supabase.from("policies").select("id, status, premium_amount"),
          supabase.from("clients").select("id", { count: "exact", head: true }),
          supabase.from("quotations").select("id, payment_status, amount"),
          supabase.from("commissions").select("id, commission_amount, status"),
          supabase.from("leads").select("id, status"),
        ]);

        const policies = policiesRes.data || [];
        const activePolicies = policies.filter(p => p.status === "active" || p.status === "expiring").length;
        const totalRevenue = policies.reduce((sum, p) => sum + Number(p.premium_amount || 0), 0);

        const quotations = quotationsRes.data || [];
        const pendingQuotations = quotations.filter(q => q.payment_status === "pending");
        const pendingAmount = pendingQuotations.reduce((sum, q) => sum + Number(q.amount || 0), 0);

        const leads = leadsRes.data || [];
        const activeLeads = leads.filter(l => l.status === "new" || l.status === "contacted" || l.status === "in_discussion").length;

        setStats({
          activePolicies,
          totalClients: clientsRes.count || 0,
          pendingPayments: pendingQuotations.length,
          pendingAmount,
          totalRevenue,
          activeLeads,
        });
      } catch (e) {
        console.error("Dashboard stats error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  useSetPageTitle("Dashboard");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          <StatCard
            title="Active Policies"
            value={loading ? "..." : stats.activePolicies}
            icon={FileText}
            variant="primary"
          />
          <StatCard
            title="Total Clients"
            value={loading ? "..." : stats.totalClients}
            icon={Users}
            variant="success"
          />
          <StatCard
            title="Pending Payments"
            value={loading ? "..." : stats.pendingPayments}
            icon={Clock}
            variant="warning"
            subtitle={loading ? "" : `${formatCurrency(stats.pendingAmount)} outstanding`}
          />
          <StatCard
            title="Total Revenue"
            value={loading ? "..." : formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            variant="primary"
          />
          <StatCard
            title="Active Leads"
            value={loading ? "..." : stats.activeLeads}
            icon={Target}
            variant="default"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          <RevenueChart />
          <RenewalWidget />
        </div>

      {isAdmin && <IntermediaryTable />}
    </div>
  );
};

export default Index;
