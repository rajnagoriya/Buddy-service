import React, { useEffect, useState } from 'react';
import { Bus, CheckCircle2, Loader2, Phone, UserRound, XCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';

const PendingBusDrivers = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await adminService.getPendingBusDrivers();
      setItems(response?.data?.data?.results || response?.data?.results || []);
    } catch (error) {
      setItems([]);
      window.alert(error?.response?.data?.message || 'Unable to load pending bus driver requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleApprove = async (driverId) => {
    setProcessingId(String(driverId));
    try {
      await adminService.approvePendingBusDriver(driverId);
      await loadItems();
    } catch (error) {
      window.alert(error?.response?.data?.message || 'Unable to approve bus driver request.');
    } finally {
      setProcessingId('');
    }
  };

  const handleReject = async (driverId) => {
    const rejectionReason = window.prompt('Reason for rejection', '');
    if (rejectionReason === null) {
      return;
    }

    setProcessingId(String(driverId));
    try {
      await adminService.rejectPendingBusDriver(driverId, rejectionReason);
      await loadItems();
    } catch (error) {
      window.alert(error?.response?.data?.message || 'Unable to reject bus driver request.');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-500">Bus Approval Queue</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Pending Bus Drivers</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
              Review bus driver signup requests and approve them into the correct bus service.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-sky-200 bg-white px-6 py-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-500">Waiting</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{items.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-[2.5rem] border border-slate-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white px-8 py-20 text-center">
            <Bus className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-slate-900">No pending bus driver requests</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">New bus driver signups will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const itemId = item.id || item._id;
              const isProcessing = processingId === String(itemId);

              return (
                <div key={itemId} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <Bus size={20} />
                    </div>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-600">
                      Pending
                    </span>
                  </div>

                  <h2 className="mt-5 text-lg font-black text-slate-900">{item.name || 'Unnamed driver'}</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <Phone size={16} className="mt-0.5 text-slate-300" />
                      <p className="font-medium text-slate-500">{item.phone || 'No phone provided'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bus Service</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{item.busServiceName || 'No bus service selected'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applicant</p>
                      <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-900">
                        <UserRound size={14} className="text-slate-400" />
                        <span>{item.userName || item.name || 'Pending applicant'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(itemId)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(itemId)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingBusDrivers;
