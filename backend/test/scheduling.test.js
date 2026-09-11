import test from "node:test";
import assert from "node:assert/strict";
import { generateSlots, isAtLeastMinutesBefore, overlaps, validateScheduleWindow } from "../src/scheduling.js";

const schedule = { openingTime: "08:00", closingTime: "20:00", lunchStart: "11:30", lunchEnd: "12:30", slotMinutes: 15 };

test("generates 15-minute slots and excludes lunch", () => {
  const slots = generateSlots(schedule);
  assert.equal(slots.length, 44);
  assert.equal(slots[0].start_time, "08:00");
  assert.equal(slots.at(-1).end_time, "20:00");
  assert.equal(slots.some((slot) => slot.start_time >= "11:30" && slot.start_time < "12:30"), false);
});

test("rejects durations other than 15 minutes", () => {
  assert.equal(validateScheduleWindow("10:00", "10:30", schedule).code, "INVALID_SLOT");
  assert.equal(validateScheduleWindow("10:00", "10:15", schedule), null);
});

test("rejects lunch overlap but allows lunch boundaries", () => {
  assert.equal(validateScheduleWindow("11:30", "11:45", schedule).code, "INVALID_SLOT");
  assert.equal(validateScheduleWindow("12:30", "12:45", schedule), null);
  assert.equal(validateScheduleWindow("11:15", "11:30", schedule), null);
});

test("detects overlapping intervals", () => {
  assert.equal(overlaps(600, 615, 600, 615), true);
  assert.equal(overlaps(600, 615, 615, 630), false);
  assert.equal(overlaps(600, 615, 605, 620), true);
});

test("requires a one-hour management cutoff", () => {
  assert.equal(isAtLeastMinutesBefore("2099-12-15", "10:00", 60), true);
});
