import React, { useMemo } from "react";
import { Clock } from "lucide-react";

// Generate 30-minute intervals from 08:00 to 20:00
export const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 20 && minute > 0) continue; // stop at 20:00

      const h24 = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");
      const value24 = `${h24}:${m}`;

      const period = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const label12 = `${String(h12).padStart(2, "0")}:${m} ${period}`;

      slots.push({ value24, label12, hour, minute });
    }
  }
  return slots;
})();

export function formatTime24to12(time24) {
  if (!time24) return "";
  const slot = TIME_SLOTS.find((s) => s.value24 === time24);
  if (slot) return slot.label12;

  // Fallback conversion
  const [hStr, mStr] = time24.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (isNaN(hour) || isNaN(minute)) return time24;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

export default function TimePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  errorStart = "",
  errorEnd = "",
}) {
  const handleStartTimeSelect = (val24) => {
    onStartTimeChange(val24);

    const currIdx = TIME_SLOTS.findIndex((s) => s.value24 === val24);
    if (currIdx >= 0 && currIdx < TIME_SLOTS.length - 1) {
      const nextSlot = TIME_SLOTS[currIdx + 1].value24;
      if (!endTime || endTime <= val24) {
        onEndTimeChange(nextSlot);
      }
    }
  };

  const endSlots = useMemo(() => {
    if (!startTime) return TIME_SLOTS;
    // End time must be strictly after start time
    return TIME_SLOTS.filter((s) => s.value24 > startTime);
  }, [startTime]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Start Time */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#3898A6]" />
            Start Time (AM/PM)
          </label>
          <div className="relative">
            <select
              value={startTime || ""}
              onChange={(e) => handleStartTimeSelect(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
            >
              <option value="" disabled>
                Select start time
              </option>
              {TIME_SLOTS.slice(0, -1).map((slot) => (
                <option key={slot.value24} value={slot.value24}>
                  {slot.label12}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {errorStart && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errorStart}</p>
          )}
        </div>

        {/* End Time */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#3898A6]" />
            End Time (AM/PM)
          </label>
          <div className="relative">
            <select
              value={endTime || ""}
              onChange={(e) => onEndTimeChange(e.target.value)}
              disabled={!startTime}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="" disabled>
                {startTime ? "Select end time" : "Select start time first"}
              </option>
              {endSlots.map((slot) => (
                <option key={slot.value24} value={slot.value24}>
                  {slot.label12}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {errorEnd && (
            <p className="mt-1 text-xs text-rose-600 font-medium">{errorEnd}</p>
          )}
        </div>
      </div>

      {startTime && endTime && startTime < endTime && (
        <div className="text-xs text-[#1E3A8A] bg-gradient-to-r from-teal-50/70 via-blue-50/50 to-fuchsia-50/40 border border-[#3898A6]/30 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3898A6]" />
            Appointment Window:
          </span>
          <span className="font-extrabold text-[#1E3A8A]">
            {formatTime24to12(startTime)} – {formatTime24to12(endTime)}
          </span>
        </div>
      )}
    </div>
  );
}
