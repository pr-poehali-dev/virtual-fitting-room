
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { BalanceProvider } from "./context/BalanceContext";
import { useEffect, lazy, Suspense } from "react";
import { startRoutePreload } from "@/utils/routePreloader";

import Home from "./pages/Home";
const ColorType = lazy(() => import("./pages/ColorType"));
const ColorGuideDetail = lazy(() => import("./pages/ColorGuideDetail"));
const ProfileHistoryColorGuide = lazy(() => import("./pages/ProfileHistoryColorGuide"));
const AdminColorGuide = lazy(() => import("./pages/AdminColorGuide"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileDashboard = lazy(() => import("./pages/ProfileDashboard"));
const ProfileLookbooks = lazy(() => import("./pages/ProfileLookbooks"));
const ProfileModels = lazy(() => import("./pages/ProfileModels"));
const ProfileOutfitProfiles = lazy(() => import("./pages/ProfileOutfitProfiles"));
const ProfileHistory = lazy(() => import("./pages/ProfileHistory"));
const ProfileHistoryColortypes = lazy(() => import("./pages/ProfileHistoryColortypes"));
const ProfileHistoryFreegen = lazy(() => import("./pages/ProfileHistoryFreegen"));
const ProfileWallet = lazy(() => import("./pages/ProfileWallet"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const PalettePage = lazy(() => import("./pages/PalettePage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SharedLookbook = lazy(() => import("./pages/SharedLookbook"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminStats = lazy(() => import("./pages/AdminStats"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminLookbooks = lazy(() => import("./pages/AdminLookbooks"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminCatalog = lazy(() => import("./pages/AdminCatalog"));
const AdminGenerations = lazy(() => import("./pages/AdminGenerations"));
const AdminColorTypes = lazy(() => import("./pages/AdminColorTypes"));
const AdminCleanup = lazy(() => import("./pages/AdminCleanup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const RegistrationSuccess = lazy(() => import("./pages/RegistrationSuccess"));
const VkCallback = lazy(() => import("./pages/VkCallback"));
const ReplicateTryOn = lazy(() => import("./pages/ReplicateTryOn"));
const FreeGeneration = lazy(() => import("./pages/FreeGeneration"));
const StyleAnalysis = lazy(() => import("./pages/StyleAnalysis"));
const OutfitSelection = lazy(() => import("./pages/OutfitSelection"));
const GiftSelection = lazy(() => import("./pages/GiftSelection"));
const PerfumeSelection = lazy(() => import("./pages/PerfumeSelection"));
const WeddingSelection = lazy(() => import("./pages/WeddingSelection"));
const KibbeTest = lazy(() => import("./pages/KibbeTest"));
const KibbeResultDetail = lazy(() => import("./pages/KibbeResultDetail"));
const ProfileHistoryKibbe = lazy(() => import("./pages/ProfileHistoryKibbe"));
const AdminKibbe = lazy(() => import("./pages/AdminKibbe"));
const ArchetypeTest = lazy(() => import("./pages/ArchetypeTest"));
const ArchetypeResultDetail = lazy(() => import("./pages/ArchetypeResultDetail"));
const ProfileHistoryArchetype = lazy(() => import("./pages/ProfileHistoryArchetype"));
const AdminArchetype = lazy(() => import("./pages/AdminArchetype"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Payment = lazy(() => import("./pages/Payment"));
const Offer = lazy(() => import("./pages/Offer"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Privacy = lazy(() => import("./pages/Privacy"));
const PersonalData = lazy(() => import("./pages/PersonalData"));
const AiEditor = lazy(() => import("./pages/AiEditor"));
const LenormandDivination = lazy(() => import("./pages/LenormandDivination"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const KnowledgePost = lazy(() => import("./pages/KnowledgePost"));
const AdminKnowledge = lazy(() => import("./pages/AdminKnowledge"));
import ScrollToTop from "./components/ScrollToTop";
import MaintenanceBanner from "./components/MaintenanceBanner";

const APP_VERSION = "2.0.0";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
  </div>
);

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

const RoutePreloader = () => {
  useEffect(() => {
    startRoutePreload();
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <VersionManager />
    <RoutePreloader />
    <AuthProvider>
      <BalanceProvider>
        <DataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <MaintenanceBanner />
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/virtualfitting" element={<ReplicateTryOn />} />
              <Route path="/replicate" element={<Navigate to="/virtualfitting" replace />} />
              <Route path="/freegeneration" element={<FreeGeneration />} />
              <Route path="/colortype" element={<ColorType />} />
            <Route path="/color-guide" element={<Navigate to="/colortype" replace />} />
            <Route path="/style-analysis" element={<StyleAnalysis />} />
            <Route path="/outfit-selection" element={<OutfitSelection />} />
            <Route path="/gift-selection" element={<GiftSelection />} />
            <Route path="/perfume-selection" element={<PerfumeSelection />} />
            <Route path="/wedding-selection" element={<WeddingSelection />} />
            <Route path="/kibbe-test" element={<KibbeTest />} />
            <Route path="/kibbe-result/:id" element={<KibbeResultDetail />} />
            <Route path="/archetype-test" element={<ArchetypeTest />} />
            <Route path="/archetype-result/:id" element={<ArchetypeResultDetail />} />
            <Route path="/color-guide/:id" element={<ColorGuideDetail />} />
            <Route path="/ai-editor" element={<AiEditor />} />
            <Route path="/divination" element={<LenormandDivination />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/knowledge/:slug" element={<KnowledgePost />} />
            
            {/* Profile Routes */}
            <Route path="/profile" element={<ProfileDashboard />} />
            <Route path="/profile/lookbooks" element={<ProfileLookbooks />} />
            <Route path="/profile/models" element={<ProfileModels />} />
            <Route path="/profile/outfit-profiles" element={<ProfileOutfitProfiles />} />
            <Route path="/profile/history" element={<ProfileHistory />} />
            <Route path="/profile/history-colortypes" element={<ProfileHistoryColortypes />} />
            <Route path="/profile/history-colorguide" element={<ProfileHistoryColorGuide />} />
            <Route path="/profile/history-freegen" element={<ProfileHistoryFreegen />} />
            <Route path="/profile/history-kibbe" element={<ProfileHistoryKibbe />} />
            <Route path="/profile/history-archetype" element={<ProfileHistoryArchetype />} />
            <Route path="/profile/wallet" element={<ProfileWallet />} />
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/profile-old" element={<Profile />} />
            <Route path="/palette/:analysisId" element={<PalettePage />} />
            
            {/* Admin Routes */}
            <Route path="/vf-console" element={<AdminLogin />} />
            <Route path="/vf-console/dashboard" element={<AdminDashboard />} />
            <Route path="/vf-console/stats" element={<AdminStats />} />
            <Route path="/vf-console/users" element={<AdminUsers />} />
            <Route path="/vf-console/lookbooks" element={<AdminLookbooks />} />
            <Route path="/vf-console/payments" element={<AdminPayments />} />
            <Route path="/vf-console/catalog" element={<AdminCatalog />} />
            <Route path="/vf-console/generations" element={<AdminGenerations />} />
            <Route path="/vf-console/colortypes" element={<AdminColorTypes />} />
            <Route path="/vf-console/colorguides" element={<AdminColorGuide />} />
            <Route path="/vf-console/kibbe" element={<AdminKibbe />} />
            <Route path="/vf-console/archetype" element={<AdminArchetype />} />
            <Route path="/vf-console/knowledge" element={<AdminKnowledge />} />
            <Route path="/vf-console/cleanup" element={<AdminCleanup />} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/lookbook/:shareToken" element={<SharedLookbook />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/registration-success" element={<RegistrationSuccess />} />
            <Route path="/auth/vk/callback" element={<VkCallback />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/offer" element={<Offer />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/personal-data" element={<PersonalData />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
        </DataProvider>
      </BalanceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;