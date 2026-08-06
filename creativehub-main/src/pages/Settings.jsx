import { useState } from 'react';

// New ToggleSwitch component using inline styles (CSS-in-JS)
const ToggleSwitch = ({ enabled, onChange }) => {
  const switchStyles = {
    container: {
      position: 'relative',
      display: 'inline-block',
      width: '60px',
      height: '30px',
    },
    slider: {
      position: 'absolute',
      cursor: 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: enabled ? '#51008b' : '#ccc',
      transition: 'background-color 0.2s',
      borderRadius: '34px',
    },
    thumb: {
      position: 'absolute',
      height: '22px',
      width: '22px',
      left: '4px',
      bottom: '4px',
      backgroundColor: 'white',
      transition: 'transform 0.2s',
      borderRadius: '50%',
      transform: enabled ? 'translateX(30px)' : 'translateX(0)',
    },
    // Hide the default checkbox input
    input: {
      opacity: 0,
      width: 0,
      height: 0,
    }
  };

  return (
    <label style={switchStyles.container}>
      <input 
        type="checkbox" 
        checked={enabled} 
        onChange={onChange} 
        style={switchStyles.input}
      />
      <span style={switchStyles.slider}>
        <span style={switchStyles.thumb} />
      </span>
    </label>
  );
};


