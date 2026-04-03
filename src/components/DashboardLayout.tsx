import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageTitle, PageTitleProvider } from "@/contexts/PageTitleContext";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";

function DashboardLayoutInner() {
  const { theme, toggleTheme } = useTheme();
  const title = usePageTitle();

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full dashboard-scrollbarless">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 md:h-16 flex items-center justify-between border-b border-border px-3 sm:px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground h-9 w-9" />
              {title && (
                <h1 className="text-base sm:text-lg font-semibold text-foreground">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <NotificationBell />
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                AD
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function DashboardLayout() {
  return (
    <PageTitleProvider>
      <DashboardLayoutInner />
    </PageTitleProvider>
  );
}
