import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import bikeIcon from '../../../assets/icons/bike.png';
import deliveryIcon from '../../../assets/icons/Delivery.png';

const ActionCard = ({ title, description, image, surfaceClass, glowClass, buttonBgClass, path }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(path)}
      className={`group relative flex min-h-[180px] flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200/40 bg-white/70 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)] hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] transition-shadow duration-300 cursor-pointer ${surfaceClass}`}
    >
      {/* Dynamic Hover Glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
        style={{
          background: `radial-gradient(circle at 75% 75%, rgba(${glowClass}, 0.12) 0%, transparent 65%)`
        }}
      />
      
      {/* Corner visual gradient accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/40 to-transparent blur-md pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <div className="max-w-[130px] space-y-1">
          <h3 className="text-[20px] font-bold tracking-tight text-slate-900 leading-tight">
            {title}
          </h3>
          <p className="text-[11px] font-medium text-slate-500 leading-normal">
            {description}
          </p>
        </div>

        <div className="mt-4 flex items-center">
          <div className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-white shadow-md transition-all duration-300 group-hover:shadow-lg ${buttonBgClass}`}>
            <span>Go</span>
            <ArrowRight size={11} strokeWidth={3} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
          </div>
        </div>
      </div>

      {/* Floating Spotlight Image */}
      <div className="absolute -bottom-2 -right-2 w-28 h-28 pointer-events-none select-none">
        <div className="relative w-full h-full">
          <div className="absolute inset-2 rounded-full blur-xl opacity-20 group-hover:opacity-35 transition-opacity duration-300 bg-white" />
          <img
            src={image}
            alt=""
            className="w-full h-full object-contain drop-shadow-[0_16px_24px_rgba(15,23,42,0.12)] transform group-hover:scale-110 group-hover:-translate-y-1 group-hover:-translate-x-1 transition-transform duration-300"
          />
        </div>
      </div>
    </motion.div>
  );
};

const ActionsSection = () => {
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  return (
    <div className="px-5">
      <div className="mb-3.5 ml-1">
        <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight">What do you need today?</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ActionCard
          title="Ride"
          description="Bike, auto, and cab rides."
          image={bikeIcon}
          surfaceClass="bg-gradient-to-br from-orange-50/60 via-white/80 to-orange-100/40"
          glowClass="249,115,22"
          buttonBgClass="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          path={`${routePrefix}/ride/select-category`}
        />

        <ActionCard
          title="Delivery"
          description="Send parcels across the city."
          image={deliveryIcon}
          surfaceClass="bg-gradient-to-br from-indigo-50/60 via-white/80 to-indigo-100/40"
          glowClass="99,102,241"
          buttonBgClass="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
          path="/parcel/type"
        />
      </div>
    </div>
  );
};

export default ActionsSection;
