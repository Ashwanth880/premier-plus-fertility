import React, { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";

const MONTHS = [
  { value: 1, name: "January", short: "Jan" },
  { value: 2, name: "February", short: "Feb" },
  { value: 3, name: "March", short: "Mar" },
  { value: 4, name: "April", short: "Apr" },
  { value: 5, name: "May", short: "May" },
  { value: 6, name: "June", short: "Jun" },
  { value: 7, name: "July", short: "Jul" },
  { value: 8, name: "August", short: "Aug" },
  { value: 9, name: "September", short: "Sep" },
  { value: 10, name: "October", short: "Oct" },
  { value: 11, name: "November", short: "Nov" },
  { value: 12, name: "December", short: "Dec" },
];

const ITEM_HEIGHT = 36; // 36px per row for compact wheel
const VISIBLE_COUNT = 3; // 1 above, 1 selected in middle, 1 below

function WheelColumn({ items, selectedValue, onSelect, label }) {
  const containerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  const selectedIndex = items.findIndex((item) => item.value === selectedValue);

  // Scroll to selected item on mount or when selectedValue changes externally
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0 && !isScrollingRef.current) {
      const targetScroll = selectedIndex * ITEM_HEIGHT;
      if (Math.abs(containerRef.current.scrollTop - targetScroll) > 2) {
        containerRef.current.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      if (items[clampedIndex] && items[clampedIndex].value !== selectedValue) {
        onSelect(items[clampedIndex].value);
      }
      isScrollingRef.current = false;
    }, 80);
  };

  const handleStep = (direction) => {
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < items.length) {
      onSelect(items[nextIndex].value);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center select-none">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
        {label}
      </div>

      {/* Up Button */}
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={selectedIndex <= 0}
        aria-label={`Previous ${label}`}
        className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      {/* Wheel Scroll Area */}
      <div className="relative w-full h-[108px] overflow-hidden rounded-lg bg-slate-50 border border-slate-200">
        {/* Top/Bottom Fade overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-50 via-slate-50/70 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 via-slate-50/70 to-transparent z-10" />

        {/* Center selection indicator */}
        <div
          className="pointer-events-none absolute inset-x-1 top-[36px] h-[36px] rounded-md border-y border-[#3898A6]/40 bg-gradient-to-r from-teal-50/70 to-blue-50/70 z-5 shadow-2xs"
        />

        {/* Scrolling Items */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          style={{
            paddingTop: `${((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT}px`,
            paddingBottom: `${((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT}px`,
          }}
        >
          {items.map((item, idx) => {
            const isSelected = item.value === selectedValue;
            const distance = Math.abs(idx - selectedIndex);

            return (
              <div
                key={item.value}
                onClick={() => onSelect(item.value)}
                className={`h-[36px] flex items-center justify-center snap-center cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "text-[#1E3A8A] font-extrabold text-sm scale-105"
                    : distance === 1
                    ? "text-slate-500 font-medium text-xs scale-95 opacity-70"
                    : "text-slate-400 font-normal text-[11px] scale-90 opacity-40"
                }`}
              >
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Down Button */}
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={selectedIndex >= items.length - 1}
        aria-label={`Next ${label}`}
        className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function DateWheelPicker({
  value,
  onChange,
  isDob = false,
  label = "Select Date",
  error = "",
}) {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // Parse or initialize date
  const parsed = useMemo(() => {
    if (value && typeof value === "string") {
      const parts = value.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d };
        }
      }
    }

    // Default fallback
    if (isDob) {
      // Default to 28 years ago
      return { year: currentYear - 28, month: 6, day: 15 };
    } else {
      // Default to today
      return { year: currentYear, month: currentMonth, day: currentDay };
    }
  }, [value, isDob, currentYear, currentMonth, currentDay]);

  const [year, setYear] = React.useState(parsed.year);
  const [month, setMonth] = React.useState(parsed.month);
  const [day, setDay] = React.useState(parsed.day);

  // Sync state if external value changes
  useEffect(() => {
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }, [parsed.year, parsed.month, parsed.day]);

  // Year items range
  const yearItems = useMemo(() => {
    const items = [];
    if (isDob) {
      // 100 years back up to current year
      for (let y = currentYear - 100; y <= currentYear; y++) {
        items.push({ value: y, label: String(y) });
      }
    } else {
      // Today up to 3 years in the future
      for (let y = currentYear; y <= currentYear + 3; y++) {
        items.push({ value: y, label: String(y) });
      }
    }
    return items;
  }, [isDob, currentYear]);

  // Month items
  const monthItems = useMemo(() => {
    return MONTHS.map((m) => {
      // If DOB and in current year, cannot pick future months
      const isFutureMonth = isDob && year === currentYear && m.value > currentMonth;
      // If appointment and in current year, cannot pick past months
      const isPastMonth = !isDob && year === currentYear && m.value < currentMonth;

      return {
        value: m.value,
        label: m.short,
        disabled: isFutureMonth || isPastMonth,
      };
    }).filter((m) => !m.disabled);
  }, [isDob, year, currentYear, currentMonth]);

  // Compute days in month correctly (handling leap years)
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // Day items
  const dayItems = useMemo(() => {
    const items = [];
    for (let d = 1; d <= daysInMonth; d++) {
      // If DOB and in current year + month, cannot pick future days
      const isFutureDay = isDob && year === currentYear && month === currentMonth && d > currentDay;
      // If appointment and in current year + month, cannot pick past days
      const isPastDay = !isDob && year === currentYear && month === currentMonth && d < currentDay;

      if (!isFutureDay && !isPastDay) {
        items.push({
          value: d,
          label: String(d).padStart(2, "0"),
        });
      }
    }
    return items;
  }, [daysInMonth, isDob, year, month, currentYear, currentMonth, currentDay]);

  // Auto-clamp when items change or selection falls out of valid bounds
  useEffect(() => {
    if (monthItems.length > 0 && !monthItems.some((m) => m.value === month)) {
      const validM = monthItems[0].value;
      const maxD = new Date(year, validM, 0).getDate();
      const validD = Math.min(day, maxD);
      setMonth(validM);
      setDay(validD);
      onChange(`${year}-${String(validM).padStart(2, "0")}-${String(validD).padStart(2, "0")}`);
    } else if (dayItems.length > 0 && !dayItems.some((d) => d.value === day)) {
      const firstDay = dayItems[0].value;
      const lastDay = dayItems[dayItems.length - 1].value;
      const validD = day < firstDay ? firstDay : day > lastDay ? lastDay : firstDay;
      setDay(validD);
      onChange(`${year}-${String(month).padStart(2, "0")}-${String(validD).padStart(2, "0")}`);
    }
  }, [monthItems, dayItems, year, month, day, onChange]);

  // Clamp selections whenever constraints shift
  const handleUpdate = (newYear, newMonth, newDay) => {
    let validYear = newYear;
    let validMonth = newMonth;

    // Validate month
    const validMonths = MONTHS.map((m) => m.value).filter((m) => {
      if (isDob && validYear === currentYear && m > currentMonth) return false;
      if (!isDob && validYear === currentYear && m < currentMonth) return false;
      return true;
    });

    if (!validMonths.includes(validMonth)) {
      validMonth = validMonths[0] || 1;
    }

    // Validate day
    const maxDays = new Date(validYear, validMonth, 0).getDate();
    let validDay = Math.min(newDay, maxDays);

    if (isDob && validYear === currentYear && validMonth === currentMonth && validDay > currentDay) {
      validDay = currentDay;
    }
    if (!isDob && validYear === currentYear && validMonth === currentMonth && validDay < currentDay) {
      validDay = currentDay;
    }

    setYear(validYear);
    setMonth(validMonth);
    setDay(validDay);

    const formatted = `${validYear}-${String(validMonth).padStart(2, "0")}-${String(validDay).padStart(2, "0")}`;
    onChange(formatted);
  };

  const handleYearChange = (y) => handleUpdate(y, month, day);
  const handleMonthChange = (m) => handleUpdate(year, m, day);
  const handleDayChange = (d) => handleUpdate(year, month, d);

  // Formatted display string
  const displayFormatted = useMemo(() => {
    const monthObj = MONTHS.find((m) => m.value === month);
    const monthName = monthObj ? monthObj.name : "";
    return `${day} ${monthName} ${year}`;
  }, [day, month, year]);

  return (
    <div className="w-full bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#3898A6]" />
          {label}
        </span>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#1E3A8A] border border-[#3898A6]/30">
          {displayFormatted}
        </span>
      </div>

      {/* Wheel Columns */}
      <div className="flex items-center gap-2">
        <WheelColumn
          label="Day"
          items={dayItems}
          selectedValue={day}
          onSelect={handleDayChange}
        />
        <WheelColumn
          label="Month"
          items={monthItems}
          selectedValue={month}
          onSelect={handleMonthChange}
        />
        <WheelColumn
          label="Year"
          items={yearItems}
          selectedValue={year}
          onSelect={handleYearChange}
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-rose-600 font-medium">{error}</p>
      )}
    </div>
  );
}