export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  // Tab data
  const tabs = [
    { id: 'profile', label: 'Profile Info' },
    { id: 'security', label: 'Account Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'verification', label: 'Verification' }
  ];

  // Notification states
  const [emailNotifications, setEmailNotifications] = useState([
    {
      id: 1,
      title: 'New job opportunities',
      description: 'Get notified when jobs match your skills',
      enabled: true
    },
    {
      id: 2,
      title: 'Payment notifications',
      description: 'Updates on payments and wallet activity',
      enabled: true
    },
    {
      id: 3,
      title: 'Messages',
      description: 'New messages from employers',
      enabled: true
    }
  ]);

  const [smsNotifications, setSmsNotifications] = useState([
    {
      id: 1,
      title: 'Urgent job alerts',
      description: 'High-priority opportunities',
      enabled: true
    },
    {
      id: 2,
      title: 'Payment confirmations',
      description: 'When payments are processed',
      enabled: true
    }
  ]);

  const [inAppNotifications, setInAppNotifications] = useState([
    {
      id: 1,
      title: 'All notifications',
      description: 'Show notifications within the app',
      enabled: true
    }
  ]);

  // Toggle handlers
  const toggleEmailNotification = (id) => {
    setEmailNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, enabled: !notif.enabled } : notif
      )
    );
  };

  const toggleSmsNotification = (id) => {
    setSmsNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, enabled: !notif.enabled } : notif
      )
    );
  };

  const toggleInAppNotification = (id) => {
    setInAppNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, enabled: !notif.enabled } : notif
      )
    );
  };

  return (
    <div className=" mt-[40px] min-h-screen w-full" data-name="Settings">
      {/* Header Section */}
      <main className="pt-8 sm:pt-10 lg:pt-[40px]">
        <div className="flex flex-col items-start mb-8 sm:mb-10 lg:mb-[60px]">
          <p className="font-['Montserrat',_sans-serif] font-medium text-black text-xl sm:text-2xl mb-1">Settings</p>
          <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm sm:text-base">Manage your account and preferences</p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-black/80 border-opacity-80 mb-8 sm:mb-10 lg:mb-10">
          <div className="flex gap-4 sm:gap-6 lg:gap-[40px] overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 px-1 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'font-["Montserrat",_sans-serif] font-medium text-[#51008b] border-b-2 border-[#51008b]'
                    : 'font-["Montserrat",_sans-serif] font-normal text-black'
                } text-sm sm:text-base`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className=" mx-auto pb-12">
          {/* Profile Info Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.8)] p-6 sm:p-8 lg:p-10">
              <p className="font-['Montserrat',_sans-serif] font-semibold text-[#10001c] text-base text-center mb-8 sm:mb-10">
                Profile Information
              </p>

              {/* Profile Photo Section */}
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-8 sm:mb-10 lg:mb-14">
                <div className="flex flex-col items-center sm:items-start gap-4">
                  <div className="size-[120px] sm:size-[150px] lg:size-[200px] rounded-full bg-[#D9D9D9]" />
                  <button className="border border-[#51008b] rounded-lg px-5 py-4 w-full sm:w-[200px]">
                    <p className="font-['Montserrat',_sans-serif] font-medium text-[#51008b] text-xs text-center">
                      Change Photo
                    </p>
                  </button>
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-6 sm:space-y-8 lg:space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
                    {/* Full Name */}
                    <div className="flex flex-col gap-2.5">
                      <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                        Full Name
                      </p>
                      <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                        <input
                          type="text"
                          placeholder="Enter your full name"
                          className="w-full font-['Montserrat',_sans-serif] font-light text-[rgba(0,0,0,0.6)] text-xs bg-transparent outline-none"
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="flex flex-col gap-2.5">
                      <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                        Email Address
                      </p>
                      <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                        <input
                          type="email"
                          placeholder="Enter your email address"
                          className="w-full font-['Montserrat',_sans-serif] font-light text-black text-xs bg-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="flex flex-col gap-2.5">
                    <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                      Bio
                    </p>
                    <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                      <textarea
                        placeholder="Tell us about yourself"
                        rows={6}
                        className="w-full font-['Montserrat',_sans-serif] font-light text-[rgba(0,0,0,0.6)] text-xs bg-transparent outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button className="bg-[#51008b] rounded-lg px-5 py-4 w-full sm:w-[223px]">
                  <p className="font-['Montserrat',_sans-serif] font-medium text-white text-xs text-center">
                    Save Changes
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Account Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.8)] p-6 sm:p-8 lg:p-10">
              <p className="font-['Montserrat',_sans-serif] font-semibold text-[#10001c] text-base text-center mb-8 sm:mb-10">
                Change Password
              </p>

              <div className="max-w-full space-y-6 sm:space-y-8 lg:space-y-[30px]">
                {/* Current Password */}
                <div className="flex flex-col gap-2.5">
                  <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                    Current Password
                  </p>
                  <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                    <input
                      type="password"
                      placeholder="Create your password"
                      className="w-full font-['Montserrat',_sans-serif] font-light text-[rgba(0,0,0,0.6)] text-xs bg-transparent outline-none"
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="flex flex-col gap-2.5">
                  <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                    New Password
                  </p>
                  <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                    <input
                      type="password"
                      placeholder="Create your password"
                      className="w-full font-['Montserrat',_sans-serif] font-light text-[rgba(0,0,0,0.6)] text-xs bg-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-2.5">
                  <p className="font-['Montserrat',_sans-serif] font-normal text-black text-sm">
                    Confirm Password
                  </p>
                  <div className="border border-[rgba(0,0,0,0.8)] rounded-lg px-5 py-4">
                    <input
                      type="password"
                      placeholder="Confirm your password"
                      className="w-full font-['Montserrat',_sans-serif] font-light text-[rgba(0,0,0,0.6)] text-xs bg-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-start mt-8 sm:mt-10">
                <button className="bg-[#51008b] rounded-lg px-5 py-4 w-full sm:w-[223px]">
                  <p className="font-['Montserrat',_sans-serif] font-medium text-white text-xs text-center">
                    Save Changes
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.8)] p-6 sm:p-8 lg:p-10">
              <p className="font-['Montserrat',_sans-serif] font-semibold text-[#10001c] text-base text-center mb-8 sm:mb-10">
                Notification Preferences
              </p>

              {/* Email Notifications Section */}
              <div className="mb-8 sm:mb-10">
                <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm mb-4 sm:mb-6">
                  Email Notifications
                </p>
                <div className="space-y-6">
                  {emailNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm">
                          {notification.title}
                        </p>
                        <p className="font-['Montserrat',_sans-serif] font-normal text-black text-xs">
                          {notification.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {/* REPLACED with new ToggleSwitch component */}
                        <ToggleSwitch 
                          enabled={notification.enabled} 
                          onChange={() => toggleEmailNotification(notification.id)} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SMS Notifications Section */}
              <div className="mb-8 sm:mb-10">
                <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm mb-4 sm:mb-6">
                  SMS Notifications
                </p>
                <div className="space-y-6">
                  {smsNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm">
                          {notification.title}
                        </p>
                        <p className="font-['Montserrat',_sans-serif] font-normal text-black text-xs">
                          {notification.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {/* REPLACED with new ToggleSwitch component */}
                        <ToggleSwitch 
                          enabled={notification.enabled} 
                          onChange={() => toggleSmsNotification(notification.id)} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* In-App Notifications Section */}
              <div className="mb-8 sm:mb-10">
                <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm mb-4 sm:mb-6">
                  In-App Notifications
                </p>
                <div className="space-y-6">
                  {inAppNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="font-['Montserrat',_sans-serif] font-medium text-black text-sm">
                          {notification.title}
                        </p>
                        <p className="font-['Montserrat',_sans-serif] font-normal text-black text-xs">
                          {notification.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {/* REPLACED with new ToggleSwitch component */}
                        <ToggleSwitch 
                          enabled={notification.enabled} 
                          onChange={() => toggleInAppNotification(notification.id)} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-start mt-8 sm:mt-10">
                <button className="bg-[#51008b] rounded-lg px-5 py-4 w-full sm:w-[223px]">
                  <p className="font-['Montserrat',_sans-serif] font-medium text-white text-xs text-center">
                    Save Changes
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Verification Tab */}
          {activeTab === 'verification' && (
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.8)] p-6 sm:p-8 lg:p-10">
              {/* Verification Status Title */}
              <p className="font-['Montserrat',_sans-serif] font-semibold text-[#10001c] text-base text-center mb-8 sm:mb-10">
                Verification Status
              </p>

              {/* Identity Verification Card */}
              <div className="bg-white rounded-lg border-[0.5px] border-[rgba(0,0,0,0.8)] mb-8 sm:mb-10">
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex flex-col gap-2">
                      <p className="font-['Montserrat',_sans-serif] font-semibold text-[#201324] text-base">
                        Identity Verification
                      </p>
                      <p className="font-['Montserrat',_sans-serif] font-normal text-black text-base">
                        Upload government-issued ID for verification
                      </p>
                    </div>
                    <p className="font-['Montserrat',_sans-serif] font-normal text-[#00b388] text-sm whitespace-nowrap">
                      Not verified
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="mb-8 sm:mb-10">
                <div className="flex flex-col gap-1 mb-6 sm:mb-8">
                  <p className="font-['Montserrat',_sans-serif] font-semibold text-[#10001c] text-base">
                    Upload Verification Documents
                  </p>
                  <p className="font-['Montserrat',_sans-serif] font-medium text-[#10001c] text-sm">
                    Upload clear photos of your government-issued ID to complete verification
                  </p>
                </div>

                {/* Upload Area */}
                <div className="border-[0.5px] border-[rgba(0,0,0,0.8)] border-dashed rounded-lg p-6 sm:p-8 lg:p-10 flex flex-col items-center justify-center gap-2.5">
                  <button className="border border-[#c5aad8] rounded-lg px-5 py-2.5">
                    <p className="font-['Montserrat',_sans-serif] font-medium text-[#c5aad8] text-xs text-center">
                      Upload ID Document
                    </p>
                  </button>
                  <p className="font-['Montserrat',_sans-serif] font-normal text-black text-xs text-center">
                    National ID, Driver's License, or Passport
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-start">
                <button className="bg-[#51008b] rounded-lg px-5 py-4 w-full sm:w-[223px]">
                  <p className="font-['Montserrat',_sans-serif] font-medium text-white text-xs text-center">
                    Submit for Verification
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
