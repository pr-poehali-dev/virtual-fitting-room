
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useEffect } from "react";

import ColorType from "./pages/ColorType";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SharedLookbook from "./pages/SharedLookbook";
import Admin from "./pages/Admin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import RegistrationSuccess from "./pages/RegistrationSuccess";
import ReplicateTryOn from "./pages/ReplicateTryOn";
import NotFound from "./pages/NotFound";
import Payment from "./pages/Payment";
import Offer from "./pages/Offer";
import Contacts from "./pages/Contacts";

const APP_VERSION = "2.0.0";

const queryClient = new QueryClient();

const VersionManager = () => {
  useEffect(() => {
    const storedVersion = localStorage.getItem("app_version");
    
    if (storedVersion !== APP_VERSION) {
      console.log(`Обновление приложения: ${storedVersion || 'старая версия'} → ${APP_VERSION}`);
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ReplicateTryOn />} />
            <Route path="/replicate" element={<Navigate to="/" replace />} />
            <Route path="/colortype" element={<ColorType />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/lookbook/:shareToken" element={<SharedLookbook />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/registration-success" element={<RegistrationSuccess />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/offer" element={<Offer />} />
            <Route path="/contacts" element={<Contacts />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;