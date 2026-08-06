import React, { useState } from 'react';

// SVG Icon for the logo
const LogoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    className="h-10 w-10 mr-2 text-white"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 10H90V90H10V10ZM0 0V100H100V0H0Z"
      fill="white"
    />
    <path d="M30 70L50 30L70 70H30Z" fill="orange" />
    <path d="M40 70L50 50L60 70H40Z" fill="yellow" />
    <path d="M45 70L50 60L55 70H45Z" fill="red" />
  </svg>
);

// SVG Icon for the hamburger menu
const MenuIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-16 6h16" />
    </svg>
);

// SVG Icon for the close menu
const CloseIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// The Navbar component with sticky positioning
const ColoredNav = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navLinks = [
        { name: 'Explore', href: '#' },
        { name: 'Recent jobs', href: '#' },
        { name: 'Bargain', href: '#', new: true },
        { name: 'Find Talent', href: '#' },
        { name: 'Find Work', href: '#' },
    ];

    return (
        // Using sticky positioning to keep navbar at top while maintaining document flow
        <nav className="bg-[#6E2B9E] shadow-lg w-full sticky top-0 z-50">
            <main className="">
                <div className="flex items-center justify-between h-20">
                    {/* Left side: Hamburger and Logo */}
                    <div className="flex items-center">
                        <div className="md:hidden mr-4">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-[#6E2B9E] focus:outline-none"
                            >
                                <span className="sr-only">Open main menu</span>
                                {isMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                            </button>
                        </div>
                        <div className="flex-shrink-0 flex items-center">
                             <img src="/logo-white-text.svg" alt="logo" />
                        </div>
                    </div>

                    {/* Middle: Desktop Navigation Links */}
                    <div className="hidden md:flex md:items-center md:space-x-8">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className="text-white font-medium text-[16px]  px-3 py-2 rounded-md text-sm font-medium relative"
                            >
                                {link.name}
                                {link.new && (
                                    <span className="absolute -top-2 -right-3 bg-[#00B388] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        New
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>

                    {/* Right side: Sign In Button */}
                    <div className="flex items-center">
                        <button className="text-[#f8f8f8] text-[14px] font-medium bg-transparent border border-[#F8F8F8] rounded-[8px] px-[30px] py-[10px]">
                            Sign In
                        </button>
                    </div>
                </div>
            </main>

            {/* Mobile Menu - Dropdown */}
            {isMenuOpen && (
                <div className="md:hidden bg-[#6E2B9E] border-t border-purple-600">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                             <a
                                key={link.name}
                                href={link.href}
                                className="text-white hover:bg-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                            >
                                {link.name}
                                {link.new && (
                                    <span className="ml-2 bg-[#00B388] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        New
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default ColoredNav;