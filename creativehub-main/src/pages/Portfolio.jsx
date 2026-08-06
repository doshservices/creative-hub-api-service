import { useState } from 'react';

// Data arrays for the portfolio page
const portfolioCategories = [
  { id: 'videos', label: 'Videos', count: 4, isActive: true },
  { id: 'images', label: 'Images', count: 6, isActive: false },
  { id: 'audio', label: 'Audio', count: 1, isActive: false },
  { id: 'doc', label: 'Doc', count: 2, isActive: false }
];

const portfolioItems = {
  videos: [
    { id: 1, type: 'video', width: 413, height: 210, image: "/images/portfolio-image.png" },
    { id: 2, type: 'video', width: 413, height: 210, image: "/images/portfolio-image.png" },
    { id: 3, type: 'video', width: 413, height: 210, image: "/images/portfolio-image.png" },
    { id: 4, type: 'video', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 5, type: 'video', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 6, type: 'video', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 7, type: 'video', width: 305, height: 210, image: "/images/portfolio-image.png" }
  ],
  images: [
    { id: 1, type: 'image', width: 413, height: 210, image: "/images/portfolio-image.png" },
    { id: 2, type: 'image', width: 413, height: 210, image: "/images/portfolio-image.png" },
    { id: 3, type: 'image', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 4, type: 'image', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 5, type: 'image', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 6, type: 'image', width: 305, height: 210, image: "/images/portfolio-image.png" }
  ],
  audio: [
    { id: 1, type: 'audio', width: 413, height: 210, image: "/images/portfolio-image.png" }
  ],
  doc: [
    { id: 1, type: 'doc', width: 305, height: 210, image: "/images/portfolio-image.png" },
    { id: 2, type: 'doc', width: 305, height: 210, image: "/images/portfolio-image.png" }
  ]
};

// Simplified PlayButton component using the local SVG icon
function PlayButton() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center pointer-events-none">
      <img src="/icons/play-button.svg" alt="Play video" className="w-full h-full" />
    </div>
  );
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('videos');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const currentItems = portfolioItems[activeTab] || [];

  return (
    <div className="bg-[rgba(255,255,255,0.98)] min-h-screen w-full relative">
      {/* Page Header */}
      <div className="px-4 md:px-20 pt-8 md:pt-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="content-stretch flex flex-col items-start mb-4 md:mb-0">
            <h1 className="font-['Montserrat'] font-medium text-black text-xl md:text-2xl mb-1">
              Portfolio
            </h1>
            <p className="font-['Montserrat'] font-normal text-black text-sm md:text-base">
              Showcase your best work, employers often decide based on portfolios.
            </p>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="bg-[#51008b] text-white px-5 py-4 rounded-lg font-['Montserrat'] font-medium text-xs hover:bg-[#51008b]/90 transition-colors"
          >
            + Upload New Work
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 md:px-20 mt-8">
        <div className="bg-[rgba(220,204,232,0.2)] rounded-[4px] p-[10px] flex flex-wrap gap-4 md:gap-10">
          {portfolioCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveTab(category.id)}
              className={`px-[10px] py-[5px] rounded-[4px] transition-colors ${
                activeTab === category.id
                  ? 'bg-[#51008b] text-white'
                  : 'text-[#2d2d2d] hover:bg-white/50'
              }`}
            >
              <span className={`font-['Montserrat'] text-[14px] leading-[24px] ${
                activeTab === category.id ? 'font-medium' : 'font-normal'
              }`}>
                {category.label} ({category.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Grid */}
      <div className="px-4 md:px-20 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentItems.map((item, index) => (
            <div 
              key={item.id} 
              className={`relative rounded-[8px] overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
                index < 3 ? 'col-span-1 md:col-span-1 lg:col-span-1' : 'col-span-1'
              }`}
              style={{ 
                height: '210px',
                maxWidth: index < 3 ? '413px' : '305px',
                width: '100%'
              }}
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[8px]">
                <img 
                  alt="" 
                  className="absolute h-full w-full object-cover" 
                  src={item.image} 
                />
              </div>
              {item.type === 'video' && <PlayButton />}
            </div>
          ))}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.25)] flex items-center justify-center z-50">
          <div className="bg-white rounded-[8px] w-full max-w-[904px] border border-[#51008b] p-[40px] relative">
            {/* Modal Header */}
            <div className="text-center pb-4">
              <h2 className="font-['Montserrat'] font-medium text-[24px] text-black mb-2">
                Upload New Work
              </h2>
              <p className="font-['Montserrat'] font-normal text-[16px] text-black">
                Add to your portfolio to attract more employers
              </p>
            </div>

            {/* Upload Section */}
            <div className="px-10 mt-8">
              <div className="font-['Montserrat'] font-medium text-[14px] text-black mb-4">
                Upload Files
              </div>
              
              {/* Drag and Drop Area */}
              <div 
                className="border-[0.5px] border-dashed border-[rgba(0,0,0,0.8)] rounded-[8px] h-[137px] flex flex-col items-center justify-center gap-[10px] cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  // Handle file selection
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*,video/*,audio/*,.doc,.docx,.pdf';
                  input.onchange = (e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                  };
                  input.click();
                }}
              >
                <button className="border border-[#c5aad8] rounded-[8px] px-5 py-[10px] text-[#c5aad8] font-['Montserrat'] font-medium text-[12px] hover:bg-[#c5aad8] hover:text-white transition-colors">
                  Upload Files
                </button>
                <p className="font-['Montserrat'] font-normal text-[12px] text-black">
                  Images, videos, audio files supported
                </p>
              </div>
            {/* Modal Actions */}
            <div className="bottom-10 mt-[40px] flex gap-6">
              <button 
                onClick={() => setShowUploadModal(false)}
                className="flex-1 border border-[#51008b] rounded-[8px] px-5 py-4 text-[#51008b] font-['Montserrat'] font-medium text-[12px] hover:bg-[#51008b] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Handle upload
                  console.log('Uploading files:', selectedFiles);
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                }}
                className="flex-1 bg-[#51008b] text-white rounded-[8px] px-5 py-4 font-['Montserrat'] font-medium text-[12px] hover:bg-[#51008b]/90 transition-colors"
              >
                Upload
              </button>
            </div>
            </div>

          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-16"></div>
    </div>
  );
}