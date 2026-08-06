import React from 'react';
export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[url('/images/forgot-pass.png')] bg-cover bg-center w-full flex items-center justify-center bg-[#2d1a47] overflow-hidden p-4">

      
      {/* Centered content card with glassmorphism and animation */}
      <div 
        className="relative z-10 rounded-2xl shadow-2xl p-8 md:p-12 w-full max-w-md text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          animation: 'float 6s ease-in-out infinite'
        }}
      >
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
            25% { transform: translateY(-8px) translateX(3px) rotate(0.5deg); }
            50% { transform: translateY(0px) translateX(-2px) rotate(-0.3deg); }
            75% { transform: translateY(5px) translateX(2px) rotate(0.2deg); }
          }
        `}</style>
        
        <div className="flex flex-col items-center">
          {/* Logo and Brand Name */}
          <div className="flex items-center gap-3 w-[200px] mb-6">
      
           <img src="/icons/logo.svg" alt="" />
        
          </div>

          {/* Main Title */}
          <h1 className="text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
            404
          </h1>
          <h2 className="text-3xl font-bold text-white mt-2 drop-shadow-md">
            Page Not Found
          </h2>

          {/* Subtitle with user email */}
          <p className="mt-4 text-gray-200">
            YO!, the page you are looking for does not exist. It might have been moved or deleted.
          </p>

          {/* Action Button */}
          <button className="w-full mt-8 bg-[#6f42c1] hover:bg-[#5a34a0] text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6f42c1] backdrop-blur-sm">
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}