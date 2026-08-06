import { useState } from "react";
import { Bell, User, MapPin, DollarSign, Clock, Search } from "lucide-react";

export default function Jobs() {
  const [activeTab, setActiveTab] = useState("available");

  // Job data for Available Jobs tab
  const availableJobs = [
    {
      id: 1,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      description:
        "Looking for energetic dancers for an upcoming music video shoot. Experience in contemporary and hip-hop styles preferred.",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      title: "Video Editor for YouTube Channel",
      company: "Creative Studios",
      location: "Remote",
      payment: "$200 per video",
      duration: "Ongoing project",
      description:
        "Seeking a skilled video editor for weekly YouTube content. Must be proficient in Adobe Premiere Pro and After Effects.",
      timestamp: "2 hours ago",
    },
    {
      id: 3,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      description:
        "Looking for energetic dancers for an upcoming music video shoot. Experience in contemporary and hip-hop styles preferred.",
      timestamp: "2 hours ago",
    },
    {
      id: 4,
      title: "Video Editor for YouTube Channel",
      company: "Creative Studios",
      location: "Remote",
      payment: "$200 per video",
      duration: "Ongoing project",
      description:
        "Seeking a skilled video editor for weekly YouTube content. Must be proficient in Adobe Premiere Pro and After Effects.",
      timestamp: "2 hours ago",
    },
  ];

  // Application data for My Applications tab
  const myApplications = [
    {
      id: 1,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      status: "Pending Review",
      statusColor: "text-orange-500",
      timestamp: "Applied 2 hours ago",
    },
    {
      id: 2,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      status: "Interview Requested",
      statusColor: "text-green-500",
      message:
        "We'd like to schedule an interview. Please check your messages.",
      actionText: "Message",
      timestamp: "Applied 2 hours ago",
    },
    {
      id: 3,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      status: "Accepted",
      statusColor: "text-green-500",
      message: "Congratulations! You've been selected for this project.",
      actionText: "View Contract",
      timestamp: "Applied 2 hours ago",
    },
    {
      id: 4,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "3 days duration",
      status: "Not Selected",
      statusColor: "text-red-500",
      message:
        "Thank you for your application. We've decided to go with another candidate.",
      timestamp: "Applied 2 hours ago",
    },
  ];

  // Active contracts data
  const activeContracts = [
    {
      id: 1,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "March 10, 2024 - March 12, 2024",
      status: "Active",
      statusColor: "text-[#00B388]",
    },
    {
      id: 2,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "March 10, 2024 - March 12, 2024",
      status: "Active",
      statusColor: "text-[#00B388]",
    },
    {
      id: 3,
      title: "Dance Crew Needed for Music Video",
      company: "Lagos Entertainment",
      location: "Lagos, Nigeria",
      payment: "₦100,000",
      duration: "March 10, 2024 - March 12, 2024",
      status: "Active",
      statusColor: "text-[#00B388]",
    },
  ];

  return (
    <div className="bg-[#fbfbfb] py-[40px]">
      {/* Main Content */}
      <main>
        {/* Page Header */}
        <div className="mb-8 lg:mb-16">
          <h1 className="text-xl lg:text-[24px] font-medium text-black mb-1">
            Jobs
          </h1>
          <p className="text-[16px] font-normal text-black">
            Find opportunities and manage your applications
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="relative mb-8 lg:mb-12">
          <div className="flex flex-wrap items-center gap-4 lg:gap-10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("available")}
              className={`relative pb-2.5 text-sm lg:text-base font-medium whitespace-nowrap transition-colors duration-200 ${
                activeTab === "available"
                  ? "text-[#51008B]"
                  : "text-black hover:text-[#51008B]"
              }`}
            >
              Available Jobs
              {/* Tab indicator line */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-[4px] transition-all duration-200 ${
                  activeTab === "available" ? "bg-[#51008B]" : "bg-transparent"
                }`}
              />
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className={`relative pb-2.5 text-sm lg:text-base font-medium whitespace-nowrap transition-colors duration-200 ${
                activeTab === "applications"
                  ? "text-[#51008B]"
                  : "text-black hover:text-[#51008B]"
              }`}
            >
              My Applications
              {/* Tab indicator line */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-[4px] transition-all duration-200 ${
                  activeTab === "applications"
                    ? "bg-[#51008B]"
                    : "bg-transparent"
                }`}
              />
            </button>
            <button
              onClick={() => setActiveTab("contracts")}
              className={`relative pb-2.5 text-sm lg:text-base font-medium whitespace-nowrap transition-colors duration-200 ${
                activeTab === "contracts"
                  ? "text-[#51008B]"
                  : "text-black hover:text-[#51008B]"
              }`}
            >
              Active Contracts
              {/* Tab indicator line */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-[4px] transition-all duration-200 ${
                  activeTab === "contracts" ? "bg-[#51008B]" : "bg-transparent"
                }`}
              />
            </button>
          </div>
          {/* Thin middle line spanning full width */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300 z-0" />
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 mb-6 lg:mb-8 w-full">
          <div className="flex items-center gap-2 px-4 lg:px-5 py-3 lg:py-4 border border-black/80 rounded-lg bg-white w-full lg:w-[493px]">
            <Search className="w-4 h-4 text-black/60 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search for jobs"
              className="flex-1 text-xs text-black/60 bg-transparent outline-none placeholder:text-black/60"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-5 w-full lg:flex-1">
            <div className="flex items-center px-4 lg:px-5 py-3 lg:py-4 border border-black/80 rounded-lg bg-white w-full">
              <select className="w-full text-xs text-black/60 bg-transparent outline-none appearance-none">
                <option value="">Category</option>
                <option value="dance">Dance</option>
                <option value="video-editing">Video Editing</option>
                <option value="photography">Photography</option>
                <option value="music">Music</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div className="flex items-center px-4 lg:px-5 py-3 lg:py-4 border border-black/80 rounded-lg bg-white w-full">
              <select className="w-full text-xs text-black/60 bg-transparent outline-none appearance-none">
                <option value="">Locations</option>
                <option value="lagos">Lagos, Nigeria</option>
                <option value="remote">Remote</option>
                <option value="abuja">Abuja, Nigeria</option>
                <option value="port-harcourt">Port Harcourt, Nigeria</option>
                <option value="international">International</option>
              </select>
            </div>
            <div className="flex items-center px-4 lg:px-5 py-3 lg:py-4 border border-black/80 rounded-lg bg-white w-full">
              <select className="w-full text-xs text-black/60 bg-transparent outline-none appearance-none">
                <option value="">Budget</option>
                <option value="0-50000">₦0 - ₦50,000</option>
                <option value="50000-200000">₦50,000 - ₦200,000</option>
                <option value="200000-500000">₦200,000 - ₦500,000</option>
                <option value="500000+">₦500,000+</option>
                <option value="usd-0-500">$0 - $500</option>
                <option value="usd-500-2000">$500 - $2,000</option>
                <option value="usd-2000+">$2,000+</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conditional rendering for each tab content */}
        {activeTab === "available" && (
          <>
            <h2 className="text-xl lg:text-[24px] font-medium text-black mb-[20px]">
              4 Jobs Available
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
              {availableJobs.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[8px] bg-white p-[20px] lg:p-[40px] h-[auto]"
                >
                  {/* Job Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-base text-[#201324] font-semibold text-[#201324] mb-[10px]">
                        {item.title}
                      </h3>
                      <p className="text-base !font-normal text-black">
                        Posted by: {item.company}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-black">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="flex flex-wrap flex-col gap-[14px] mb-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.location}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">{item.payment}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.duration}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-black mb-8 leading-[13.44px]">
                    {item.description}
                  </p>

                  {/* Action Button */}
                  <div className="flex justify-between items-center">
                    <button className="w-full bg-[#51008B] text-white text-[12px] font-medium py-[16px] px-5 rounded-[8px]">
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "applications" && (
          <>
            <h2 className="text-xl lg:text-[24px] font-medium text-black mb-[20px]">
              4 Applications
            </h2>
            <div className="space-y-4 lg:space-y-5">
              {myApplications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[8px] border-[1px] border-[#51008B] bg-white p-[20px] lg:p-[40px] h-auto"
                >
                  {/* Job Header */}
                  <div className="flex flex-col gap-1 mb-4">
                    <div className="flex items-center flex-wrap gap-[40px] justify-between">
                      <div className="flex flex-row gap-[40px]">
                        <h3 className="text-base text-[#201324] font-semibold">
                          {item.title}
                        </h3>
                        {item.status && (
                          <span
                            className={`text-[14px] font-normal ${item.statusColor}`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-black">
                        {item.timestamp}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-base !font-normal text-black">
                        Posted by: {item.company}
                      </p>
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="flex flex-wrap flex-row gap-[20px] mb-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.location}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">{item.payment}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.duration}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-row justify-between items-center">
                    {/* Message */}
                    {item.message && (
                      <p className="text-sm text-black">{item.message}</p>
                    )}

                    {/* Action Button */}
                    <div className="flex justify-between items-center">
                      {item.actionText && (
                        <button className="text-[#51008B] text-sm border-b border-[#51008B]">
                          {item.actionText}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "contracts" && (
          <>
            <h2 className="text-xl lg:text-[24px] font-medium text-black mb-[20px]">
              3 Active Contracts
            </h2>
            <div className="space-y-4 lg:space-y-5">
              {activeContracts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[8px] border-[1px] border-[#51008B] bg-white p-[20px] lg:p-[40px] h-auto"
                >
                  {/* Job Header */}
                  <div className="flex justify-between items-start mb-4 w-full">
                    <div className="flex flex-row justify-between items-center gap-[40px]">
                      <h3 className="text-base text-[#201324] font-semibold text-[#201324]">
                        {item.title}
                      </h3>
                      {item.status && (
                        <span className={`text-sm ${item.statusColor}`}>
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between items-start">
                    <p className="text-base !font-normal text-black">
                      Posted by: {item.company}
                    </p>
                  </div>

                  {/* Job Details */}
                  <div className="flex flex-wrap flex-row gap-[20px]">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.location}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">{item.payment}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-black/80" />
                      <span className="text-sm text-black">
                        {item.duration}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
