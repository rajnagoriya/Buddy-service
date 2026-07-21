import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import autoIcon from '../../../assets/icons/auto.png';
import bikeIcon from '../../../assets/icons/bike.png';
import carIcon from '../../../assets/icons/car.png';
import premiumCarIcon from '../../../assets/icons/premium_car.png';
import rideNowBanner from '../../../assets/images/yellow_ola_style_taxi.png';

const rotatingCards = [
  {
    icon: Clock3,
    iconClass: 'text-orange-600',
    title: 'In a hurry?',
    description: 'Auto for shorter wait times.',
    actionClass: 'bg-orange-50 text-orange-500',
    path: '/taxi/user/ride/select-location',
    state: { selectedCategory: 'auto' },
    images: [
      { src: autoIcon, alt: 'Auto' },
      { src: bikeIcon, alt: 'Bike' },
    ],
  },
  {
    icon: ShieldCheck,
    iconClass: 'text-blue-600',
    title: 'Need more space?',
    description: 'Cab for luggage or comfort.',
    actionClass: 'bg-blue-50 text-blue-500',
    path: '/taxi/user/ride/select-location',
    state: { selectedCategory: 'car' },
    images: [
      { src: carIcon, alt: 'Taxi' },
      { src: premiumCarIcon, alt: 'Sedan' },
    ],
  },
];

const ImageCarousel = ({ images, className }) => {
  const activeImage = images?.[0];

  if (!activeImage) return null;

  return (
    <div className={className}>
      <img src={activeImage.src} alt={activeImage.alt} className="h-full w-full object-contain drop-shadow-xl" />
    </div>
  );
};

const PromoCard = ({ icon: Icon, iconClass, title, description, actionClass, path, state, images, onNavigate }) => (
  <motion.div
    whileTap={{ scale: 0.98 }}
    onClick={() => onNavigate(path, { state })}
    className="relative min-h-[140px] overflow-hidden rounded-2xl border border-white/80 bg-white/88 p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.07)] cursor-pointer"
  >
    <div className={`flex items-center gap-2 ${iconClass}`}>
      <Icon size={11} strokeWidth={2.5} />
    </div>
    <h3 className="mt-2.5 text-[17px] font-black leading-snug tracking-tight text-gray-900">{title}</h3>
    <p className="mt-1 max-w-[132px] text-[10px] font-bold leading-snug text-gray-500">{description}</p>
    <div className={`mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full ${actionClass}`}>
      <ArrowRight size={15} strokeWidth={2.5} />
    </div>
    <ImageCarousel images={images} className="absolute -bottom-2 -right-2 w-24 h-24 opacity-95 pointer-events-none flex items-end justify-end" />
  </motion.div>
);

const PromoBanners = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  return (
    <div className="px-5 space-y-4">
      <div className="mb-1 ml-1">
        <h2 className="text-[19px] font-black text-gray-900 tracking-tight">Recommended for you</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rotatingCards.map((card, index) => (
          <PromoCard 
            key={`${String(card.title || '').trim() || 'promo'}-${index}`} 
            {...card} 
            path={routePrefix ? `${routePrefix}/ride/select-location` : '/ride/select-location'}
            onNavigate={navigate} 
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(240px_160px_at_20%_25%,rgba(56,189,248,0.16),transparent_60%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(260px_180px_at_85%_85%,rgba(251,191,36,0.10),transparent_62%)]" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[168px] items-end justify-between gap-4">
          <div className="max-w-[62%]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
              <Sparkles size={12} strokeWidth={2.5} className="text-cyan-200" />
              Savings
            </div>

            <h3 className="mt-3 text-[20px] font-black leading-tight tracking-tight text-white">
              Better savings on your next ride.
            </h3>
            <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-white/70">Book quickly and save more.</p>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`${routePrefix}/ride/select-category`)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-black text-slate-900 shadow-lg shadow-black/15 active:scale-95"
            >
              Ride Now
              <ArrowRight size={14} strokeWidth={3} />
            </motion.button>
          </div>

          <div className="pointer-events-none w-[140px] shrink-0 opacity-95">
            <img src={rideNowBanner} alt="Promo" className="w-full drop-shadow-2xl" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PromoBanners;
