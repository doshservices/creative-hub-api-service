import { useState } from 'react';

// Data arrays for the wallet page
const balanceCards = [
  {
    id: 'available',
    title: 'Available Balance',
    amount: '₦345,000',
    subtitle: 'Ready to withdraw',
    // Replace with the actual path to your background image
    bgImage: "url('/icons/blue-spiral-bg.png')"
  },
  {
    id: 'pending',
    title: 'Pending Payments',
    amount: '₦345,000',
    subtitle: 'In escrow',
    // Replace with the actual path to your background image
    bgImage: "url('/icons/orange-spiral-bg.png')"
  },
  {
    id: 'total',
    title: 'Total Earnings',
    amount: '₦345,000',
    subtitle: 'All',
    // Replace with the actual path to your background image
    bgImage: "url('/icons/green-spiral-bg.png')"
  }
];

const earningsTransactions = [
  {
    id: 1,
    title: 'Music Video Dance Performance',
    date: 'Completed Oct 10, 2024',
    amount: '+₦50,000',
    status: 'Paid'
  },
  {
    id: 2,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '+₦50,000',
    status: 'Paid'
  },
  {
    id: 3,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '+₦50,000',
    status: 'Paid'
  },
  {
    id: 4,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '+₦50,000',
    status: 'Paid'
  }
];

const pendingTransactions = [
  {
    id: 1,
    title: 'Music Video Dance Performance',
    date: 'Completed Oct 10, 2024',
    amount: '₦50,000',
    status: 'Awaiting Client Approval'
  },
  {
    id: 2,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '₦50,000',
    status: 'Awaiting Client Approval'
  },
  {
    id: 3,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '₦50,000',
    status: 'Awaiting Client Approval'
  },
  {
    id: 4,
    title: 'Logo Design Project',
    date: 'Completed Oct 05, 2024',
    amount: '₦50,000',
    status: 'Awaiting Client Approval'
  }
];

const recentWithdrawals = [
  {
    id: 1,
    method: 'Bank Transfer',
    amount: '₦30,000',
    date: 'Oct 8, 2024',
    account: 'GTBank ****1234',
    status: 'Completed',
    statusColor: 'text-[#00b388]'
  },
  {
    id: 2,
    method: 'Mobile Money',
    amount: '₦30,000',
    date: 'Oct 3, 2024',
    account: 'MTN ****5678',
    status: 'Completed',
    statusColor: 'text-[#00b388]'
  },
  {
    id: 3,
    method: 'Bank Transfer',
    amount: '₦30,000',
    date: 'Oct 12, 2024',
    account: 'Access Bank ****9876',
    status: 'Processing',
    statusColor: 'text-[#f5c625]'
  }
];

