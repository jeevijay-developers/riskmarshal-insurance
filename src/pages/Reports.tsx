import { useState, useCallback } from "react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Table as TableIcon, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadPDF, downloadExcel, downloadCSV } from "@/lib/exportUtils";
import { format } from "date-fns";

const Reports = () => {
  useSetPageTitle("Reports Central");

  const [loadingFormat, setLoadingFormat] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [reportType, setReportType] = useState<string>("premium_commission");

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const transformData = useCallback((data: any[], type: string) => {
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
        return data;
    }
  }, []);

  const getPdfColumns = (type: string) => {
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

  const fetchReportData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload = {
        reportType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const { data, error } = await supabase.functions.invoke("fetch-report-data", {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        // If the edge function returns an error structure inside `data` (like { error: 'message' })
        // supabase.functions.invoke might catch the HTTP error code, but let's be thorough.
        throw new Error(error.message || "Failed to fetch report data");
      }
      
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsedData?.error) throw new Error(parsedData.error);
      
      if (!parsedData || parsedData.length === 0) {
         toast.info("No data found for this date range.");
         return null;
      }
      return parsedData;
    } catch (err: any) {
      console.error("fetchReportData error:", err);
      toast.error(err.message || "An error occurred");
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
      const titleMap: any = {
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
        case "excel":
          downloadExcel(flatData, fileName);
          break;
        case "pdf":
          downloadPDF(flatData, getPdfColumns(reportType), fileName, reportTitle);
          break;
      }
      toast.success(`Successfully exported ${fileName}.${formatType} with ${flatData.length} records!`);
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
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
              <Select value={reportType} onValueChange={setReportType}>
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
