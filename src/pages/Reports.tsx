import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useSetPageTitle } from "@/contexts/PageTitleContext";

const Reports = () => {
  useSetPageTitle("Reports");

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="border-border/50 max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="p-4 rounded-full bg-primary/10">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Reports — Coming Soon</h2>
          <p className="text-sm text-muted-foreground">
            Advanced analytics and reporting features will be available in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
