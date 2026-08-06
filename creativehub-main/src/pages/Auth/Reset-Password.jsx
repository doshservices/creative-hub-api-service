import { useState } from "react";

export default function ResetPassword() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log("Reset password for:", email);
  };

  return (
    <main className="min-h-screen bg-[url('/images/forgot-pass.png')] bg-cover bg-center flex items-center justify-center relative overflow-hidden">
      {/* Main content card */}
      <div className="bg-white rounded-[8px] shadow-2xl p-8 mx-4 relative z-10 w-full md:w-[573px]">
        {/* Logo/Brand */}
        <div className="flex items-center justify-center mb-8">
          <img src="/icons/logo-purple.svg" alt="Logo" />
        </div>

        {/* Form */}
        <form className="space-y-[40px]">
          {/* Form header */}
          <div className="text-center mb-8">
            <h1 className="text-[24px] font-medium text-[#10001C] mb-[10px]">
              Reset Password
            </h1>
            <p className="text-[#000000] text-[14px] font-normal">
            Create a new secure password for your account
            </p>
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              New Password
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Create your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#51008B] focus:border-transparent outline-none transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirm Password
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#51008B] focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-[#51008B] text-white text-[12px] font-medium py-[16px] px-[20px] rounded-[8px]"
          >
           Reset Password
          </button>
        </form>
      </div>
    </main>
  );
}
