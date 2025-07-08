"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMonthRangeDates = exports.GetWeekRangeDates = void 0;
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
            if (day > 0) {
                return (0, date_fns_1.subDays)(d, day); // Adjust to the previous Monday
            }
            ;
        }
        ;
        function normalizeToSunday(date) {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();
            if (day === 6)
                return d;
            if (day < 6) {
                return (0, date_fns_1.addDays)(d, 6 - day); // Adjust to the next Sunday
            }
            ;
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
        const endDate = normalizeToSunday(end);
        console.log("Day 1:", startDate);
        console.log("Day 2:", endDate);
        const result = [];
        const currentMonday = new Date(startDate);
        while (currentMonday <= endDate) {
            const currentSunday = new Date(currentMonday);
            currentSunday.setDate(currentMonday.getDate() + 6); // Get the Sunday of the same week
            result.push({
                monday: currentMonday.toISOString().split("T")[0],
                sunday: currentSunday.toISOString().split("T")[0]
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
const GetMonthRangeDates = (start, end) => {
    try {
        function getMonthDatesRange(start, end) {
            const result = [];
            const startMonth = (0, date_fns_1.startOfMonth)(start);
            const endMonth = (0, date_fns_1.startOfMonth)(end);
            if ((0, date_fns_1.isSameMonth)(startMonth, endMonth)) {
                const startDate = (0, date_fns_tz_1.format)((0, date_fns_1.startOfMonth)(start), "yyyy-MM-dd", { timeZone });
                const endDate = (0, date_fns_tz_1.format)((0, date_fns_1.endOfMonth)(start), "yyyy-MM-dd", { timeZone });
                result.push({
                    first: startDate,
                    last: endDate
                });
                return result;
            }
            ;
            let current = startMonth;
            const finalMonth = (0, date_fns_1.startOfMonth)(end);
            while (!(0, date_fns_1.isAfter)(current, finalMonth)) {
                const first = (0, date_fns_tz_1.format)((0, date_fns_1.startOfMonth)(current), "yyyy-MM-dd", { timeZone });
                const last = (0, date_fns_tz_1.format)((0, date_fns_1.endOfMonth)(current), "yyyy-MM-dd", { timeZone });
                result.push({ first, last });
                current = (0, date_fns_1.addMonths)(current, 1);
            }
            ;
            return result;
        }
        ;
        const months = getMonthDatesRange(start, end);
        return months;
    }
    catch (error) {
        console.error("Error in GetMonthRangeDates:", error);
        return error;
    }
    ;
};
exports.GetMonthRangeDates = GetMonthRangeDates;
