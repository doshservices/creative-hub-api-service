import React, { useState } from "react";
import { Eye, EyeOff, ChevronDown } from "lucide-react";

export default function CreativesRegister() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    country: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);

  const countries = [
    "United States",
    "Canada",
    "United Kingdom",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "Sweden",
    "Norway",
    "Denmark",
    "Switzerland",
    "Austria",
    "Belgium",
    "Portugal",
    "Ireland",
    "Finland",
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCountrySelect = (country) => {
    setFormData((prev) => ({ ...prev, country }));
    setIsCountryOpen(false);
  };

  const handleSubmit = () => {
    console.log("Form submitted:", formData);
  };

  return (
    <main className="mt-[30px] mb-[100px] flex items-center justify-center">
      <div className="w-full">
        {/* Header */}
        <div className="text-right mb-8">
          <a href="#" className="text-[#6E2B9E] text-[14px] font-medium">
            Sign up as a User
          </a>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-[16px] md:text-[26px] font-medium text-[#2d2d2d] mb-[40px] leading-[48px] tracking-[0%]">
            Get listed as a professional sound engineer, <br /> producer, dancer
            etc and get hired for work
          </h1>
        </div>
        {/* Main Form Container */}
        <div className="flex flex-col items-center justify-center">
          <form className="space-y-[20px] w-full md:w-[480px]">
            {/* First Name */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="First name here"
                className="w-full border-[#2D2D2D] border-[.6px] rounded-[4px] focus:ring-2 focus:ring-[#6E2B9E] focus:border-transparent outline-none transition-colors"
              />
            </div>

            {/* Last Name */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Last name here"
                className="w-full border-[#2D2D2D] border-[.6px] rounded-[4px] focus:ring-2 focus:ring-[#6E2B9E] focus:border-transparent outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email address here"
                className="w-full border-[#2D2D2D] border-[.6px] rounded-[4px] focus:ring-2 focus:ring-[#6E2B9E] focus:border-transparent outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password (8 or more characters)"
                  className="w-full border-[#2D2D2D] border-[.6px] rounded-[4px] focus:ring-2 focus:ring-[#6E2B9E] focus:border-transparent outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Country */}
            <div>
              <label
                htmlFor="country"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Country
              </label>
              <div className="relative mb-[62px]">
                <button
                  type="button"
                  onClick={() => setIsCountryOpen(!isCountryOpen)}
                  className="w-full border-[#2D2D2D] border-[.6px] !bg-transparent p-[10px] text-left focus:ring-2 focus:ring-[#6E2B9E] focus:border-transparent outline-none transition-colors"
                >
                  <span
                    className={
                      formData.country
                        ? "text-[#929293] !font-normal"
                        : "text-[#929293] !font-normal"
                    }
                  >
                    {formData.country || "Country here"}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 transition-transform ${
                      isCountryOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isCountryOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {countries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

   <div className="wrapper flex flex-col space-y-[10px]">

         {/* Create Account Button */}
            <button
              onClick={handleSubmit}
              className="w-full bg-[#6E2B9E] !rounded-[4px] text-white py-[10px]  font-medium focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Create Account
            </button>

            {/* Divider */}
  
              <div className="relative flex justify-center text-sm">
                <span className="text-[14px] text-[#2d2d2d]">OR</span>
              </div>
      

            {/* Google Sign In */}
            <button
              type="button"
              className="w-full border !rounded-[4px] border-[#6e2b9f] text-[#6E2B9E] text-[14px] py-[6px] font-medium hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-3"
            >
             <img src="/icons/google.svg" alt="Google Icon" className="w-6 h-6"/>
         
              Continue with Google
            </button>

            {/* Login Link */}
            <div className="text-center mt-[10px] text-[12px]">
              <span className="text-[#2d2d2d]">Already have an account? </span>
              <a
                href="#"
                className="text-[#6E2B9E] font-medium"
              >
                Log In
              </a>
            </div>


   </div>
          </form>
        </div>
      </div>
    </main>
  );
}
