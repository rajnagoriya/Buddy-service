import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, IndianRupee } from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

const resolveBankDetails = (profile = {}) => {
  const fromDocuments = profile?.documents?.bankDetails || {};
  return {
    accountHolderName:
      fromDocuments.accountHolderName || profile.bankAccountHolderName || '',
    accountNumber: fromDocuments.accountNumber || profile.bankAccountNumber || '',
    ifscCode: fromDocuments.ifscCode || profile.bankIfscCode || '',
    bankName: fromDocuments.bankName || profile.bankName || '',
    upiId: fromDocuments.upiId || profile.upiId || '',
  };
};

/**
 * Withdrawal page — enter amount and submit withdrawal request to admin.
 */
export const PocketBalanceV2 = () => {
  const navigate = useNavigate();
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankDetails, setBankDetails] = useState(null);
  const [walletState, setWalletState] = useState({
    pocketBalance: 0,
    withdrawalLimit: 100,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [walletRes, profileRes] = await Promise.all([
          deliveryAPI.getWallet(),
          deliveryAPI.getProfile().catch(() => null),
        ]);

        const wallet = walletRes?.data?.data?.wallet || {};
        const pocketBalance = Number(wallet.pocketBalance) || 0;
        const withdrawalLimit = Number(wallet.deliveryWithdrawalLimit) || 100;

        setWalletState({ pocketBalance, withdrawalLimit });
        if (pocketBalance > 0) {
          setAmount(String(Math.floor(pocketBalance)));
        }

        const profile = profileRes?.data?.data?.profile || profileRes?.data?.data?.user || {};
        setBankDetails(resolveBankDetails(profile));
      } catch (err) {
        toast.error('Failed to load withdrawal details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const parsedAmount = Number(amount);
  const canWithdraw =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= walletState.withdrawalLimit &&
    parsedAmount <= walletState.pocketBalance;

  const handleWithdraw = async () => {
    if (!canWithdraw) {
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
        toast.error('Enter a valid amount');
      } else if (parsedAmount < walletState.withdrawalLimit) {
        toast.error(`Minimum withdrawal is ${formatCurrency(walletState.withdrawalLimit)}`);
      } else if (parsedAmount > walletState.pocketBalance) {
        toast.error('Amount exceeds available balance');
      }
      return;
    }

    // Prefer bank details loaded on mount; refresh once if missing.
    let bank = bankDetails;
    if (!bank?.accountNumber) {
      try {
        const profileRes = await deliveryAPI.getProfile();
        const profile = profileRes?.data?.data?.profile || profileRes?.data?.data?.user || {};
        bank = resolveBankDetails(profile);
        setBankDetails(bank);
      } catch (_) {
        // Backend will still validate bank details on the partner record.
      }
    }

    if (bank && !bank.accountNumber) {
      toast.error('Please add bank details first');
      navigate('/food/delivery/profile/details');
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const payload = {
        amount: parsedAmount,
        paymentMethod: 'bank_transfer',
      };
      if (bank?.accountNumber) {
        payload.bankDetails = {
          accountNumber: bank.accountNumber,
          ifscCode: bank.ifscCode || '',
          bankName: bank.bankName || '',
          accountHolderName: bank.accountHolderName || '',
        };
      }

      const res = await deliveryAPI.createWithdrawalRequest(payload);
      const ok =
        res?.data?.success === true ||
        res?.status === 201 ||
        Boolean(res?.data?.data?.withdrawal);

      if (ok) {
        toast.success('Withdrawal request submitted. Waiting for admin approval.');
        goBack();
        return;
      }

      toast.error(res?.data?.message || 'Withdrawal failed');
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Withdrawal failed';
      if (/bank details/i.test(String(message))) {
        toast.error('Please add bank details first');
        navigate('/food/delivery/profile/details');
      } else {
        toast.error(message);
      }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const setMax = () => {
    setAmount(String(Math.floor(walletState.pocketBalance * 100) / 100));
  };

  return (
    <div className="min-h-screen bg-[#F8FFF9] font-sans pb-32">
      <div className="bg-white border-b border-gray-100 px-4 py-4 safe-top flex items-center gap-4">
        <button onClick={goBack} className="p-2 hover:bg-gray-50 rounded-xl">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-black text-[#0F172A] leading-none uppercase tracking-tight">
            Withdraw
          </h1>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Transfer to bank
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#16A34A]" />
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
            Loading...
          </p>
        </div>
      ) : (
        <div className="px-4 py-6 space-y-5">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Available balance
            </p>
            <h2 className="text-4xl font-black text-[#0F172A] tracking-tighter">
              {formatCurrency(walletState.pocketBalance)}
            </h2>
          </div>

          {walletState.pocketBalance < walletState.withdrawalLimit && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-900 uppercase tracking-tight">
                  Withdraw currently disabled
                </p>
                <p className="text-[10px] font-medium text-amber-800 mt-1">
                  Minimum withdrawal is {formatCurrency(walletState.withdrawalLimit)}. Your
                  balance is {formatCurrency(walletState.pocketBalance)}.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Withdrawal amount
              </p>
              <button
                type="button"
                onClick={setMax}
                disabled={walletState.pocketBalance <= 0}
                className="text-[10px] font-black uppercase tracking-widest text-[#16A34A] disabled:text-gray-300"
              >
                Max
              </button>
            </div>

            <div className="relative">
              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-11 pr-4 text-2xl font-black focus:border-[#16A34A] outline-none transition-all text-[#0F172A]"
              />
            </div>

            <p className="text-[10px] text-gray-400 font-medium">
              Min {formatCurrency(walletState.withdrawalLimit)} · Max{' '}
              {formatCurrency(walletState.pocketBalance)}
            </p>

            <button
              onClick={handleWithdraw}
              disabled={!canWithdraw || withdrawSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                canWithdraw && !withdrawSubmitting
                  ? 'bg-[#16A34A] text-white shadow-green-600/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {withdrawSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {withdrawSubmitting ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PocketBalanceV2;
