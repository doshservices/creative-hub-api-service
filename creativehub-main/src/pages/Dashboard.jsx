import { Header } from "../components/header"
// import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const statsData = [
  { title: "Active Jobs", value: "02", bgColor: "bg-gradient-to-br from-[#51008b] to-[#A05EB5]" },
  { title: "Pending Requests", value: "02", bgColor: "bg-gradient-to-br from-[#552B00] to-[#BB5F00]" },
  { title: "Portfolio Views", value: "20", bgColor: "bg-gradient-to-br from-[#004D3B] to-[#004D3B]" },
  { title: "Wallet Balance", value: "₦75,000", bgColor: "bg-gradient-to-br from-[#03838C] to-[#05E2F2]" },
]

const jobsData = [
  { title: "Dance Crew Needed – Lagos", price: "₦100,000", timePosted: "2 hours ago", borderColor: "border-[#00b388]" },
  {
    title: "Music Video Editing Project",
    price: "$200",
    location: "Remote",
    timePosted: "1 day ago",
    borderColor: "border-[#51008b]",
  },
  { title: "Event Photography – Abuja", price: "₦100,000", timePosted: "2 hours ago", borderColor: "border-[#0554f2]" },
  { title: "Dance Crew Needed – Lagos", price: "₦100,000", timePosted: "2 hours ago", borderColor: "border-[#ff8200]" },
  { title: "Dance Crew Needed – Lagos", price: "₦100,000", timePosted: "2 hours ago", borderColor: "border-[#00b388]" },
  { title: "Dance Crew Needed – Lagos", price: "₦100,000", timePosted: "2 hours ago", borderColor: "border-[#ff8200]" },
]

const messagesData = [
  {
    name: "Samuel",
    role: "Event Planner",
    message: "Can we discuss availability for October?",
    timeAgo: "2 hours ago",
    unreadCount: 3,
  },
  {
    name: "Maria",
    role: "Producer",
    message: "Great work on the last project! Payment has been released.",
    timeAgo: "2 hours ago",
    unreadCount: 3,
  },
  {
    name: "David",
    role: "Director",
    message: "Looking forward to working with you on the music video!",
    timeAgo: "2 hours ago",
    unreadCount: 3,
  },
  {
    name: "Samuel",
    role: "Event Planner",
    message: "Can we discuss availability for October?",
    timeAgo: "2 hours ago",
  },
  {
    name: "Samuel",
    role: "Event Planner",
    message: "Can we discuss availability for October?",
    timeAgo: "2 hours ago",
  },
]

function StatCard({ title, value, bgColor, textColor = "text-white" }) {
  return (
    <div className={`${bgColor} ${textColor} rounded-[8px] px-[16px] py-[23px] relative overflow-hidden`}>
      <div className="relative z-10">
        <p className="text-[16px] font-semibold mb-[20px]">{title}</p>
        <p className="text-[24px] font-semibold">{value}</p>
      </div>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-4 right-4 w-16 h-16 rounded-full border-2 border-current"></div>
        <div className="absolute bottom-2 right-8 w-8 h-8 rounded-full border border-current"></div>
      </div>
    </div>
  )
}

function JobItem({ title, price, location, timePosted, borderColor }) {
  return (
    <div className={`border-l-4 ${borderColor} pl-4 py-3`}>
      <h3 className="font-medium text-[#000000] mb-1">{title}</h3>
      <div className="flex items-center gap-2 text-sm text-[#000000]">
        <span>{price}</span>
        {location && (
          <>
            <span>•</span>
            <span>{location}</span>
          </>
        )}
        <span>•</span>
        <span>Posted {timePosted}</span>
      </div>
    </div>
  )
}

function MessageItem({ name, role, message, timeAgo, unreadCount }) {
  return (
    <div className="flex items-start gap-3 py-3">
 
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-[#000000]">
            {name} ({role})
          </h4>
          <span className="text-xs text-[#000000]">{timeAgo}</span>
        </div>
        <p className="text-sm text-[#000000] truncate">{message}</p>
      </div>
      {unreadCount && (
        <div className="bg-[#00b388] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#fbfbfb]">


      <div className="px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#000000] mb-2">Hi Mimi!</h2>
          <p className="text-[#000000]">Here's a quick look at your activity.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statsData.map((stat, index) => (
            <StatCard key={index} title={stat.title} value={stat.value} bgColor={stat.bgColor} />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {/* Recent Job Requests */}
          <div className="bg-[#ffffff] p-[40px] rounded-[8px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#000000]">Recent Job Requests</h3>
              <a href="#" className="text-[#51008b] text-sm font-medium hover:underline">
                View All Jobs
              </a>
            </div>
            <div className="space-y-4">
              {jobsData.map((job, index) => (
                <JobItem
                  key={index}
                  title={job.title}
                  price={job.price}
                  location={job.location}
                  timePosted={job.timePosted}
                  borderColor={job.borderColor}
                />
              ))}
            </div>
          </div>

          {/* Recent Messages */}
          <div className="bg-[#ffffff] p-[40px] rounded-[8px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#000000]">Recent Messages</h3>
              <a href="#" className="text-[#51008b] text-sm font-medium hover:underline">
                Open Inbox
              </a>
            </div>
            <div className="space-y-1">
              {messagesData.map((message, index) => (
                <MessageItem
                  key={index}
                  name={message.name}
                  role={message.role}
                  message={message.message}
                  timeAgo={message.timeAgo}
                  unreadCount={message.unreadCount}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
