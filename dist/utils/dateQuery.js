"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetWeekRangeDates = void 0;
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
const timeZone = "America/Los_Angeles";
const now = new Date();
const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
const GetWeekRangeDates = (start, end) => {
    try {
        function normalizeToMonday(date) {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();
            if (day === 0)
                return d;
            return (0, date_fns_1.subDays)(d, day); // Adjust to the previous Monday
        }
        ;
        function normalizeToFriday(date) {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();
            if (day === 4)
                return d;
            if (day < 4) {
                return (0, date_fns_1.addDays)(d, 4 - day); // Adjust to the previous Friday
            }
            else if (day > 4) {
                return (0, date_fns_1.subDays)(d, day - 4); // Adjust to the previous Friday
            }
            ;
        }
        ;
        const startDate = normalizeToMonday(start);
        const endDate = normalizeToFriday(end);
        console.log("Day 1:", startDate);
        console.log("Day 2:", endDate);
        const result = [];
        const currentMonday = new Date(startDate);
        while (currentMonday <= endDate) {
            const currentFriday = new Date(currentMonday);
            currentFriday.setDate(currentMonday.getDate() + 4); // Get the Friday of the same week
            result.push({
                monday: currentMonday.toISOString().split("T")[0],
                friday: currentFriday.toISOString().split("T")[0]
            });
            currentMonday.setDate(currentMonday.getDate() + 7); // Move to the next week
        }
        ;
        return result;
    }
    catch (error) {
        console.error("Error in GetWeekRangeDates:", error);
        return error;
    }
    ;
};
exports.GetWeekRangeDates = GetWeekRangeDates;
