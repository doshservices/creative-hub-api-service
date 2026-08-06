import React from 'react';

const Choice = () => {
  return (
    <section className="bg-gray-50 py-16 px-4 !overflow-y-auto mt-[80px] mb-[80px]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[40px] lg:gap-[100px]">
          
          {/* FOR USERS Card */}
          <div className="relative">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-16 h-16 border-l-4 border-t-4 border-[#FF8200] rounded-tl-[6px]"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-r-4 border-t-4 border-[#FF8200] rounded-tr-[6px]"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-l-4 border-b-4 border-[#FF8200] rounded-bl-[6px]"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-r-4 border-b-4 border-[#FF8200] rounded-br-[6px]"></div>
            
            {/* Card Content */}
            <div className=" p-12 mx-8 my-8 text-center min-h-[300px] flex flex-col justify-center">
              <h2 className="text-[21px] font-bold text-[#2d2d2d] mb-[30px] tracking-wide">
                FOR USERS
              </h2>
              <p className="text-[#565757] text-[16px] font-medium leading-relaxed mb-8 max-w-md mx-auto !text-center">
                Hire professional sound engineers, producers, dancers etc to work on your next project
              </p>
              <button className="bg-[#6E2B9E] !rounded-[4px] text-white font-normal py-[8px] px-[59px] mx-auto">
                SIGN UP
              </button>
            </div>
          </div>

          {/* FOR CREATIVES Card */}
          <div className="relative">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-16 h-16 border-l-4 border-t-4 border-[#6E2B9E] rounded-tl-[6px]"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-r-4 border-t-4 border-[#6E2B9E] rounded-tr-[6px]"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-l-4 border-b-4 border-[#6E2B9E] rounded-bl-[6px]"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-r-4 border-b-4 border-[#6E2B9E] rounded-br-[6px]"></div>
            
            {/* Card Content */}
            <div className=" p-12 mx-8 my-8 text-center min-h-[300px] flex flex-col justify-center">
              <h2 className="text-[21px] font-bold text-[#2d2d2d] mb-[30px] tracking-wide">
                FOR CREATIVES
              </h2>
              <p className="text-[#565757] text-[16px] font-medium leading-relaxed mb-8 max-w-md mx-auto !text-center">
                Get listed as a professional sound engineer, producer, dancer etc and get hired for work
              </p>
              <button className="bg-[#FF8200] !rounded-[4px] text-white font-normal py-[8px] px-[59px] mx-auto">
                SIGN UP
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Choice;