export default function Wallet() {
  const [activeTab, setActiveTab] = useState('earnings');
  const [withdrawalAmount, setWithdrawalAmount] = useState('₦100,000');
  const [withdrawalMethod, setWithdrawalMethod] = useState('bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const tabs = [
    { id: 'earnings', label: 'Earnings History' },
    { id: 'pending', label: 'Pending Payments' },
    { id: 'withdraw', label: 'Withdraw Funds' }
  ];

  return (
    <div className="bg-[rgba(255,255,255,0.98)] min-h-screen w-full">
      {/* Page Header */}
      <div className="px-4 md:px-20 pt-8 md:pt-10">
        <div className="content-stretch flex flex-col items-start">
          <h1 className="font-['Montserrat'] font-medium text-black text-xl md:text-2xl mb-1">
            Wallet & Payments
          </h1>
          <p className="font-['Montserrat'] font-normal text-black text-sm md:text-base">
            Manage your earnings and withdraw funds securely
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-4 md:px-20 mt-8 md:mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {balanceCards.map((card) => (
            <div key={card.id} className="h-[170px] rounded-lg relative overflow-hidden">
              <div
                className="h-full relative rounded-lg bg-cover bg-center p-[30px] flex flex-col justify-between"
                style={{ backgroundImage: card.bgImage }}
              >
                <div>
                  <div className="font-['Montserrat'] font-semibold text-base text-white">
                    {card.title}
                  </div>
                </div>
                <div>
                  <div className="font-['Montserrat'] font-semibold text-2xl text-white">
                    {card.amount}
                  </div>
                  <div className="font-['Montserrat'] font-semibold text-sm text-white mt-1">
                    {card.subtitle}
                  </div>
                </div>
              </div>
              <div aria-hidden="true" className="absolute border border-[#dccce8] border-solid inset-0 pointer-events-none rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 md:px-20 mt-12">
        <div className="flex gap-8 md:gap-12 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 relative font-['Montserrat'] text-base ${
                activeTab === tab.id
                  ? 'text-[#51008b] font-medium border-b-2 border-[#51008b]'
                  : 'text-black font-normal hover:text-[#51008b]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 md:px-20 mt-8">
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
              <div className="bg-white h-[67px] px-5 flex items-center border-b border-gray-200">
                <h3 className="font-['Montserrat'] font-medium text-base text-black">
                  Recent Earnings
                </h3>
              </div>
              {earningsTransactions.map((transaction) => (
                <div key={transaction.id} className="bg-white h-[86px] px-5 flex items-center justify-between border-b border-gray-200 last:border-b-0">
                  <div className="flex flex-col gap-1">
                    <div className="font-['Montserrat'] font-medium text-base text-black">
                      {transaction.title}
                    </div>
                    <div className="font-['Montserrat'] font-normal text-sm text-black">
                      {transaction.date}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="font-['Montserrat'] font-medium text-base text-[#00b388]">
                      {transaction.amount}
                    </div>
                    <div className="font-['Montserrat'] font-normal text-sm text-black">
                      {transaction.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="font-['Montserrat'] font-normal text-base text-black">
                Funds are released after job completion and approval.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
              <div className="bg-white h-[67px] px-5 flex items-center border-b border-gray-200">
                <h3 className="font-['Montserrat'] font-medium text-base text-black">
                  Payments in Escrow
                </h3>
              </div>
              {pendingTransactions.map((transaction) => (
                <div key={transaction.id} className="bg-white h-[86px] px-5 flex items-center justify-between border-b border-gray-200 last:border-b-0">
                  <div className="flex flex-col gap-1">
                    <div className="font-['Montserrat'] font-medium text-base text-black">
                      {transaction.title}
                    </div>
                    <div className="font-['Montserrat'] font-normal text-sm text-black">
                      {transaction.date}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="font-['Montserrat'] font-medium text-base text-[#00b388]">
                      {transaction.amount}
                    </div>
                    <div className="font-['Montserrat'] font-normal text-sm text-black">
                      {transaction.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="font-['Montserrat'] font-normal text-base text-black">
                Your payments are held securely in escrow until job completion. This protects both you and your clients.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Withdraw Funds Form */}
            <div className="bg-white rounded-lg p-10 shadow-sm border border-gray-100">
              <h3 className="font-['Montserrat'] font-semibold text-base text-[#201324] mb-8">
                Withdraw Funds
              </h3>

              {/* Available Balance */}
              <div className="bg-[rgba(81,0,139,0.1)] rounded-lg p-5 mb-8">
                <div className="font-['Montserrat'] font-medium text-base text-[#51008b]">
                  Available Balance: ₦75,000
                </div>
              </div>

              {/* Withdrawal Amount */}
              <div className="mb-6">
                <label className="font-['Montserrat'] font-medium text-base text-[#201324] mb-4 block">
                  Withdrawal Amount
                </label>
                <input
                  type="text"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-400 rounded-lg font-['Montserrat'] font-normal text-sm text-black"
                />
                <div className="font-['Montserrat'] font-normal text-xs text-[#201324] mt-2">
                  Minimum withdrawal: ₦5,000
                </div>
              </div>

              {/* Withdrawal Method */}
              <div className="mb-8">
                <label className="font-['Montserrat'] font-medium text-base text-[#201324] mb-4 block">
                  Withdrawal Method
                </label>
                <div className="space-y-4">
                  <div 
                    className={`border rounded-lg p-5 cursor-pointer ${
                      withdrawalMethod === 'bank' 
                        ? 'bg-[rgba(81,0,139,0.02)] border-[#51008b]' 
                        : 'border-gray-400'
                    }`}
                    onClick={() => setWithdrawalMethod('bank')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 relative">
                        <div className="absolute inset-[-37.5%]">
                          {withdrawalMethod === 'bank' ? (
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
                              <circle cx="14" cy="14" fill="#51008B" r="8" />
                              <circle cx="14" cy="14" r="11" stroke="#51008B" strokeOpacity="0.2" strokeWidth="6" />
                            </svg>
                          ) : (
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
                              <circle cx="8" cy="8" r="7.5" stroke="black" strokeOpacity="0.6" fill="none" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-['Montserrat'] font-medium text-sm text-black">
                          Bank Transfer
                        </div>
                        <div className="font-['Montserrat'] font-normal text-xs text-black">
                          Direct transfer to your bank account
                        </div>
                      </div>
                    </div>
                  </div>
                  <div 
                    className={`border rounded-lg p-5 cursor-pointer ${
                      withdrawalMethod === 'mobile' 
                        ? 'bg-[rgba(81,0,139,0.02)] border-[#51008b]' 
                        : 'border-gray-400'
                    }`}
                    onClick={() => setWithdrawalMethod('mobile')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 relative">
                        <div className="absolute inset-[-37.5%]">
                          {withdrawalMethod === 'mobile' ? (
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
                              <circle cx="14" cy="14" fill="#51008B" r="8" />
                              <circle cx="14" cy="14" r="11" stroke="#51008B" strokeOpacity="0.2" strokeWidth="6" />
                            </svg>
                          ) : (
                            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
                              <circle cx="8" cy="8" r="7.5" stroke="black" strokeOpacity="0.6" fill="none" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-['Montserrat'] font-medium text-sm text-black">
                          Mobile Money
                        </div>
                        <div className="font-['Montserrat'] font-normal text-xs text-black">
                          MTN, Airtel, or other mobile wallets
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="mb-6">
                <label className="font-['Montserrat'] font-medium text-base text-[#201324] mb-4 block">
                  Account Details
                </label>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-400 rounded-lg font-['Montserrat'] font-normal text-sm text-black"
                />
              </div>

              {/* Account Name */}
              <div className="mb-8">
                <label className="font-['Montserrat'] font-medium text-base text-[#201324] mb-4 block">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="Enter account Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-400 rounded-lg font-['Montserrat'] font-normal text-sm text-black"
                />
              </div>

              {/* Submit Button */}
              <button className="w-full bg-[#51008b] text-white py-4 px-5 rounded-lg font-['Montserrat'] font-medium text-xs hover:bg-[#51008b]/90 transition-colors">
                Request Withdrawal
              </button>
            </div>

            {/* Recent Withdrawals */}
            <div className="bg-white rounded-lg p-10 shadow-sm border border-gray-100">
              <h3 className="font-['Montserrat'] font-semibold text-base text-[#201324] mb-8">
                Recent Withdrawals
              </h3>
              <div className="space-y-4">
                {recentWithdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="border border-gray-400 rounded-lg p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-['Montserrat'] font-medium text-sm text-black">
                        {withdrawal.method}
                      </div>
                      <div className="font-['Montserrat'] font-medium text-sm text-black">
                        {withdrawal.amount}
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="font-['Montserrat'] font-normal text-xs text-black">
                        {withdrawal.date} • {withdrawal.account}
                      </div>
                      <div className={`font-['Montserrat'] font-normal text-xs ${withdrawal.statusColor}`}>
                        {withdrawal.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-16"></div>
    </div>
  );
}