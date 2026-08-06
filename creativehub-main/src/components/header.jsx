import { useState } from "react";
import { Bell, User, Menu, X } from "lucide-react";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Get the current page's path from the browser's URL
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Define navigation links as an array for easier mapping
  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/jobs", label: "Jobs" },
    { href: "/messages", label: "Messages" },
    { href: "/wallet", label: "Wallet" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#51008B] shadow-lg py-[25px]">
      <main className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/icons/logo-text-purple.svg" alt="Logo" />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-[#51008b] font-medium"
                  : "text-[#000000] hover:text-[#51008b] transition-colors"
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop User Actions */}
        <div className="hidden sm:flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-[#000000]" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <User className="w-5 h-5 text-[#000000]" />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 text-[#000000]" /> : <Menu className="w-6 h-6 text-[#000000]" />}
        </button>
      </main>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden mt-4 py-4 border-t border-gray-200 bg-white">
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={
                  pathname === link.href
                    ? "text-[#51008b] font-medium px-2 py-1"
                    : "text-[#000000] hover:text-[#51008b] transition-colors px-2 py-1"
                }
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Mobile User Actions */}
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-200">
            <button className="flex items-center gap-2 text-[#000000] hover:text-[#51008b] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="text-sm">Notifications</span>
            </button>
            <button className="flex items-center gap-2 text-[#000000] hover:text-[#51008b] transition-colors">
              <User className="w-5 h-5" />
              <span className="text-sm">Profile</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
