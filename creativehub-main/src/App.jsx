// App.jsx
// import { useState } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./App.css";
import Signup from "./pages/Auth/Signup";
import ColoredNav from "./components/ColoredNav";
import { Header } from "./components/header";
import Footer from "./components/Footer";
import CreativesRegister from "./pages/Auth/Creatives-Register";
import ResetPassword from "./pages/Auth/Reset-Password";
import Login from "./pages/Auth/Login";
import ForgotPassword from "./pages/Auth/Forgot-Password";
import CheckMail from "./pages/Auth/Check-Mail";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/Auth/Onboarding";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Wallet from "./pages/Wallet";
import Messages from "./pages/Messages";
import Portfolio from "./pages/Portfolio";
import Settings from "./pages/Settings";

// Component to handle conditional header rendering
function AppContent() {
  const location = useLocation();

  // Define which routes should show the header
  const routesWithHeader = ["/dashboard","/jobs","/wallet","/messages","/portfolio","/settings"];

  const shouldShowHeader = routesWithHeader.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      {shouldShowHeader && <Header />}
      <div className="flex-grow">
        <Routes>
          <Route path="*" element={<NotFound />} />
          <Route path="/" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/creatives-register" element={<CreativesRegister />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/check-mail" element={<CheckMail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/wallet" element={<Wallet />} />
             <Route path="/messages" element={<Messages />} />
                 <Route path="/portfolio" element={<Portfolio />} />
                           <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      {/* <Footer /> */}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
