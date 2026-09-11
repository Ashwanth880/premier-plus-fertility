import React, { useMemo } from "react";
import { Clock } from "lucide-react";

export function formatTime24to12(time24) {
  // Fallback conversion
  if (!time24) return "";
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
  availableSlots = [],
}) {
  const selectableSlots = useMemo(() => {
    return availableSlots.map((slot) => ({
      value24: slot.start_time,
      label12: formatTime24to12(slot.start_time),
    }));
  }, [availableSlots]);

  const handleStartTimeSelect = (val24) => {
    onStartTimeChange(val24);

    const selectedSlot = selectableSlots.find((slot) => slot.value24 === val24);
    if (selectedSlot) {
      onEndTimeChange(availableSlots.find((slot) => slot.start_time === val24)?.end_time || "");
    }
  };

  const endSlots = useMemo(() => {
    if (!startTime) return [];
    const endTime = availableSlots.find((slot) => slot.start_time === startTime)?.end_time;
    return endTime ? [{ value24: endTime, label12: formatTime24to12(endTime) }] : [];
  }, [availableSlots, startTime]);

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
              {selectableSlots.map((slot) => (
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
