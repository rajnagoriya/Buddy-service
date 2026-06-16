import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, IndianRupee, ArrowRight,
  ShieldCheck, AlertTriangle, HelpCircle,
  Receipt, FileText, LayoutGrid, X, ChevronRight,
  Sparkles, Loader2, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";

/**
 * PocketV2 - Vibrant Logo Theme.
 * Background: #F8FFF9
 * Theme: Vibrant Green (#22C55E) & Deep Tech (#0F172A)
 */
export const PocketV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
    totalBalance: 0,
    cashInHand: 0,
    availableCashLimit: 0,
    totalCashLimit: 0,
    weeklyEarnings: 0,
    weeklyOrders: 0,
    payoutAmount: 0,
    payoutPeriod: 'Current Week',
    bankDetailsFilled: false,
    period: 'week'
  });

  const [activeOffer, setActiveOffer] = useState({
    targetAmount: 0,
    targetOrders: 0,
    currentOrders: 0,
    currentEarnings: 0,
    validTill: '',
    isLive: false
  });

  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileRes, earningsRes, walletRes] = await Promise.all([
          deliveryAPI.getProfile(),
          deliveryAPI.getEarnings({ period: walletState.period }),
          deliveryAPI.getWallet()
        ]);

        const profile = profileRes?.data?.data?.profile || {};
        const summary = earningsRes?.data?.data?.summary || {};
        const wallet = walletRes?.data?.data?.wallet || {};
        const activeAddonsRes = await deliveryAPI.getActiveEarningAddons().catch(() => null);
        const activeOfferPayload =
          activeAddonsRes?.data?.data?.activeOffer ||
          activeAddonsRes?.data?.activeOffer ||
          null;
        
        const bankDetails = profile?.documents?.bankDetails;
        const isFilled = !!(bankDetails?.accountNumber);

        setWalletState(prev => ({
          ...prev,
          totalBalance: Number(wallet.pocketBalance) || 0,
          cashInHand: Number(wallet.cashInHand) || 0,
          availableCashLimit: Number(wallet.availableCashLimit) || 0,
          totalCashLimit: Number(wallet.totalCashLimit) || 0,
          weeklyEarnings: Number(summary.totalEarnings) || 0,
          weeklyOrders: Number(summary.totalOrders) || 0,
          payoutAmount: Number(wallet.lastPayout?.amount || wallet.totalWithdrawn || 0),
          payoutPeriod: wallet.lastPayout ? new Date(wallet.lastPayout.date).toLocaleDateString() : 'No recent payout',
          bankDetailsFilled: isFilled
        }));

        setActiveOffer({
           targetAmount: Number(activeOfferPayload?.targetAmount) || 0,
           targetOrders: Number(activeOfferPayload?.targetOrders) || 0,
           currentOrders: Number(activeOfferPayload?.currentOrders) || 0,
           currentEarnings: Number(activeOfferPayload?.currentEarnings) || 0,
           validTill: activeOfferPayload?.validTill || '',
           isLive: Boolean(activeOfferPayload)
        });

      } catch (err) {
        toast.error('Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [walletState.period]);

  const updatePeriod = (p) => setWalletState(prev => ({ ...prev, period: p }));

  const getPeriodLabel = () => {
    switch(walletState.period) {
      case 'today': return 'Today';
      case 'month': return 'This Month';
      case 'all': return 'Lifetime';
      default: return 'This Week';
    }
  };

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid amount (minimum ₹1)");
      return;
    }
    
    if (amt > walletState.cashInHand) {
       toast.error(`Deposit amount cannot exceed cash in hand (₹${walletState.cashInHand})`);
       return;
    }

    try {
      setDepositing(true);
      const orderRes = await deliveryAPI.createDepositOrder(amt);
      const data = orderRes?.data?.data;
      const rp = data?.razorpay;
      
      if (!rp?.orderId) {
        toast.error("Payment initialization failed");
        setDepositing(false);
        return;
      }

      const profileRes = await deliveryAPI.getProfile();
      const profile = profileRes?.data?.data?.profile || {};
      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash limit deposit - ₹${amt}`,
        prefill: { 
           name: profile.name, 
           email: profile.email, 
           contact: profile.phone 
        },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: amt
            });
            if (verifyRes?.data?.success) {
              toast.success("Deposit successful");
              setShowDepositPopup(false);
              setDepositAmount("");
              // Refresh data
              window.location.reload();
            }
          } catch (err) {
            toast.error("Verification failed");
          } finally {
            setDepositing(false);
          }
        },
        onError: () => setDepositing(false),
        onClose: () => setDepositing(false)
      });
    } catch (err) {
      setDepositing(false);
      toast.error("Deposit failed to start");
    }
  };

  const ordersProgress = activeOffer.targetOrders > 0 ? Math.min(activeOffer.currentOrders / activeOffer.targetOrders, 1) : 0;
  const earningsProgress = activeOffer.targetAmount > 0 ? Math.min(activeOffer.currentEarnings / activeOffer.targetAmount, 1) : 0;
  const hasActiveOffer = activeOffer.isLive && (activeOffer.targetAmount > 0 || activeOffer.targetOrders > 0);

  const formatOfferValidTill = (validTill) => {
    if (!validTill) return '';
    const parsed = new Date(validTill);
    if (Number.isNaN(parsed.getTime())) return String(validTill);
    return parsed.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatDate = (d) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8FFF9] flex flex-col items-center justify-center font-sans">
       <div className="w-10 h-10 border-4 border-[#16A34A] border-t-transparent rounded-full animate-spin mb-4" />
       <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Pocket...</p>
    </div>
  );

  return (
    <div className="delivery-v2-theme min-h-screen text-[#0F172A] font-sans pb-24">
      {/* ─── 1. TOP HEADER (Brand Gradient) ─── */}
      <div className="header-blend p-5 safe-top w-full shadow-lg rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div onClick={() => navigate('/driver/profile')} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 cursor-pointer active:scale-95 transition-all">
                <User className="w-5 h-5" />
             </div>
             <div className="text-left">
                <h1 className="text-lg font-black text-white uppercase tracking-tight">Pocket</h1>
                <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.2em]">Partner Wallet</p>
             </div>
          </div>
          <button onClick={() => setShowDepositPopup(true)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all">
             <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* 1. BANK DETAILS BANNER */}
        {!walletState.bankDetailsFilled && (
          <div className="bg-[#16A34A]/10 rounded-2xl p-4 flex items-center gap-3 border border-[#16A34A]/20 mb-6">
             <div className="w-10 h-10 bg-[#16A34A] rounded-xl flex items-center justify-center text-[#0F172A] shrink-0 shadow-lg shadow-green-600/20">
                <FileText className="w-5 h-5" />
             </div>
             <div className="flex-1">
                <h3 className="text-[11px] font-black text-[#0F172A] mb-0.5 uppercase tracking-tight">Submit bank details</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase">Required for payouts</p>
             </div>
             <button 
               onClick={() => navigate('/food/delivery/profile/details')}
               className="bg-[#0F172A] text-[#16A34A] px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
             >
                Submit
             </button>
          </div>
        )}

        {/* 2. WEEKLY EARNINGS CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-black/5 border border-gray-100 text-center mb-6 transition-all">
           <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest">Earnings: {walletState.period === 'week' ? getCurrentWeekRange() : getPeriodLabel()}</p>
              <select 
                value={walletState.period} 
                onChange={(e) => updatePeriod(e.target.value)}
                className="text-[8px] font-black uppercase tracking-tight bg-gray-50 border-none rounded-lg px-2 py-1 outline-none"
              >
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="all">All</option>
              </select>
           </div>
           <h2 className="text-4xl font-black text-[#0F172A] tracking-tighter" onClick={() => navigate('/food/delivery/earnings')}>
              ₹{walletState.weeklyEarnings.toFixed(0)}
           </h2>
        </div>

        {/* 3. EARNINGS GUARANTEE */}
        {hasActiveOffer && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-6">
           <div className="header-blend p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white leading-none mb-1">Guarantee</h3>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                   <span className="text-[8px] font-black text-white/80 uppercase tracking-widest">Live Offer</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-white">₹{activeOffer.targetAmount}</span>
                <p className="text-[8px] text-white/60 font-bold uppercase tracking-tight">Minimum Payout</p>
              </div>
           </div>
           
           <div className="p-4 flex items-center justify-between bg-gray-50/50">
              <div className="flex-1">
                 <p className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest mb-1.5">Weekly Progress</p>
                 <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(activeOffer.currentOrders / activeOffer.targetOrders) * 100}%` }} transition={{ duration: 1 }} className="h-full bg-[#16A34A]" />
                 </div>
                 <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">{activeOffer.currentOrders} Orders</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Target: {activeOffer.targetOrders}</span>
                 </div>
              </div>
              
              <div className="ml-6 shrink-0">
                 <div className="relative">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                       <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                       <motion.circle 
                          cx="50" cy="50" r="45" fill="none" stroke="#0F172A" strokeWidth="8" strokeLinecap="round"
                          initial={{ pathLength: 0 }} animate={{ pathLength: ordersProgress }} transition={{ duration: 1.5, ease: "easeOut" }}
                       />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
                       <span className="text-base font-black text-[#0F172A] leading-none">{activeOffer.currentOrders}</span>
                       <span className="text-[8px] font-bold text-gray-400 uppercase">of {activeOffer.targetOrders}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
        )}

        {/* 4. POCKET ACTION BUTTONS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
           <button 
              onClick={() => navigate('/food/delivery/pocket/balance')}
              className="w-full p-4 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[#0F172A] border border-gray-100">
                    <Wallet className="w-5 h-5" />
                 </div>
                 <div className="text-left">
                    <span className="text-sm font-black text-[#0F172A] block uppercase tracking-tight">Pocket balance</span>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Withdrawal Hub</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-sm font-black text-[#0F172A]">₹{walletState.totalBalance.toFixed(2)}</span>
                 <ChevronRight className="w-4 h-4 text-gray-200" />
              </div>
           </button>

           <button 
              onClick={() => navigate('/food/delivery/pocket/cash-limit')}
              className="w-full p-4 border-b border-gray-50 flex items-center justify-between active:bg-gray-50 transition-colors"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[#0F172A] border border-gray-100">
                    <ShieldCheck className="w-5 h-5" />
                 </div>
                 <div className="text-left">
                    <span className="text-sm font-black text-[#0F172A] block uppercase tracking-tight">Available cash limit</span>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Spend Control</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-sm font-black text-[#0F172A]">₹{walletState.availableCashLimit.toFixed(2)}</span>
                 <ChevronRight className="w-4 h-4 text-gray-200" />
              </div>
           </button>

           <div className="p-4">
              <button 
                 onClick={() => setShowDepositPopup(true)}
                 className="w-full py-4 bg-[#16A34A] hover:bg-[#15803D] text-[#0F172A] rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-green-600/20 active:scale-95 transition-all border border-white/20"
              >
                 Deposit Cash
              </button>
           </div>
        </div>

        {/* 5. MORE SERVICES */}
        <div className="space-y-3">
           <div className="grid grid-cols-2 gap-3">
              <div onClick={() => navigate('/food/delivery/pocket/payout')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 transition-colors">
                 <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3 border border-blue-100">
                    <IndianRupee className="w-4 h-4" />
                 </div>
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Payout</p>
                 <p className="text-lg font-black text-[#0F172A] leading-none mb-1">₹{walletState.payoutAmount}</p>
                 <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">Prev Week Info</p>
              </div>

              <div onClick={() => navigate('/food/delivery/pocket/limit-settlement')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between transition-colors">
                 <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-3 border border-orange-100">
                    <Receipt className="w-4 h-4" />
                 </div>
                 <p className="text-[11px] font-black text-[#0F172A] uppercase tracking-widest leading-tight">Limit Settlement</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <div onClick={() => navigate('/food/delivery/pocket/deductions')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between transition-colors">
                 <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-3 border border-red-100">
                    <FileText className="w-4 h-4" />
                 </div>
                 <p className="text-[11px] font-black text-[#0F172A] uppercase tracking-widest leading-tight">Deduction List</p>
              </div>

              <div onClick={() => navigate('/food/delivery/pocket/details')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between transition-colors">
                 <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                    <LayoutGrid className="w-4 h-4" />
                 </div>
                 <p className="text-[11px] font-black text-[#0F172A] uppercase tracking-widest leading-tight">Statement</p>
              </div>
           </div>
        </div>
      </div>

      {/* DEPOSIT MODAL */}
      <AnimatePresence>
         {showDepositPopup && (
            <div className="fixed inset-0 z-[1000] flex items-end">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDepositPopup(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
               <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full bg-white rounded-t-[2rem] p-6 pb-10 shadow-2xl">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />
                  
                  <div className="text-center mb-6">
                     <div className="w-16 h-16 bg-[#F0FDF4] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#DCFCE7] text-[#16A34A]">
                        <IndianRupee className="w-8 h-8" />
                     </div>
                     <h3 className="text-xl font-black text-[#0F172A] mb-0.5 uppercase tracking-tight">Deposit Cash</h3>
                     <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Settle Hand Dues</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cash in hand</span>
                        <span className="text-sm font-black text-[#0F172A]">₹{walletState.cashInHand}</span>
                     </div>
                     <div className="relative">
                        <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                           type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                           placeholder="Enter amount"
                           className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-10 pr-4 text-lg font-black focus:border-[#16A34A] outline-none transition-all text-[#0F172A]"
                        />
                     </div>
                  </div>
                  
                  <div className="space-y-3">
                      <button 
                         onClick={handleDeposit}
                         disabled={depositing}
                         className="w-full py-4 bg-[#16A34A] text-[#0F172A] rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-gray-200 disabled:shadow-none"
                      >
                         {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                         {depositing ? 'Processing...' : 'Proceed to Pay'}
                      </button>
                     <button onClick={() => setShowDepositPopup(false)} className="w-full py-2 text-gray-400 font-black text-[9px] uppercase tracking-widest">Maybe Later</button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default PocketV2;
