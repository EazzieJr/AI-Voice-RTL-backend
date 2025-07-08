import { toZonedTime, format } from "date-fns-tz";
import { subDays, addDays, addMonths, endOfMonth, startOfMonth, getDay, isBefore, isSameMonth, isAfter } from "date-fns";

const timeZone = "America/Los_Angeles";
const now = new Date();
const zonedNow = toZonedTime(now, timeZone);

export const GetWeekRangeDates = (start: Date, end: Date) => {
    try {
        function normalizeToMonday(date: Date): Date {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();

            if (day === 0) return d;

            if (day > 0) {
                return subDays(d, day); // Adjust to the previous Monday
            };
        };

        function normalizeToSunday(date: Date): Date {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();

            if (day === 6) return d;

            if (day < 6) {
                return addDays(d, 6 - day); // Adjust to the next Sunday
            };
        };

        function normalizeToFriday(date: Date): Date {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();

            if (day === 4) return d;

            if (day < 4) {
                return addDays(d, 4 - day); // Adjust to the previous Friday
            }  else if (day > 4) {
                return subDays(d, day - 4); // Adjust to the previous Friday
            };
        };

        const startDate = normalizeToMonday(start);
        const endDate = normalizeToSunday(end);

        console.log("Day 1:", startDate);
        console.log("Day 2:", endDate);

        const result: { monday: string, sunday: string }[] = [];

        const currentMonday = new Date(startDate);

        while (currentMonday <= endDate) {
            const currentSunday = new Date(currentMonday);
            currentSunday.setDate(currentMonday.getDate() + 6); // Get the Sunday of the same week

            result.push({
                monday: currentMonday.toISOString().split("T")[0],
                sunday: currentSunday.toISOString().split("T")[0]
            });

            currentMonday.setDate(currentMonday.getDate() + 7); // Move to the next week
        };

        return result;

    } catch (error) {
        console.error("Error in GetWeekRangeDates:", error);
        return error;
    };
};

export const GetMonthRangeDates = (start: Date, end: Date) => {
    try {
        function getMonthDatesRange(start: Date, end: Date): { first: string, last: string }[] {
            const result: { first: string, last: string }[] = [];

            const startMonth = startOfMonth(start);
            const endMonth = startOfMonth(end);

            if (isSameMonth(startMonth, endMonth)) {
                const startDate = format(startOfMonth(start), "yyyy-MM-dd", { timeZone });
                const endDate = format(endOfMonth(start), "yyyy-MM-dd", { timeZone });

                result.push({
                    first: startDate,
                    last: endDate
                });

                return result;
            };

            let current = startMonth;
            const finalMonth = startOfMonth(end);

            while (!isAfter(current, finalMonth)) {
                const first = format(startOfMonth(current), "yyyy-MM-dd", { timeZone });
                const last = format(endOfMonth(current), "yyyy-MM-dd", { timeZone });

                result.push({ first, last });

                current = addMonths(current, 1);
            };

            return result;
        };

        const months = getMonthDatesRange(start, end);

        return months;

    } catch (error) {
        console.error("Error in GetMonthRangeDates:", error);
        return error;
    };
};