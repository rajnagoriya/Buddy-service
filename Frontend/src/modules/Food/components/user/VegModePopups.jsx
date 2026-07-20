import React from 'react';
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, AlertCircle, RefreshCw, X } from "lucide-react";

const PopupContent = ({ icon: Icon, iconClass, bgClass, ringClass, title, description, children, onClose }) => (
  <motion.div
    initial={{ scale: 0.9, opacity: 0, y: 20 }}
    animate={{ scale: 1, opacity: 1, y: 0 }}
    exit={{ scale: 0.9, opacity: 0, y: 20 }}
    className={`relative bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 sm:p-8 w-[calc(100%-2rem)] max-w-[360px] mx-auto shadow-2xl overflow-hidden border ${bgClass} border-opacity-30`}
  >
    {/* Decorative Elements */}
    <div className={`absolute -top-10 -right-10 w-32 h-32 ${bgClass} opacity-20 rounded-full blur-3xl`} />
    <div className={`absolute -bottom-10 -left-10 w-32 h-32 ${bgClass} opacity-20 rounded-full blur-3xl`} />

    <div className="relative text-center">
      <div className={`w-20 h-20 ${bgClass} opacity-20 dark:opacity-30 absolute top-0 left-1/2 -translate-x-1/2 rounded-full`} />
      <div className={`w-20 h-20 bg-white dark:bg-transparent rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ${ringClass} relative z-10`}>
        <Icon className={`w-10 h-10 ${iconClass}`} />
      </div>
      
      <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-[15px] leading-relaxed mb-8 font-medium">
        {description}
      </p>
      
      {children}
    </div>
  </motion.div>
);

const VegModePopups = ({ 
  showVegModePopup, 
  showSwitchOffPopup, 
  onCloseVegPopup, 
  onCloseSwitchOffPopup,
  onConfirmSwitchOff 
}) => {
  return (
    <>
      {/* Pure Veg Mode Confirmation Overlay */}
      {createPortal(
        <AnimatePresence>
          {showVegModePopup && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCloseVegPopup}
              />
              <PopupContent
                icon={Leaf}
                iconClass="text-green-600 dark:text-green-400"
                bgClass="bg-green-500"
                ringClass="ring-green-50 dark:ring-green-500/10"
                title="Pure Veg Mode"
                description="We've filtered your feed to show only 100% vegetarian restaurants. Enjoy your meat-free browsing!"
                onClose={onCloseVegPopup}
              >
                <button
                  onClick={onCloseVegPopup}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-[14px] shadow-lg shadow-green-500/25 transition-all duration-300 transform active:scale-95 text-lg"
                >
                  Great, thanks!
                </button>
              </PopupContent>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Pure Veg Mode Switch Off Confirmation */}
      {createPortal(
        <AnimatePresence>
          {showSwitchOffPopup && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCloseSwitchOffPopup}
              />
              <PopupContent
                icon={AlertCircle}
                iconClass="text-green-600 dark:text-green-400"
                bgClass="bg-green-500"
                ringClass="ring-green-50 dark:ring-green-500/10"
                title="Switching Off?"
                description="This will re-enable non-vegetarian options in your feed. Are you sure you want to continue?"
                onClose={onCloseSwitchOffPopup}
              >
                <div className="flex flex-col gap-3">
                  <button
                    onClick={onConfirmSwitchOff}
                    className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-[14px] shadow-lg shadow-green-500/25 transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 text-lg"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Yes, Switch Off
                  </button>
                  <button
                    onClick={onCloseSwitchOffPopup}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-[14px] transition-all duration-300 text-base"
                  >
                    Keep it On
                  </button>
                </div>
              </PopupContent>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default React.memo(VegModePopups);

