import { useState } from 'react';

// Data arrays for the messages page
const conversations = [
  {
    id: 1,
    name: 'Samuel (Event Planner)',
    lastMessage: 'Can we discuss availability for October?',
    time: '2 hours ago',
    unreadCount: 3,
    avatar: '#D9D9D9',
    isActive: true
  },
  {
    id: 2,
    name: 'Sarah (Photographer)',
    lastMessage: 'Great! Looking forward to working together',
    time: '1 day ago',
    unreadCount: 1,
    avatar: '#D9D9D9',
    isActive: false
  },
  {
    id: 3,
    name: 'Mike (Video Director)',
    lastMessage: 'The project timeline looks perfect',
    time: '3 days ago',
    unreadCount: 0,
    avatar: '#D9D9D9',
    isActive: false
  }
];

const messages = [
  {
    id: 1,
    content: `Hi Mimi! I saw your portfolio and I'm impressed. Can we discuss availability for October?`,
    time: '10:30 AM',
    sender: 'received',
    isMultiLine: true
  },
  {
    id: 2,
    content: `Hi Samuel! Thank you for reaching out. I'd be happy to discuss the project details.`,
    time: '10:30 AM',
    sender: 'sent',
    isMultiLine: true
  },
  {
    id: 3,
    content: `Perfect! It's a corporate event in Lagos. Are you available October 15-17?`,
    time: '10:30 AM',
    sender: 'received',
    isMultiLine: true
  }
];

const activeContact = {
  name: 'Samuel (Event Planner)',
  status: 'Active Now',
  avatar: '#D9D9D9'
};

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[rgba(255,255,255,0.98)] min-h-screen w-full">
      {/* Page Header */}
      <div className="px-4 md:px-20 pt-8 md:pt-10 mb-8">
        <div className="content-stretch flex flex-col items-start">
          <h1 className="font-['Montserrat'] font-medium text-black text-xl md:text-2xl mb-1">
            Messages
          </h1>
          <p className="font-['Montserrat'] font-normal text-black text-sm md:text-base">
            Communicate securely with employers and clients
          </p>
        </div>
      </div>

      {/* Main Content - Messages Interface */}
      <div className="px-4 md:px-20">
        <div className="flex flex-col lg:flex-row gap-0 h-[759px] rounded-lg overflow-hidden shadow-sm">
          
          {/* Left Sidebar - Conversations List */}
          <div className="bg-white w-full lg:w-[483px] rounded-bl-lg rounded-tl-lg border border-[rgba(81,0,139,0.1)]">
            
            {/* Search Bar */}
            <div className="p-5 border-b border-gray-200">
              <div className="box-border flex gap-2 items-center px-5 py-4 rounded-lg border-[0.5px] border-[rgba(0,0,0,0.8)]">
                <input
                  type="text"
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 font-['Montserrat'] font-light text-xs text-[rgba(0,0,0,0.6)] bg-transparent outline-none placeholder:text-[rgba(0,0,0,0.6)]"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="overflow-y-auto">
              {filteredConversations.map((conversation, index) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`h-[100px] px-5 flex items-center gap-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation === conversation.id ? 'bg-[rgba(81,0,139,0.02)]' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-[50px] h-[50px] flex-srink-0">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 50 50">
                      <circle cx="25" cy="25" fill={conversation.avatar} r="25" />
                    </svg>
                  </div>

                  {/* Conversation Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-['Montserrat'] font-medium text-base text-black mb-2">
                      {conversation.name}
                    </div>
                    <div className="font-['Montserrat'] font-normal text-sm text-black truncate">
                      {conversation.lastMessage}
                    </div>
                  </div>

                  {/* Time and Badge */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="font-['Montserrat'] font-normal text-xs text-[#00b388]">
                      {conversation.time}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="bg-[#00b388] rounded-full w-[27px] h-[27px] flex items-center justify-center">
                        <div className="font-['Montserrat'] font-normal text-xs text-white">
                          {conversation.unreadCount}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Active Conversation */}
          <div className="bg-white flex-1 rounded-br-lg rounded-tr-lg border border-[rgba(81,0,139,0.1)] border-l-0 flex flex-col">
            
            {/* Contact Header */}
            <div className="h-[80px] px-8 flex items-center border-b border-[rgba(0,0,0,0.6)] border-opacity-60">
              <div className="w-[50px] h-[50px] mr-4">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 50 50">
                  <circle cx="25" cy="25" fill={activeContact.avatar} r="25" />
                </svg>
              </div>
              <div>
                <div className="font-['Montserrat'] font-medium text-base text-black">
                  {activeContact.name}
                </div>
                <div className="font-['Montserrat'] font-normal text-sm text-black">
                  {activeContact.status}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              {messages.map((message, index) => (
                <div key={message.id} className={`flex ${message.sender === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[400px] px-5 py-4 rounded-lg ${
                      message.sender === 'sent' 
                        ? 'bg-[#51008b] text-white' 
                        : 'bg-[rgba(233,237,243,0.56)] text-black'
                    }`}
                  >
                    <div className={`font-['Montserrat'] ${message.sender === 'sent' ? 'font-medium' : 'font-normal'} text-sm mb-2`}>
                      {message.content}
                    </div>
                    <div className={`font-['Montserrat'] ${message.sender === 'sent' ? 'font-normal' : 'font-light'} text-xs ${
                      message.sender === 'sent' ? 'text-white' : 'text-black'
                    }`}>
                      {message.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input Area */}
            <div className="p-5 border-t border-gray-200">
              <div className="flex gap-4 items-center">
                <div className="flex-1 box-border flex gap-2 items-center px-5 py-4 rounded-lg border-[0.5px] border-[#51008b]">
                  <input
                    type="text"
                    placeholder="Ask your mentor a question"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 font-['Montserrat'] font-light text-xs text-black bg-transparent outline-none placeholder:text-black"
                  />
                </div>
                <button 
                  className="bg-[#51008b] text-white px-5 py-4 rounded-lg font-['Montserrat'] font-medium text-xs hover:bg-[#51008b]/90 transition-colors w-[200px]"
                  onClick={() => {
                    if (messageInput.trim()) {
                      // Handle send message
                      setMessageInput('');
                    }
                  }}
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-16"></div>
    </div>
  );
}