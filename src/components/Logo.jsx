import React from "react";

export function ClinicLogo({ className = "w-10 h-10", withText = false, textClassName = "" }) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Premier Plus Clinic Emblem"
      >
        {/* Top-Left Green L-Shape */}
        <path
          d="M 190 100
             A 60 60 0 0 1 310 100
             L 310 240
             C 310 278, 278 310, 240 310
             L 100 310
             A 60 60 0 0 1 40 250
             A 60 60 0 0 1 100 190
             L 130 190
             C 163 190, 190 163, 190 130
             L 190 100 Z"
          fill="#84D037"
        />

        {/* Bottom-Right Blue L-Shape */}
        <path
          d="M 310 400
             A 60 60 0 0 1 190 400
             L 190 260
             C 190 222, 222 190, 260 190
             L 400 190
             A 60 60 0 0 1 460 250
             A 60 60 0 0 1 400 310
             L 370 310
             C 337 310, 310 337, 310 370
             L 310 400 Z"
          fill="#2996F5"
        />
      </svg>

      {withText && (
        <div className={`flex flex-col text-left ${textClassName}`}>
          <span className="font-extrabold text-base sm:text-lg leading-tight tracking-tight text-slate-900">
            Premier<span className="text-[#84D037] font-black mx-0.5">+</span>
            <span className="text-[#2996F5]">Clinic</span>
          </span>
          <span className="text-[10px] font-bold tracking-wider text-[#2996F5] uppercase">
            Centre of Excellence • Kodambakkam
          </span>
        </div>
      )}
    </div>
  );
}

export default ClinicLogo;
