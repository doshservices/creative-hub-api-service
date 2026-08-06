import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  
  // Cleaned up state (removed signup-specific fields)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login submitted:', formData);
    
    // Add your API Login logic here
    
    // Redirect to dashboard upon success
    navigate('/dashboard');
  };

  return (
    <main className="min-h-screen bg-[url('/images/signup-bg.png')] bg-cover bg-center !py-[60px] flex items-center justify-center relative overflow-hidden">

      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-[80px] items-center relative z-10">
        {/* Left Side - Brand and Content */}
        <div className="text-white space-y-8 lg:pr-12">
          {/* Logo */}
          <div className="flex justify-center items-center ">
            <img src="icons/logo.svg" alt="Logo" className='w-[200px] md:w-[268px]'/>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm text-center rounded-[8px] p-[40px] border border-white/20">
              <h2 className="text-[24px] font-semibold mb-[10px]">Showcase. Connect. Thrive.</h2>
              <p className="text-[16px] font-medium">Join the creative community</p>
            </div>

            <div className="space-y-4 text-center">
              <h3 className="text-[24px] font-semibold">Your creative journey starts here.</h3>
              <p className="text-[16px] font-normal leading-relaxed">
                Showcase your craft, connect with opportunities, and thrive in the
                spotlight of the creative industry.
              </p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-2 gap-[52px] text-[14px]">
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Build a professional profile & portfolio</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Get discovered by verified employers</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Secure bookings with safe payments</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Grow your reputation with reviews</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Collaborate on exciting projects/events</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Access resources to sharpen your craft</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md mx-auto lg:max-w-none">
          <form className="bg-white rounded-[8px] p-[40px] shadow-2xl">
            <div className="text-center mb-[40px]">
              <h2 className="text-[24px] font-bold text-[#10001C] mb-2">Welcome back</h2>
              <p className="text-[16px] text-[#000]">
                Log in to manage your portfolio and opportunities.
              </p>
            </div>

            <div className="space-y-6">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-[#51008B] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-[8px] focus:ring-2 focus:ring-[#51008B] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Submit Button */}
              {/* Added margin bottom to separate from footer link */}
              <div className="mb-6"> 
                <button
                  type="button" // Or "submit" if you handle validation
                  onClick={handleSubmit}
                  className="w-full bg-[#51008B] text-white text-[12px] font-medium py-3 px-6 rounded-[8px] transition-all duration-200 transform hover:scale-[1.02] focus:ring-4 focus:ring-purple-300 focus:outline-none"
                >
                  Log in to your dashboard
                </button>
              </div>

              {/* Sign Up Link */}
              <div className="text-center">
                <p className="text-[14px] text-gray-600">
                  Don't have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => navigate('/signup')} 
                    className="text-[#51008B] font-medium hover:underline"
                  >
                    Sign up here
                  </button>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}