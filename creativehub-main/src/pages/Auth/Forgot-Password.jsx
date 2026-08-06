import { useState } from 'react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Reset password for:', email);
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
          <h1 className="text-[24px] font-semibold text-[#10001C] mb-[10px]">Reset Password</h1>
          <p className="text-[#000000] text-[16px]">Enter your email address and we'll send you a reset link.</p>
        </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-[#51008B] text-white text-[12px] font-medium py-[16px] px-[20px] rounded-[8px]"
          >
            Send Reset Link
          </button>
        </form>
        {/* Back to login */}
        <div className="text-center mt-[10px]">
          <p className="text-[#000] text-[14px]">
            Remember your password?{' '}
            <button className="text-[#51008B] font-normal">
              Back to Login
            </button>
          </p>
        </div>


        {/* What happens next section */}
        <div className="mt-8 p-4 bg-[#f7f2f8] outline-[#d5c2e3] outline-[1px] rounded-lg">
          <div className="flex gap-[30px] items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
           <img src="/icons/exclamation.svg" alt="alert" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[#51008B] mb-2">What happens next?</h3>
              <ul className="space-y-1 text-[14px] text-[#51008B]">
                <li>• We'll send a secure reset link to your email</li>
                <li>• The link expires in 24 hours for security</li>
                <li>• Check your spam folder if you don't see it</li>
                <li>• Contact support if you need additional help</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}