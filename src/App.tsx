import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Clients from "./pages/Clients";
import Policies from "./pages/Policies";
import Quotations from "./pages/Quotations";
import Renewals from "./pages/Renewals";
import Leads from "./pages/Leads";
import Insurers from "./pages/Insurers";
import Commissions from "./pages/Commissions";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/policies" element={<ProtectedRoute><Policies /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
            <Route path="/renewals" element={<ProtectedRoute><Renewals /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/insurers" element={<ProtectedRoute allowedRoles={["super_admin"]}><Insurers /></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute allowedRoles={["super_admin"]}><Commissions /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={["super_admin"]}><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
