import React from "react";

export default function CheckMail() {
  return (
    <main className="relative min-h-screen bg-[url('/images/forgot-pass.png')] bg-cover bg-center  w-full flex items-center justify-center bg-[#2d1a47] overflow-hidden p-4">
      {/* Centered content card */}
      <div className="relative z-10 bg-white rounded-[8px] shadow-2xl p-[20px] md:p-[40px] w-full md:w-[573px] text-center">
        <div className="flex space-y-[40px] flex-col items-center">
          {/* Logo and Brand Name */}
          <div className="flex items-center gap-3">
            <img src="/icons/logo-purple.svg" alt="Logo" />
          </div>

          <div>
            {/* Main Title */}
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Check Your Email
            </h1>

            {/* Subtitle with user email */}
            <p className="mt-[10px] text-[#000000] text-[14px] font-normal">
              We've sent a password reset link to&nbsp;
              <span className="">lillworms@gmail.com</span>
            </p>
          </div>

          {/* Action Button */}
          <button className="w-full bg-[#51008B] text-white text-[12px] font-medium py-[16px] rounded-[8px]">
            Back to Login
          </button>
        </div>
      </div>
    </main>
  );
}
