import React from 'react';



export default function VerifyEmail() {
  // You can pass the user's email as a prop from your application's state
  const userEmail = "shai.hulud@gmail.com";

  return (
    <main className="mt-[40px] mb-[80px]">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full md:w-[635px] text-center space-y-[40px]">
          
          {/* Icon */}
          <div className='flex flex-row items-center justify-center'>
          <img src="/icons/email-icon.png" alt="Mail icon" />
          </div>

          {/* Main Heading */}
          <div className="space-y-2 flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800">
              Verify your email to proceed
            </h1>
            <p className="text-[#2d2d2d] text-[16px] font-normal">
              We just sent an email to the address: <span className="!font-semibold">{userEmail}</span>
            </p>
            <p className="text-[#2d2d2d] text-[16px] font-normal">
              Please check your email and click on the link provided to verify your address.
            </p>
          </div>

          {/* Action Buttons and Links */}
          <div className="space-y-[30px] w-full">
            {/* Primary Button */}
            <button
              type="button"
              className="w-full flex justify-center rounded-[4px] py-[6px] border border-transparent text-[14px] font-medium text-white bg-[#6E2B9E]"
            >
              Open my Gmail
            </button>

            {/* Secondary Button */}
            <button
              type="button"
              className="w-full flex justify-center rounded-[4px] py-[6px] border border-[#6E2B9E] text-[14px] font-medium text-[#6E2B9E]"
            >
              Resend Verification Email
            </button>

            {/* Tertiary Link */}
            <a href="#" className="font-medium text-[#6E2B9E] text-[#6E2B9E] text-[14px]">
              Change Email Address
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}
