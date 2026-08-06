import { useState } from "react";

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1
    primaryRole: "",
    bio: "",
    // Step 2
    skills: [],
    yearsOfExperience: "",
    previousWorkExperience: "",
    portfolio: null,
    // Step 3
    availableDays: [],
    availableToTravel: "",
    hourlyRate: "",
    projectRate: "",
    // Step 4
    idDocument: null,
    isVerified: false,
  });

  const steps = [
    { number: 1, title: "Personal Information", active: true },
    { number: 2, title: "Skills & Portfolio", active: false },
    { number: 3, title: "Pricing & Availability", active: false },
    { number: 4, title: "Verification", active: false },
  ];

  const skillOptions = [
    "Contemporary Dance",
    "Video Editing",
    "Hip-Hop",
    "Sound Mixing",
    "Graphic Design",
    "Photography",
    "Acting",
    "Singing",
    "Music Production",
    "Creative Writing",
  ];

  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final submission - mark onboarding as complete
      setOnboardingComplete(true);
      
      // In a real app, you would submit the form data to an API here
      console.log("Form data submitted:", formData);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSkillChange = (skill) => {
    setFormData((prev) => {
      const newSkills = prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills: newSkills };
    });
  };

  const handleFileChange = (e, field) => {
    if (e.target.files && e.target.files[0]) {
      handleInputChange(field, e.target.files[0]);
    }
  };

  const handleDayChange = (day) => {
    setFormData((prev) => {
      const newDays = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: newDays };
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-[40px]">
            <div>
              <label className="block text-black text-[14px] font-normal mb-[10px]">
                Primary Role
              </label>
              <select
                className="w-full px-[20px] py-[16px] text-[12px] border border-black rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                value={formData.primaryRole}
                onChange={(e) =>
                  handleInputChange("primaryRole", e.target.value)
                }
              >
                <option value="" className="">
                  Select your primary Role
                </option>
                <option value="developer">Software Developer</option>
                <option value="designer">UI/UX Designer</option>
                <option value="manager">Project Manager</option>
                <option value="consultant">Consultant</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-black text-[14px] font-normal mb-[10px]">
                Bio
              </label>
              <textarea
                className="w-full px-[20px] py-[16px] border border-black rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                rows="6"
                placeholder="Tell us about yourself"
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-[14px] font-medium text-black mb-[10px]">
                Skills
              </h3>
              <p className="text-[14px] text-black font-normal mb-[20px]">
                Select all skills that apply to you
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {skillOptions.map((skill) => (
                  <div key={skill} className="flex items-center">
                    <input
                      type="checkbox"
                      id={skill}
                      checked={formData.skills.includes(skill)}
                      onChange={() => handleSkillChange(skill)}
                      className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={skill}
                      className="ml-2 text-[12px] text-black"
                    >
                      {skill}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="yearsOfExperience"
                className="text-[14px] font-medium text-black"
              >
                Years of Experience
              </label>
              <select
                id="yearsOfExperience"
                className="w-full px-[20px] py-[16px] mt-[10px] text-[12px] text-black border border-black rounded-[8px] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                value={formData.yearsOfExperience}
                onChange={(e) =>
                  handleInputChange("yearsOfExperience", e.target.value)
                }
              >
                <option value="">Select your years of experience</option>
                <option value="0-1">0 - 1 year</option>
                <option value="1-3">1 - 3 years</option>
                <option value="3-5">3 - 5 years</option>
                <option value="5-10">5 - 10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="previousWorkExperience"
                className="text-[14px] font-medium text-black"
              >
                Previous Work Experience
              </label>
              <textarea
                id="previousWorkExperience"
                className="mt-[10px] w-full px-4 py-3 border border-black rounded-[8px] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                rows="5"
                placeholder="Describe your previous work experience or project"
                value={formData.previousWorkExperience}
                onChange={(e) =>
                  handleInputChange("previousWorkExperience", e.target.value)
                }
              />
            </div>
            <div>
              <label className="text-[14px] font-medium text-black">
                Portfolio
              </label>
              <div className="mt-[10px] flex justify-center px-6 py-[32px] border-[1px] border-black border-dashed rounded-[8px]">
                <div className="space-y-1 text-center">
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="id-upload"
                      className="border-[1px] border-[#C5AAD8] font-medium text-[#C5AAD8] font-medium px-[20px] py-[10px] rounded-[8px] cursor-pointer text-[12px]"
                    >
                      <span>Upload File</span>
                      <input
                        id="id-upload"
                        name="id-upload"
                        type="file"
                        className="sr-only"
                        onChange={(e) => handleFileChange(e, "portfolioFile")}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-[20px]">
            <div className="space-y-[20px]">
              <div>
                <h3 className="text-[14px] font-medium text-black">
                  Availability
                </h3>
                <p className="text-[14px] text-black font-normal mt-[10px]">
                  When are you typically available for work?
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex items-center">
                    <input
                      type="checkbox"
                      id={day}
                      checked={formData.availableDays.includes(day)}
                      onChange={() => handleDayChange(day)}
                      className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={day}
                      className="ml-2 text-[12px] text-black"
                    >
                      {day}
                    </label>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[14px] font-medium text-black">
                  Are you available to travel?
                </p>
                <div className="flex items-center gap-x-[20px] mt-[10px]">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="travel-yes"
                      name="travel"
                      value="yes"
                      checked={formData.availableToTravel === "yes"}
                      onChange={(e) =>
                        handleInputChange("availableToTravel", e.target.value)
                      }
                      className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    />
                    <label
                      htmlFor="travel-yes"
                      className="ml-2 text-sm text-gray-700"
                    >
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="travel-no"
                      name="travel"
                      value="no"
                      checked={formData.availableToTravel === "no"}
                      onChange={(e) =>
                        handleInputChange("availableToTravel", e.target.value)
                      }
                      className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    />
                    <label
                      htmlFor="travel-no"
                      className="ml-2 text-sm text-gray-700"
                    >
                      No
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-[18px]">
              <h3 className="text-[14px] font-medium text-black">Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="hourlyRate"
                    className="block text-[14px] font-medium text-black mb-1"
                  >
                    Hourly Rate
                  </label>
                  <select
                    id="hourlyRate"
                    className="w-full p-[10px] text-[12px] font-light border border-x-[0px] border-t-[0px] border-black outline-[0px] appearance-none"
                    value={formData.hourlyRate}
                    onChange={(e) =>
                      handleInputChange("hourlyRate", e.target.value)
                    }
                  >
                    <option value="">Select your hourly rate</option>
                    <option value="20-40">$20 - $40 / hr</option>
                    <option value="40-60">$40 - $60 / hr</option>
                    <option value="60-80">$60 - $80 / hr</option>
                    <option value="80-100">$80 - $100 / hr</option>
                    <option value="100+">$100+ / hr</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="projectRate"
                    className="block text-[14px] font-medium text-black mb-1"
                  >
                    Project Rate
                  </label>
                  <select
                    id="projectRate"
                    className="w-full p-[10px] text-[12px] font-light border border-x-[0px] border-t-[0px] border-black outline-[0px] appearance-none"
                    value={formData.projectRate}
                    onChange={(e) =>
                      handleInputChange("projectRate", e.target.value)
                    }
                  >
                    <option value="">Select your starting project rate</option>
                    <option value="500-1000">$500 - $1,000</option>
                    <option value="1000-2500">$1,000 - $2,500</option>
                    <option value="2500-5000">$2,500 - $5,000</option>
                    <option value="5000-10000">$5,000 - $10,000</option>
                    <option value="10000+">$10,000+</option>
                  </select>
                </div>
              </div>
              <p className="text-[12px] text-black">
                You can adjust this later based on project requirements.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-[10px]">
            <h3 className="text-[14px] font-medium text-[#000]">
              Identity Verification
            </h3>
            <div className="mt-1 flex justify-center px-6 pt-10 pb-12 border-[1px] border-[#000] border-dashed rounded-[8px]">
              <div className="space-y-1 text-center">
                <div className="flex justify-center mt-4">
                  <label
                    htmlFor="id-upload"
                    className="border-[1px] border-[#C5AAD8] font-medium text-[#C5AAD8] font-medium px-[20px] py-[10px] rounded-[8px] cursor-pointer text-[12px]"
                  >
                    <span>Upload ID Document</span>
                    <input
                      id="id-upload"
                      name="id-upload"
                      type="file"
                      className="sr-only"
                      onChange={(e) => handleFileChange(e, "idDocument")}
                    />
                  </label>
                </div>
                <p className="mt-[10px] text-[12px] text-[#000000]">
                  National ID, Driver's License, or Passport
                </p>
                {formData.idDocument && (
                  <p className="text-sm text-green-600 mt-2">
                    File selected: {formData.idDocument.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render success page if onboarding is complete
  if (onboardingComplete) {
    return (
      <div className="min-h-screen bg-[url('/images/forgot-pass.png')] bg-cover bg-center flex items-center justify-center p-4">
        <div className="w-full p-[40px] md:w-[853px] p-[0px] relative bg-white rounded-[8px] shadow-2xl text-center">
          <div className="flex flex-col items-center">
          <img src="/icons/check-purple.svg" alt="Check" className=" mb-[40px]"/>
            <h1 className="text-[24px] text-black font-semibold text-[#10001C] mb-[10px]">
              Your profile is ready!
            </h1>
            <p className="text-[14px] text-black mb-8">
              Employers can now discover and hire you for amazing projects.
            </p>
            <button className="px-6 py-3 bg-[#51008B] w-[580px] text-white rounded-[8px] font-medium text-[14px]">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('/images/forgot-pass.png')] bg-cover bg-center flex items-center justify-center p-4">
      <div className="relative bg-white rounded-[8px] shadow-2xl p-[40px] w-full max-w-[853px]">
        <div className="mb-8">
          <h1 className="text-[24px] font-semibold text-[#10001C] text-center mb-[20px]">
            Complete Your Profile
          </h1>

          {/* Progress Indicator */}
          <div className="flex items-center md:mx-[120px] justify-between mb-8 relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-8 right-6 h-[1px] bg-gray-200 rounded-full">
              <div
                className="h-full bg-[#51008B] rounded-r-full transition-all duration-500 ease-in-out"
                style={{
                  width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                }}
              ></div>
            </div>
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex flex-col items-center relative z-10"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-medium transition-all duration-300 ${
                    currentStep >= step.number
                      ? "bg-[#51008B] text-white shadow-lg"
                      : "bg-white text-gray-500 border-[1px] border-[#818181]"
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                    currentStep >= step.number
                      ? "text-purple-600"
                      : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Form Content */}
          <div className="flex-1">
            <div className="transition-all duration-500 ease-in-out transform">
              {renderStepContent()}
            </div>
          </div>

          {/* Profile Photo Section - Only show on step 1 */}
          {currentStep === 1 && (
            <div className="flex flex-col items-center space-y-[50px]">
              <div className="w-[200px] h-[200px] bg-[#d9d9d9] rounded-full flex items-center justify-center"></div>
              <button className="px-[20px] py-[16px] border-[1px] border-[#51008B] text-[12px] text-[#51008B] font-medium rounded-[8px] hover:bg-purple-50 transition-colors font-medium">
                Upload Profile Photo
              </button>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              className="px-[20px] py-[10px] border-[1px] border-[#201324] text-[#201324] rounded-[8px] font-medium text-[12px]"
            >
              Previous
            </button>
          )}

          <button
            onClick={handleNext}
            className={`px-[20px] py-[10px] bg-[#51008B] text-[12px] text-white rounded-[8px] font-medium shadow-sm ${
              currentStep === 1 ? "ml-auto" : ""
            }`}
          >
            {currentStep === 4 ? "Complete Profile" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}