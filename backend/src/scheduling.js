const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function toMinutes(value) {
  const match = TIME_PATTERN.exec(value || "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function overlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

export function isWithinSchedule(startTime, endTime, schedule) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const opening = toMinutes(schedule.openingTime);
  const closing = toMinutes(schedule.closingTime);
  const lunchStart = toMinutes(schedule.lunchStart);
  const lunchEnd = toMinutes(schedule.lunchEnd);

  if ([start, end, opening, closing, lunchStart, lunchEnd].some((value) => value === null)) return false;
  if (end - start !== schedule.slotMinutes) return false;
  if (start < opening || end > closing) return false;
  if (overlaps(start, end, lunchStart, lunchEnd)) return false;
  return start % schedule.slotMinutes === 0 && end % schedule.slotMinutes === 0;
}

export function generateSlots(schedule) {
  const opening = toMinutes(schedule.openingTime);
  const closing = toMinutes(schedule.closingTime);
  if (opening === null || closing === null) return [];

  const slots = [];
  for (let start = opening; start + schedule.slotMinutes <= closing; start += schedule.slotMinutes) {
    const end = start + schedule.slotMinutes;
    if (isWithinSchedule(formatTime(start), formatTime(end), schedule)) {
      slots.push({ start_time: formatTime(start), end_time: formatTime(end) });
    }
  }
  return slots;
}

export function validateScheduleWindow(startTime, endTime, schedule) {
  if (!isWithinSchedule(startTime, endTime, schedule)) {
    return {
      code: "INVALID_SLOT",
      message: `Appointments must be exactly ${schedule.slotMinutes} minutes, within ${schedule.openingTime}-${schedule.closingTime}, and outside lunch (${schedule.lunchStart}-${schedule.lunchEnd}).`,
    };
  }
  return null;
}

export function timeToMinutes(value) {
  return toMinutes(value);
}

export function isAtLeastMinutesBefore(date, startTime, minutes, timezoneOffset = "+05:30") {
  const appointmentAt = new Date(`${date}T${startTime}:00${timezoneOffset}`);
  return Number.isFinite(appointmentAt.getTime()) && appointmentAt.getTime() - Date.now() >= minutes * 60 * 1000;
}
