import { useState, useCallback, useRef } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Table as TableIcon, FileSpreadsheet, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV, downloadPDFWithCharts, downloadExcelWithSummary } from "@/lib/exportUtils";
import type { SummarySection } from "@/lib/exportUtils";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type ReportType = "premium_commission" | "renewals" | "performance" | "policy_status";

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;

interface RawReportRow {
  policy_number?: string | null;
  policy_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  renewal_status?: string | null;
  premium_amount?: number | string | null;
  commission_rate?: number | string | null;
  commission_amount?: number | string | null;
  created_at?: string | null;
  policies?: { policy_number?: string | null } | null;
  profiles?: { full_name?: string | null; intermediary_code?: string | null } | null;
  clients?: { full_name?: string | null } | null;
  insurers?: { name?: string | null } | null;
  error?: string;
}

interface BarDatum {
  name: string;
  amount: number;
}

interface PieDatum {
  name: string;
  value: number;
}

interface ChartSeries {
  barData: BarDatum[];
  pieData: PieDatum[] | null;
  barLabel: string;
}

const Reports = () => {
  useSetPageTitle("Reports Central");

  const [loadingFormat, setLoadingFormat] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [reportType, setReportType] = useState<ReportType>("premium_commission");
  const hiddenChartRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [chartData, setChartData] = useState<RawReportRow[] | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  const transformData = useCallback((data: RawReportRow[], type: ReportType): ExportRow[] => {
    switch (type) {
      case "premium_commission":
        return data.map(d => ({
          "Policy #": d.policies?.policy_number || "N/A",
          "Intermediary": d.profiles?.full_name || "N/A",
          "Premium": d.premium_amount,
          "Commission %": `${d.commission_rate}%`,
          "Commission Earned": d.commission_amount,
          "Status": d.status,
        }));
      case "renewals":
        return data.map(d => ({
          "Policy #": d.policy_number,
          "Type": d.policy_type,
          "Client": d.clients?.full_name || "N/A",
          "Expiry Date": d.end_date,
          "Status": d.renewal_status,
          "Premium": d.premium_amount,
        }));
      case "performance":
        return data.map(d => ({
          "Policy #": d.policy_number,
          "Intermediary": d.profiles?.full_name || "N/A",
          "Agent Code": d.profiles?.intermediary_code || "N/A",
          "Premium Volume": d.premium_amount,
          "Created Date": format(new Date(d.created_at), "PP"),
        }));
      case "policy_status":
        return data.map(d => ({
          "Policy #": d.policy_number,
          "Client": d.clients?.full_name || "N/A",
          "Insurer": d.insurers?.name || "N/A",
          "Status": d.status,
          "Start Date": d.start_date,
          "End Date": d.end_date,
        }));
      default:
        return [];
    }
  }, []);

  const PIE_COLORS = [
    "hsl(var(--primary))",
    "hsl(220, 70%, 50%)",
    "hsl(160, 60%, 45%)",
    "hsl(40, 90%, 50%)",
    "hsl(0, 70%, 50%)",
    "hsl(280, 60%, 55%)",
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: 12,
  };

  const buildChartSeries = useCallback((rawData: RawReportRow[], type: ReportType): ChartSeries => {
    switch (type) {
      case "premium_commission": {
        const byIntermediary = new Map<string, number>();
        rawData.forEach(d => {
          const name = d.profiles?.full_name || "Unknown";
          byIntermediary.set(name, (byIntermediary.get(name) || 0) + Number(d.commission_amount || 0));
        });
        const barData = Array.from(byIntermediary, ([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount).slice(0, 10);
        const byStatus = new Map<string, number>();
        rawData.forEach(d => {
          const s = d.status || "unknown";
          byStatus.set(s, (byStatus.get(s) || 0) + 1);
        });
        const pieData = Array.from(byStatus, ([name, value]) => ({ name, value }));
        return { barData, pieData, barLabel: "Commission Amount" };
      }
      case "renewals": {
        const byStatus = new Map<string, number>();
        rawData.forEach(d => {
          const s = d.renewal_status || d.status || "unknown";
          byStatus.set(s, (byStatus.get(s) || 0) + 1);
        });
        const pieData = Array.from(byStatus, ([name, value]) => ({ name, value }));
        const byType = new Map<string, number>();
        rawData.forEach(d => {
          const t = d.policy_type || "Other";
          byType.set(t, (byType.get(t) || 0) + Number(d.premium_amount || 0));
        });
        const barData = Array.from(byType, ([name, amount]) => ({ name, amount }));
        return { barData, pieData, barLabel: "Premium Amount" };
      }
      case "performance": {
        const byIntermediary = new Map<string, number>();
        rawData.forEach(d => {
          const name = d.profiles?.full_name || "Unknown";
          byIntermediary.set(name, (byIntermediary.get(name) || 0) + Number(d.premium_amount || 0));
        });
        const barData = Array.from(byIntermediary, ([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount).slice(0, 10);
        return { barData, pieData: null, barLabel: "Premium Volume" };
      }
      case "policy_status": {
        const byStatus = new Map<string, number>();
        rawData.forEach(d => {
          byStatus.set(d.status || "unknown", (byStatus.get(d.status || "unknown") || 0) + 1);
        });
        const pieData = Array.from(byStatus, ([name, value]) => ({ name, value }));
        const byInsurer = new Map<string, number>();
        rawData.forEach(d => {
          const name = d.insurers?.name || "Unknown";
          byInsurer.set(name, (byInsurer.get(name) || 0) + Number(d.premium_amount || 0));
        });
        const barData = Array.from(byInsurer, ([name, amount]) => ({ name, amount }));
        return { barData, pieData, barLabel: "Premium Amount" };
      }
      default:
        return { barData: [], pieData: null, barLabel: "Value" };
    }
  }, []);

  const handleGenerateCharts = async () => {
    setChartLoading(true);
    setChartData(null);
    try {
      const rawData = await fetchReportData();
      if (rawData) setChartData(rawData);
    } finally {
      setChartLoading(false);
    }
  };

  const buildSummaryData = useCallback((rawData: RawReportRow[], type: ReportType): SummarySection[] => {
    const { barData, pieData, barLabel } = buildChartSeries(rawData, type);
    const sections: SummarySection[] = [];
    if (barData.length > 0) {
      sections.push({
        label: `${barLabel} Breakdown`,
        rows: barData.map(d => ({ Name: d.name, Amount: d.amount })),
      });
    }
    if (pieData && pieData.length > 0) {
      const total = pieData.reduce((s, d) => s + d.value, 0);
      sections.push({
        label: "Status Distribution",
        rows: pieData.map(d => ({
          Status: d.name,
          Count: d.value,
          Percentage: `${total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%`,
        })),
      });
    }
    return sections;
  }, [buildChartSeries]);

  const captureChartImage = async (rawData: RawReportRow[]): Promise<string | null> => {
    // Set chart data to trigger hidden chart render
    setChartData(rawData);
    // Wait for React to render the hidden chart
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!hiddenChartRef.current) return null;
    try {
      const canvas = await html2canvas(hiddenChartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      return canvas.toDataURL("image/png");
    } catch (err) {
      console.error("Chart capture failed:", err);
      return null;
    }
  };

  const getPdfColumns = (type: ReportType) => {
    switch (type) {
      case "premium_commission":
        return [
          { header: "Policy #", dataKey: "Policy #" },
          { header: "Intermediary", dataKey: "Intermediary" },
          { header: "Premium", dataKey: "Premium" },
          { header: "Comm %", dataKey: "Commission %" },
          { header: "Comm Earned", dataKey: "Commission Earned" },
          { header: "Status", dataKey: "Status" },
        ];
      case "renewals":
        return [
          { header: "Policy #", dataKey: "Policy #" },
          { header: "Type", dataKey: "Type" },
          { header: "Client", dataKey: "Client" },
          { header: "Expiry Date", dataKey: "Expiry Date" },
          { header: "Status", dataKey: "Status" },
          { header: "Premium", dataKey: "Premium" },
        ];
      case "performance":
        return [
          { header: "Policy #", dataKey: "Policy #" },
          { header: "Intermediary", dataKey: "Intermediary" },
          { header: "Code", dataKey: "Agent Code" },
          { header: "Premium Volume", dataKey: "Premium Volume" },
          { header: "Date", dataKey: "Created Date" },
        ];
      case "policy_status":
        return [
          { header: "Policy #", dataKey: "Policy #" },
          { header: "Client", dataKey: "Client" },
          { header: "Insurer", dataKey: "Insurer" },
          { header: "Status", dataKey: "Status" },
          { header: "Expiration", dataKey: "End Date" },
        ];
      default:
        return [];
    }
  };

  const fetchReportData = async (): Promise<RawReportRow[] | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to generate reports.");
        return null;
      }

      const payload = {
        reportType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const { data, error } = await supabase.functions.invoke("fetch-report-data", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch report data from server.");
      }
      
      const parsedData: unknown = typeof data === "string" ? JSON.parse(data) : data;
      if (parsedData && typeof parsedData === "object" && "error" in parsedData) {
        const errorMessage = (parsedData as RawReportRow).error || "Unknown server error";
        throw new Error(errorMessage);
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
         toast.info("No data found for this report type / date range.");
         return null;
      }
      return parsedData as RawReportRow[];
    } catch (err: unknown) {
      console.error("fetchReportData error:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(message);
      return null;
    }
  };

  const handleExport = async (formatType: "pdf" | "excel" | "csv") => {
    if (loadingFormat) return;
    setLoadingFormat(formatType);

    try {
      const rawData = await fetchReportData();
      if (!rawData) return;

      const flatData = transformData(rawData, reportType);
      const titleMap: Record<ReportType, string> = {
        premium_commission: "Premium & Commission Report",
        renewals: "Upcoming Renewals Report",
        performance: "Intermediary Performance Report",
        policy_status: "Policy Status Overview"
      };

      const fileName = `${reportType}_report_${format(new Date(), "yyyyMMdd")}`;
      const reportTitle = titleMap[reportType] || "Report";

      switch (formatType) {
        case "csv":
          downloadCSV(flatData, fileName);
          break;
        case "excel": {
          const summaryData = buildSummaryData(rawData, reportType);
          downloadExcelWithSummary(flatData, fileName, summaryData);
          break;
        }
        case "pdf": {
          const chartImage = await captureChartImage(rawData);
          downloadPDFWithCharts(flatData, getPdfColumns(reportType), fileName, reportTitle, chartImage);
          break;
        }
      }
      toast.success(`Successfully exported ${fileName}.${formatType} with ${flatData.length} records!`);
    } finally {
      setLoadingFormat(null);
    }
  };

  const PRINT_PIE_COLORS = ["#3b82f6", "#6366f1", "#22c55e", "#eab308", "#ef4444", "#a855f7"];

  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Hidden off-screen chart container for PDF capture */}
      {chartData && chartData.length > 0 && (() => {
        const { barData, pieData, barLabel } = buildChartSeries(chartData, reportType);
        return (
          <div
            ref={hiddenChartRef}
            style={{ position: "absolute", left: "-9999px", top: 0, width: "800px", background: "#ffffff", padding: "16px" }}
          >
            <div style={{ display: "flex", gap: "24px" }}>
              {barData.length > 0 && (
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{barLabel} Breakdown</p>
                  <BarChart width={pieData ? 370 : 760} height={300} data={barData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                      tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + "..." : v}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </div>
              )}
              {pieData && pieData.length > 0 && (
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Status Distribution</p>
                  <PieChart width={370} height={300}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((_, idx: number) => (
                        <Cell key={idx} fill={PRINT_PIE_COLORS[idx % PRINT_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Generate Analytical Reports</CardTitle>
          <CardDescription>Select a report type, date range, and preferred export format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Report Type</label>
              <Select value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setChartData(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium_commission">Premium & Commission Report</SelectItem>
                  <SelectItem value="renewals">Renewals List</SelectItem>
                  <SelectItem value="performance">Intermediary Performance</SelectItem>
                  <SelectItem value="policy_status">General Policy Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date From</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date To</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Generate Charts Button */}
          <div className="flex items-center">
            <Button onClick={handleGenerateCharts} disabled={chartLoading} className="w-full md:w-auto">
              {chartLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
              Generate Charts
            </Button>
          </div>

          {/* Charts Section */}
          {chartData && chartData.length > 0 && (() => {
            const { barData, pieData, barLabel } = buildChartSeries(chartData, reportType);
            return (
              <div className="space-y-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Showing {chartData.length} records
                </p>
                <div className={`grid gap-6 ${pieData ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                  {barData.length > 0 && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{barLabel} Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} barSize={24}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis
                                dataKey="name"
                                tick={{ className: "fill-muted-foreground", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                angle={-25}
                                textAnchor="end"
                                height={60}
                                tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + "..." : v}
                              />
                              <YAxis
                                tick={{ className: "fill-muted-foreground", fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                              />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, barLabel]}
                              />
                              <Bar dataKey="amount" className="fill-primary" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {pieData && pieData.length > 0 && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                innerRadius={50}
                                paddingAngle={2}
                                label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {pieData.map((_, idx: number) => (
                                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            );
          })()}

          <hr className="my-6" />

          {/* Actions */}
          <div className="flex flex-col md:flex-row items-center justify-end gap-4">
            <span className="text-sm text-foreground/50 mr-auto">
              Extract up to limits permitted by access permissions.
            </span>
            <Button
              variant="outline"
              disabled={loadingFormat !== null}
              onClick={() => handleExport("pdf")}
              className="w-full md:w-auto"
            >
              {loadingFormat === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4 text-red-500" />}
              Export PDF
            </Button>
            <Button
              variant="outline"
              disabled={loadingFormat !== null}
              onClick={() => handleExport("excel")}
              className="w-full md:w-auto"
            >
              {loadingFormat === "excel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />}
              Export Excel
            </Button>
            <Button
              disabled={loadingFormat !== null}
              onClick={() => handleExport("csv")}
              className="w-full md:w-auto"
            >
              {loadingFormat === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TableIcon className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
