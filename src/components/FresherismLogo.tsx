/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import logo2Img from '../assets/logo2.png';

interface FresherismLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  showUniversityHeader?: boolean;
  showDatesBadge?: boolean;
  bgMode?: 'dark' | 'light';
}

export default function FresherismLogo({
  size = 'md',
  showUniversityHeader = true,
  showDatesBadge = false,
  bgMode = 'dark'
}: FresherismLogoProps) {
  const [imgErrorCount, setImgErrorCount] = useState(0);

  // Fallback candidates array
  const imageSources = ['/gculogo.svg', '/gculogo.png', logo2Img, '/logo2.png', '/logo.png'];
  const currentImgSrc = imageSources[Math.min(imgErrorCount, imageSources.length - 1)];

  const handleImageError = () => {
    if (imgErrorCount < imageSources.length) {
      setImgErrorCount(prev => prev + 1);
    }
  };

  // Scale factors for responsive layout
  const containerScale = size === 'sm' 
    ? 'max-w-[360px] md:max-w-[480px]' 
    : size === 'lg' 
    ? 'w-full max-w-[880px] lg:max-w-[1020px]' 
    : 'w-full max-w-[680px] md:max-w-[820px]';

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none py-2 mx-auto transition-all ${containerScale}`}>
      
      {/* 1. UNIVERSITY HEADER */}
      {showUniversityHeader && (
        <div className="w-full mb-3 tracking-widest uppercase text-center flex flex-col items-center justify-center">
          <p className="w-full text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white drop-shadow-lg font-serif tracking-[0.18em] sm:tracking-[0.25em] uppercase">
            GARDEN CITY UNIVERSITY
          </p>
          <p className="w-full text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-orange-500 drop-shadow-[0_2px_15px_rgba(249,115,22,0.9)] font-serif tracking-[0.2em] sm:tracking-[0.3em] uppercase mt-2 animate-flicker">
            EMPHASIS ON LIFE
          </p>
        </div>
      )}

      {/* 2. HIGH QUALITY OFFICIAL FRESHERISM '26 LOGO IMAGE */}
      <div className={`relative my-2 w-full inline-flex items-center justify-center p-2 sm:p-4 rounded-3xl transition-all hover:scale-[1.01] ${
        bgMode === 'light'
          ? 'bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-2 border-purple-800 shadow-2xl'
          : 'bg-gradient-to-r from-[#120024] via-[#1E0136] to-[#0A0017] border-2 border-[#00D1FF]/40 shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-md'
      }`}>
        <div className="relative w-full rounded-2xl p-2 sm:p-3 flex items-center justify-center overflow-hidden">
          {imgErrorCount < imageSources.length ? (
            <img 
              src={currentImgSrc} 
              onError={handleImageError}
              alt="FRESHERISM '26 - CORALVERSE - SEASONS OF LIFE" 
              className="w-full h-auto object-contain max-h-[180px] sm:max-h-[250px] md:max-h-[320px] filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 transition-transform duration-500 hover:scale-[1.02]"
              loading="eager"
            />
          ) : (
            /* Vector Banner Fallback if image fails */
            <div className="w-full py-6 px-4 bg-gradient-to-r from-purple-950 via-fuchsia-950 to-indigo-950 rounded-2xl border border-[#FF007A]/50 text-center space-y-2">
              <div className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF007A] via-amber-300 to-[#00D1FF] tracking-tighter italic">
                FRESHERISM '26
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-cyan-300 tracking-[0.3em] uppercase">
                CORALVERSE — SEASONS OF LIFE
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. DATES BADGE IF ENABLED */}
      {showDatesBadge && (
        <div className="mt-3 space-y-1">
          <div className="inline-block bg-[#1A032E] border-2 border-[#FF007A] px-5 py-2 rounded-full text-xs md:text-sm font-black text-[#FFAC1C] tracking-wider shadow-xl">
            🗓️ 3rd – 15th August 2026
          </div>
          <p className="text-[10px] text-zinc-300 font-bold tracking-wide">
            Every Season Counts — Become One of the Top 100 Freshers of 2K26!
          </p>
        </div>
      )}

    </div>
  );
}



