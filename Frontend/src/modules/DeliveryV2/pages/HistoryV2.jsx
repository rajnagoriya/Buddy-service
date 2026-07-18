import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, ChevronDown, Loader2, Gift, X, 
  CheckCircle2, Clock, Search, History, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../hooks/useDeliveryBackNavigation';

/**
 * HistoryV2 - Vibrant Logo Theme.
 * Theme: Vibrant Green (#22C55E) & Deep Tech (#0F172A)
 */
export const HistoryV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTripType, setSelectedTripType] = useState("ALL TRIPS");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTripTypePicker, setShowTripTypePicker] = useState(false);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [bonusLoading, setBonusLoading] = useState(false);

  const tripTypes = ["ALL TRIPS", "Completed", "Cancelled", "Pending"];

  // Fetch Logic
  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        const params = {
          period: activeTab,
          date: dateStr,
          status: selectedTripType !== "ALL TRIPS" ? selectedTripType : undefined,
          limit: 1000
        };
        
        const response = await deliveryAPI.getTripHistory(params);
        if (response.data?.success) {
          setTrips(response.data.data.trips || []);
        }
      } catch (error) {
        toast.error("Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, [selectedDate, activeTab, selectedTripType]);

  // Bonus Logic
  useEffect(() => {
     if (showBonusModal) {
        const fetchBonus = async () => {
           setBonusLoading(true);
           try {
              const res = await deliveryAPI.getWalletTransactions({ type: 'bonus', limit: 50 });
              if (res.data?.success) setBonusTransactions(res.data.data.transactions || []);
           } catch (e) { toast.error("Failed to load bonuses"); }
           finally { setBonusLoading(false); }
        };
        fetchBonus();
     }
  }, [showBonusModal]);

  const formatDateDisplay = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    if (date.toDateString() === today.toDateString()) return `Today: ${day}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday: ${day}`;
    return day;
  };

  const recentDates = useMemo(() => {
    return [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    });
  }, []);

  const metrics = useMemo(() => {
     return trips.reduce((acc, trip) => {
        const status = (trip.status || '').toLowerCase();
        if (status === 'completed' || status === 'delivered') {
           const e = Number(
             trip.estimatedEarnings?.totalEarning ||
             trip.riderEarning || trip.rider_earning || trip.earnings || trip.earning || 
             trip.deliveryPayout || trip.payout || trip.deliveryEarning || trip.delivery_earning || 
             trip.deliveryCharge || trip.pricing?.riderEarning || trip.pricing?.deliveryFee || 
             trip.pricing?.rider_earning || trip.amount || trip.earningAmount || trip.netEarning || 
             trip.commission || trip.riderProfit || 0
           );
           const total = Number(trip.orderTotal || trip.amountToCollect || trip.pricing?.total || 0);
           acc.earnings += e || (total * 0.1);
        }
        return acc;
     }, { earnings: 0 });
  }, [trips]);

  const extractItems = (trip) => {
    const items = trip.items || trip.orderItems || [];
    if (items.length === 0) return 'Standard Delivery';
    const first = items[0];
    const qty = first.quantity || first.qty || 1;
    const name = first.name || first.itemName || 'Item';
    return `${qty}x ${name}${items.length > 1 ? ` +${items.length - 1} more` : ''}`;
  }

  return (
    <div className="delivery-v2-theme min-h-screen font-sans pb-32">
       {/* 1. Header (Premium Deep Tech) */}
       <div className="header-blend px-6 py-4 flex items-center justify-between sticky top-0 z-[100]">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all">
               <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-left">
               <h1 className="text-xl font-black text-white uppercase tracking-tighter leading-tight">Trip History</h1>
               <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-widest mt-0.5">Delivery Milestones</p>
            </div>
          </div>
          <button onClick={() => setShowBonusModal(true)} className="w-10 h-10 rounded-xl bg-[#16A34A]/10 flex items-center justify-center text-[#16A34A] border border-[#16A34A]/20 relative active:scale-90 transition-all">
             <Gift className="w-5 h-5" />
             {bonusTransactions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#16A34A] text-[#0F172A] text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                   {bonusTransactions.length}
                </span>
             )}
          </button>
       </div>

       {/* 2. Selection Tabs */}
       <div className="bg-white px-4 flex items-center gap-8 sticky top-[73px] z-[90] border-b border-gray-100">
          {['daily', 'weekly', 'monthly'].map((tab) => (
             <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-black uppercase tracking-widest relative ${activeTab === tab ? 'text-[#0F172A]' : 'text-gray-400'}`}
             >
                {tab}
                {activeTab === tab && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-[#16A34A] rounded-t-full" />}
             </button>
          ))}
       </div>

       {/* 3. Filter Controls */}
       <div className="bg-white px-4 py-4 flex gap-3 sticky top-[125px] z-[80]">
          <button 
             onClick={() => { setShowDatePicker(!showDatePicker); setShowTripTypePicker(false); }}
             className="flex-1 px-4 py-4 bg-[#F0FDF4] border border-[#E8F0E8] rounded-2xl flex items-center justify-between text-[#0F172A]"
          >
             <span className="text-xs font-black uppercase tracking-widest">{formatDateDisplay(selectedDate)}</span>
             <ChevronDown className={`w-4 h-4 text-[#16A34A] transform transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
          </button>
          <button 
             onClick={() => { setShowTripTypePicker(!showTripTypePicker); setShowDatePicker(false); }}
             className="w-[140px] px-4 py-4 bg-[#F0FDF4] border border-[#E8F0E8] rounded-2xl flex items-center justify-between text-[#0F172A]"
          >
             <span className="text-xs font-black uppercase tracking-widest">{selectedTripType}</span>
             <ChevronDown className={`w-4 h-4 text-[#16A34A] transform transition-transform ${showTripTypePicker ? 'rotate-180' : ''}`} />
          </button>
       </div>

       {/* Dropdowns */}
       <AnimatePresence>
          {showDatePicker && (
             <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="fixed left-4 right-4 top-[205px] z-[200] bg-white rounded-[2rem] shadow-2xl border border-gray-100 max-h-[300px] overflow-y-auto p-2">
                {recentDates.map((date, idx) => (
                   <button 
                      key={idx} 
                      onClick={() => { setSelectedDate(date); setShowDatePicker(false); }}
                      className={`w-full text-left p-4 rounded-xl text-xs font-black uppercase tracking-widest ${date.toDateString() === selectedDate.toDateString() ? 'bg-[#F0FDF4] text-[#0F172A]' : 'text-gray-400 hover:bg-gray-50'}`}
                   >
                      {formatDateDisplay(date)}
                   </button>
                ))}
             </motion.div>
          )}
          {showTripTypePicker && (
             <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="fixed right-4 top-[205px] w-48 z-[200] bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-2">
                {tripTypes.map((type, idx) => (
                   <button 
                      key={idx} 
                      onClick={() => { setSelectedTripType(type); setShowTripTypePicker(false); }}
                      className={`w-full text-left p-4 rounded-xl text-xs font-black uppercase tracking-widest ${type === selectedTripType ? 'bg-[#16A34A] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
                   >
                      {type}
                   </button>
                ))}
             </motion.div>
          )}
       </AnimatePresence>

       {/* 4. Page Content */}
       <div className="px-4 py-4 space-y-4">
          {/* Performance Summary Banner */}
          <div className="header-blend rounded-2xl p-5 shadow-lg relative overflow-hidden">
             <div className="relative z-10 text-left">
                <p className="text-[8px] font-black text-white/70 uppercase tracking-[0.2em] mb-0.5">Total Earnings</p>
                <h3 className="text-lg font-black text-white tracking-tighter">₹{metrics.earnings.toFixed(0)}</h3>
             </div>
          </div>

          {/* Trip List */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#16A34A]" />
                <p className="text-[#5D6D5D] text-[9px] font-black uppercase tracking-widest">Loading...</p>
             </div>
          ) : trips.length > 0 ? (
             <div className="space-y-3">
                {trips.map((trip, idx) => {
                   const isCompleted = (trip.status || '').toLowerCase() === 'completed' || (trip.status || '').toLowerCase() === 'delivered';
                   const isCancelled = (trip.status || '').toLowerCase() === 'cancelled';
                   const e = Number(
                     trip.estimatedEarnings?.totalEarning ||
                     trip.riderEarning || trip.rider_earning || trip.earnings || trip.earning || 
                     trip.deliveryPayout || trip.payout || trip.deliveryEarning || trip.delivery_earning || 
                     trip.deliveryCharge || trip.pricing?.riderEarning || trip.pricing?.deliveryFee || 
                     trip.pricing?.rider_earning || trip.amount || trip.earningAmount || trip.netEarning || 
                     trip.commission || trip.riderProfit || 0
                   );
                   const total = Number(trip.orderTotal || trip.amountToCollect || trip.pricing?.total || 0);
                   const payout = e || (total * 0.1);
                   const collection = total || Number(trip.codCollectedAmount || 0);
                   const isQR = (trip.paymentMethod || '').toLowerCase() === 'razorpay_qr';
                   const isCOD = (trip.paymentMethod || '').toLowerCase() === 'cash' || (trip.paymentMethod || '').toLowerCase() === 'cod';

                   return (
                      <div key={trip.orderId || idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                         <div className="flex justify-between items-start mb-3">
                              <div className="text-left">
                                 <h4 className="text-[11px] font-black text-[#0F172A] uppercase">{trip.orderId || 'ORDER-ID'}</h4>
                                 <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{trip.restaurant || 'Restaurant'}</p>
                              </div>
                               <div className="flex flex-col items-end gap-1">
                                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${isCompleted ? 'bg-[#F0FDF4] text-[#16A34A]' : isCancelled ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
                                     {trip.status || 'Status'}
                                  </span>
                                  {trip.splitInfo?.isShared && (
                                     <span className="text-[7px] font-black uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                                        <Users className="w-2.5 h-2.5 text-indigo-500" />
                                        Shared
                                     </span>
                                  )}
                               </div>
                          </div>
                          
                          <p className="text-[10px] text-gray-500 font-medium italic mb-4">"{extractItems(trip)}"</p>

                          {trip.splitInfo?.isShared && (
                             <div className="bg-indigo-50/50 rounded-xl p-3 mb-4 border border-indigo-100/50">
                                <div className="flex justify-between items-center mb-2">
                                   <p className="text-[8px] font-black text-indigo-400 uppercase">Partner</p>
                                   <p className="text-[9px] font-black text-indigo-900">{trip.splitInfo.otherPartner?.fullName || trip.splitInfo.otherPartner?.name || 'Partner'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                   <div className="bg-white/60 p-2 rounded-lg">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase">Primary</p>
                                      <p className="text-[9px] font-black text-gray-800">₹{trip.splitInfo.primaryEarning?.toFixed(0)}</p>
                                   </div>
                                   <div className="bg-white/60 p-2 rounded-lg">
                                      <p className="text-[7px] font-bold text-gray-400 uppercase">Shared</p>
                                      <p className="text-[9px] font-black text-gray-800">₹{trip.splitInfo.sharedEarning?.toFixed(0)}</p>
                                   </div>
                                </div>
                             </div>
                          )}

                         <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                              <div className="text-left">
                                 <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Time</p>
                                 <p className="text-[10px] font-black text-[#0F172A]">{trip.time || '--:--'}</p>
                              </div>
                              <div className="text-center">
                                 <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Collection</p>
                                 <p className="text-[10px] font-black text-[#0F172A]">₹{collection.toFixed(0)}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Payout</p>
                                 <p className="text-[10px] font-black text-[#16A34A]">₹{payout.toFixed(0)}</p>
                              </div>
                         </div>
                      </div>
                   );
                 })}
             </div>
          ) : (
             <div className="py-12 text-center flex flex-col items-center">
                <History className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-[9px] font-black text-gray-400 uppercase">No Trips</p>
             </div>
          )}
       </div>

       {/* Bonus Drawer */}
       <AnimatePresence>
          {showBonusModal && (
             <div className="fixed inset-0 z-[1000] flex items-end">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBonusModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full bg-white rounded-t-[2rem] p-6 pb-10 shadow-2xl">
                   <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-6" />
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3 text-left">
                         <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center text-[#0F172A] border border-[#DCFCE7]">
                            <Gift className="w-6 h-6 text-[#16A34A]" />
                         </div>
                         <div>
                            <h3 className="text-lg font-black text-[#0F172A] uppercase tracking-tight leading-tight">Bonus Records</h3>
                            <p className="text-[9px] font-bold text-[#5D6D5D] uppercase tracking-widest mt-0.5">Incentives credited</p>
                         </div>
                      </div>
                      <button onClick={() => setShowBonusModal(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><X className="w-5 h-5" /></button>
                   </div>
                   
                   <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                      {bonusLoading ? (
                         <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#16A34A]" /></div>
                      ) : bonusTransactions.length > 0 ? bonusTransactions.map((tx, i) => (
                         <div key={i} className="bg-[#F0FDF4] rounded-2xl p-4 border border-[#DCFCE7] flex justify-between items-center">
                            <div className="text-left">
                               <p className="text-lg font-black text-[#0F172A] mb-0.5">₹{Number(tx.amount || 0).toFixed(0)}</p>
                               <p className="text-[9px] font-bold text-[#5D6D5D] uppercase tracking-wide">{tx.description || 'System Bonus'}</p>
                               <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-1.5">{new Date(tx.createdAt || tx.date).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-white text-[#0F172A] text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-gray-100 shadow-sm">CREDITED</span>
                         </div>
                      )) : (
                         <div className="py-12 text-center flex flex-col items-center">
                            <Gift className="w-8 h-8 text-gray-200 mb-2" />
                            <p className="text-[9px] font-black text-gray-400 uppercase">No Bonuses</p>
                         </div>
                      )}
                   </div>
                   
                   <button onClick={() => setShowBonusModal(false)} className="w-full py-4 bg-[#16A34A] text-[#0F172A] rounded-2xl font-black uppercase tracking-[0.2em] text-xs mt-6 active:scale-95 transition-all shadow-xl shadow-green-600/20">Understood</button>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};

export default HistoryV2;
