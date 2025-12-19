
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { useEffect } from "react";

import Home from "./pages/Home";
import ColorType from "./pages/ColorType";
import Profile from "./pages/Profile";
import ProfileDashboard from "./pages/ProfileDashboard";
import ProfileLookbooks from "./pages/ProfileLookbooks";
import ProfileHistory from "./pages/ProfileHistory";
import ProfileWallet from "./pages/ProfileWallet";
import ProfileSettings from "./pages/ProfileSettings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SharedLookbook from "./pages/SharedLookbook";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminStats from "./pages/AdminStats";
import AdminUsers from "./pages/AdminUsers";
import AdminLookbooks from "./pages/AdminLookbooks";
import AdminPayments from "./pages/AdminPayments";
import AdminCatalog from "./pages/AdminCatalog";
import AdminGenerations from "./pages/AdminGenerations";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import RegistrationSuccess from "./pages/RegistrationSuccess";
import ReplicateTryOn from "./pages/ReplicateTryOn";
import NotFound from "./pages/NotFound";
import Payment from "./pages/Payment";
import Offer from "./pages/Offer";
import Contacts from "./pages/Contacts";
import Privacy from "./pages/Privacy";
import PersonalData from "./pages/PersonalData";

const APP_VERSION = "2.0.0";

const queryClient = new QueryClient();

const VersionManager = () => {
  useEffect(() => {
    const storedVersion = localStorage.getItem("app_version");
    
    if (storedVersion !== APP_VERSION) {
      console.log(`Обновление приложения: ${storedVersion || 'старая версия'} → ${APP_VERSION}`);
      sessionStorage.clear();
      localStorage.clear();
      localStorage.setItem("app_version", APP_VERSION);
      window.location.reload();
    }
  }, []);
  
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <VersionManager />
    <AuthProvider>
      <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/virtualfitting" element={<ReplicateTryOn />} />
              <Route path="/replicate" element={<Navigate to="/virtualfitting" replace />} />
              <Route path="/colortype" element={<ColorType />} />
            
            {/* Profile Routes */}
            <Route path="/profile" element={<ProfileDashboard />} />
            <Route path="/profile/lookbooks" element={<ProfileLookbooks />} />
            <Route path="/profile/history" element={<ProfileHistory />} />
            <Route path="/profile/wallet" element={<ProfileWallet />} />
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/profile-old" element={<Profile />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/stats" element={<AdminStats />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/lookbooks" element={<AdminLookbooks />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/catalog" element={<AdminCatalog />} />
            <Route path="/admin/generations" element={<AdminGenerations />} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/lookbook/:shareToken" element={<SharedLookbook />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/registration-success" element={<RegistrationSuccess />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/offer" element={<Offer />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/personal-data" element={<PersonalData />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </DataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;