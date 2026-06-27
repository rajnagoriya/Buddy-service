import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, MapPin } from 'lucide-react';

const services = [
  {
    emoji: '🍔',
    text: 'Food',
    bg: 'rgba(254, 243, 199, 0.6)', // Warm Amber tint
    borderColor: 'rgba(245, 158, 11, 0.25)',
    shadow: 'rgba(245, 158, 11, 0.2)',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    themeColor: '#D97706', // amber
  },
  {
    emoji: '🛒',
    text: 'Grocery',
    bg: 'rgba(232, 240, 232, 0.7)', // Light Sage mint
    borderColor: 'rgba(74, 124, 89, 0.25)',
    shadow: 'rgba(74, 124, 89, 0.2)',
    glowColor: 'rgba(74, 124, 89, 0.15)',
    themeColor: '#4A7C59', // green
  },
  {
    emoji: '🚕',
    text: 'Taxi',
    bg: 'rgba(254, 249, 195, 0.6)', // Yellow tint
    borderColor: 'rgba(234, 179, 8, 0.25)',
    shadow: 'rgba(234, 179, 8, 0.2)',
    glowColor: 'rgba(234, 179, 8, 0.15)',
    themeColor: '#CA8A04', // yellow
  }
];

const particles = [
  { size: 90, left: '10%', top: '15%', delay: 0, duration: 9 },
  { size: 140, left: '80%', top: '12%', delay: 1.5, duration: 11 },
  { size: 110, left: '5%', top: '50%', delay: 3, duration: 8 },
  { size: 120, left: '85%', top: '60%', delay: 0.8, duration: 10 },
  { size: 100, left: '15%', top: '82%', delay: 2, duration: 9 },
  { size: 130, left: '75%', top: '85%', delay: 4, duration: 12 },
];

export default function SplashScreen({ onFinish }) {
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    // Morph loop: cycle through the three services
    const serviceInterval = setInterval(() => {
      setActiveServiceIndex((prev) => (prev + 1) % services.length);
    }, 900);

    return () => clearInterval(serviceInterval);
  }, []);

  useEffect(() => {
    // Show splash for 2.7 seconds then trigger finish transition
    const timer = setTimeout(() => {
      setIsFinishing(true);
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Exit duration is 400ms
    if (isFinishing) {
      const timer = setTimeout(() => {
        if (onFinish) onFinish();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isFinishing, onFinish]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-white dark:bg-[#0A0A0A] transition-colors duration-500">
      {/* Subtle radial gradient */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(35,54,26,0.08)_0%,rgba(255,255,255,1)_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(74,124,89,0.12)_0%,rgba(10,10,10,1)_70%)] pointer-events-none" 
        style={{ willChange: 'background' }}
      />

      {/* Floating background particles */}
      {particles.map((p, index) => (
        <div
          key={index}
          className="absolute rounded-full bg-[#4A7C59] dark:bg-[#E8F0E8] opacity-[0.03] dark:opacity-[0.02] blur-xl pointer-events-none floating-particle"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            willChange: 'transform',
          }}
        />
      ))}

      <AnimatePresence mode="wait">
        {!isFinishing && (
          <motion.div
            key="splash-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              scale: 1.03,
              filter: 'blur(6px)',
            }}
            transition={{ 
              duration: 0.4, 
              ease: 'easeInOut' 
            }}
            style={{ willChange: 'transform, opacity, filter' }}
            className="flex flex-col items-center justify-center px-6 relative z-10"
          >
            {/* Ambient Glow behind Logo */}
            <div className="relative flex items-center justify-center mb-6">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.15, 0.35, 0.15],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: 'easeInOut',
                }}
                style={{
                  backgroundColor: services[activeServiceIndex].glowColor,
                  willChange: 'transform, opacity',
                }}
                className="absolute w-32 h-32 md:w-36 md:h-36 rounded-full blur-2xl pointer-events-none transition-colors duration-500"
              />

              {/* Logo Wrapper with Entrance & Pulse */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ willChange: 'transform, opacity' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.5,
                    ease: 'easeInOut',
                    delay: 0.6,
                  }}
                  style={{
                    backgroundColor: services[activeServiceIndex].bg,
                    borderColor: services[activeServiceIndex].borderColor,
                    boxShadow: `0 10px 30px -10px ${services[activeServiceIndex].shadow}`,
                    willChange: 'transform',
                  }}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-3xl border flex items-center justify-center backdrop-blur-md relative transition-all duration-500"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeServiceIndex}
                      initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.7, rotate: 10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ willChange: 'transform, opacity' }}
                      className="text-4xl md:text-5xl select-none"
                    >
                      {services[activeServiceIndex].emoji}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>

            {/* Brand Text */}
            <motion.h1
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
              style={{ willChange: 'transform, opacity' }}
              className="text-[36px] md:text-[48px] font-bold tracking-tight select-none font-['Outfit'] premium-shine text-center leading-none"
            >
              Buddy Service
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
              style={{ willChange: 'transform, opacity' }}
              className="text-xs md:text-sm tracking-[0.25em] font-semibold text-[#4A7C59] dark:text-[#A3B899] uppercase mt-3 select-none text-center"
            >
              Food • Grocery • Taxi
            </motion.p>

            {/* Route Loader Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              style={{ willChange: 'opacity' }}
              className="relative w-56 h-10 mt-12 flex items-center"
            >
              {/* Route Track Background */}
              <div className="absolute left-3 right-8 h-[2px] bg-gray-100 dark:bg-neutral-800/60 rounded-full" />
              
              {/* Route Progress Line */}
              <motion.div
                animate={{ scaleX: [0, 1] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.0,
                  ease: 'easeInOut',
                }}
                style={{
                  originX: 0,
                  backgroundColor: services[activeServiceIndex].themeColor,
                  willChange: 'transform',
                }}
                className="absolute left-3 right-8 h-[2px] rounded-full transition-colors duration-500"
              />

              {/* Start Pin (Solid Dot) */}
              <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-[#23361A] dark:bg-[#A3B899] z-10" />
              
              {/* Taxi / Car Icon with road vibration & physics tilt */}
              <motion.div
                animate={{ 
                  x: [0, 160],
                  y: [0, -0.75, 0, -1.25, 0, -0.75, 0],
                  rotate: [0, -3, 0, 3, 0]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.0,
                  ease: 'easeInOut',
                }}
                style={{ willChange: 'transform' }}
                className="absolute left-3 flex items-center z-10"
              >
                <Car 
                  className="w-5 h-5 transition-colors duration-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]" 
                  style={{ color: services[activeServiceIndex].themeColor }}
                />
              </motion.div>

              {/* Destination MapPin with Pulse Effect */}
              <MapPin 
                className="absolute right-2 w-4.5 h-4.5 -translate-y-[1px] transition-colors duration-500 animate-pulse z-10"
                style={{ color: services[activeServiceIndex].themeColor }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&display=swap');
        
        @keyframes float-particle {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(15px, -25px) scale(1.15); }
        }
        .floating-particle {
          animation: float-particle 10s ease-in-out infinite;
        }

        @keyframes textShine {
          0% { background-position: 150% center; }
          100% { background-position: -150% center; }
        }
        .premium-shine {
          background: linear-gradient(
            90deg,
            #23361A 0%,
            #23361A 35%,
            #4A7C59 50%,
            #23361A 65%,
            #23361A 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: textShine 3.2s linear infinite;
        }
        .dark .premium-shine {
          background: linear-gradient(
            90deg,
            #F8F9FA 0%,
            #F8F9FA 35%,
            #E8F0E8 50%,
            #F8F9FA 65%,
            #F8F9FA 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </div>
  );
}
