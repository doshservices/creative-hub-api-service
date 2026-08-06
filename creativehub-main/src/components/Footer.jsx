import React, { useState } from "react";

// --- SVG ICONS ---
// Using separate components for icons to keep the main component cleaner.



const EnvelopeIcon = () => (
  <svg
    className="h-6 w-6 mr-3 text-gray-600"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);


const PlusIcon = () => (
  <svg
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 6v12m6-6H6"
    />
  </svg>
);

const MinusIcon = () => (
  <svg
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M18 12H6"
    />
  </svg>
);

// --- ACCORDION ITEM COMPONENT ---
// A reusable component for the collapsible sections on mobile.
const AccordionItem = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-[#9665BA] flex justify-between items-center py-4 text-left font-semibold"
      >
        <span className="text-[#9665BA] text-[10px] !font-medium">{title}</span>
        {isOpen ? <MinusIcon /> : <PlusIcon />}
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
};

// --- MAIN FOOTER COMPONENT ---
const Footer = () => {
  // Data for the links
  const popularServices = [
    "Ballet Dancer",
    "Sound Engineer",
    "Art Designer",
    "Sound Mixer",
    "MC",
    "Affiliates",
  ];
  const supportLinks = [
    "Contact Us",
    "FAQ",
    "Saved",
    "Locate a Creative",
    "Service Registration",
  ];

  return (
    <footer className="bg-[#f8f8f8] text-gray-800 border-t-[#7e7e7e] border-[1px]">
      <main className="mt-[60px] mb-[53px]">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-12">
          {/* Section 1: Logo and Social (Desktop) */}
          <div className="flex-shrink-0 lg:w-1/4">
            <div className="flex items-center">
              <img src="/logo-colored-text.svg" alt="Logo" />
            </div>
            <div className="hidden lg:flex space-x-4 mt-6">
              <a href="#" aria-label="Facebook">
                <img src="/icons/facebook.svg" alt="Facebook Icon" />
              </a>
              <a href="#" aria-label="Instagram">
                <img src="/icons/insta.svg" alt="Insta Icon" />
              </a>
              <a href="#" aria-label="Twitter">
                <img src="/icons/x.svg" alt="X Icon" />
              </a>
              <a href="#" aria-label="YouTube">
                <img src="/icons/youtube.svg" alt="Youtube Icon" />
              </a>
            </div>
          </div>

          {/* Section 2: Links (Desktop) */}
          <div className="hidden lg:flex lg:w-1/3 lg:justify-around">
            <div>
              <h3 className="font-medium text-[#6a6a6a] mb-[25px]">
                Popular Services
              </h3>
              <ul className="space-y-2">
                {popularServices.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-purple-700">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[#6a6a6a] mb-[25px]">Support</h3>
              <ul className="space-y-2">
                {supportLinks.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-purple-700">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 3: Newsletter Signup */}
          <div className="w-full lg:w-1/3">
            <div className="flex items-center mb-4">
              <EnvelopeIcon />
              <h3 className="font-medium text-[12px] text-[#2D2D2D]">
                Stay up to date on the latest from Creatives Hub
              </h3>
            </div>
            <form>
              <div className="flex flex-col sm:flex-row gap-4 mb-[17px]">
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full !p-[0px] border-b-2 border-[#9665BA] md:border-[#2d2d2d]  outline-none !rounded-[0px] placeholder:text-[#9665BA]  md:placeholder:text-[#2D2D2D] placeholder:text-[13px]"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full !p-[0px] border-b-2 border-[#9665BA] md:border-[#2d2d2d] outline-none !rounded-[0px] placeholder:text-[#9665BA]  md:placeholder:text-[#2D2D2D] placeholder:text-[13px]"
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                className="w-full !p-[0px] border-b-2 border-[#9665BA] md:border-[#2d2d2d] outline-none mb-4 !rounded-[0px] placeholder:text-[#9665BA]  md:placeholder:text-[#2D2D2D] placeholder:text-[13px]"
              />
              <div className="flex items-center mb-6">
                <input
                  type="checkbox"
                  id="privacy"
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded !border-purple-500"
                />
                <label htmlFor="privacy" className="ml-2 text-[10px] text-[#9665BA] md:text-[#2d2d2d]">
                  I have read and accept the{" "}
                  <a href="#" className=" underline">
                    privacy policy
                  </a>
                  .
                </label>
              </div>
              <button
                type="submit"
                className="w-full md:w-[204px] !rounded-[4px] bg-[#6E2B9E] text-white font-normal text-[12px] py-[12px] px-[78px]"
              >
                Sign Up
              </button>
            </form>
          </div>
        </div>

        {/* Accordion Links and Social (Mobile) */}
        <div className="lg:hidden mt-8">
          <AccordionItem title="Popular Services" className="text-[#9665BA]">
            <ul className="space-y-2 pl-4">
              {popularServices.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[#6E2B9E] text-[10px]">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </AccordionItem>
          <AccordionItem title="Support">
            <ul className="space-y-2 pl-4">
              {supportLinks.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[#6E2B9E] text-[10px]">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </AccordionItem>
          {/* <hr className="my-8" /> */}
          <div className="flex justify-center space-x-[20px] mt-[30px]">
            <a href="#" aria-label="Facebook">
              <img src="/icons/facebook.svg" alt="Facebook Icon" />
            </a>
            <a href="#" aria-label="Instagram">
              <img src="/icons/insta.svg" alt="Insta Icon" />
            </a>
            <a href="#" aria-label="Twitter">
              <img src="/icons/x.svg" alt="X Icon" />
            </a>
            <a href="#" aria-label="YouTube">
              <img src="/icons/youtube.svg" alt="Youtube Icon" />
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <div className="bg-[#0A0011] text-white">
        <main className="!py-[20px] flex flex-col sm:flex-row justify-between items-center text-sm">
          <p className="flex items-center mb-2 sm:mb-0 text-[#f8f8f8]">
            © 2023 Creatives Hub All Rights Reserved
          </p>
          <div className="flex space-x-6">
            <a href="#" className="hover:underline">
              Terms and Condition
            </a>
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
          </div>
        </main>
      </div>
    </footer>
  );
};

export default Footer;
