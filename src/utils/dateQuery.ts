import { toZonedTime, format } from "date-fns-tz";
import { subDays, addDays } from "date-fns";
import { start } from "repl";

const timeZone = "America/Los_Angeles";
const now = new Date();
const zonedNow = toZonedTime(now, timeZone);

export const GetWeekRangeDates = (start: Date, end: Date) => {
    try {
        function normalizeToMonday(date: Date): Date {
            const d = (date instanceof Date) ? date : new Date(date);
            const day = d.getDay();

            if (day === 0) return d;

            return subDays(d, day); // Adjust to the previous Monday
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
        const endDate = normalizeToFriday(end);

        console.log("Day 1:", startDate);
        console.log("Day 2:", endDate);

        const result: { monday: string, friday: string }[] = [];

        const currentMonday = new Date(startDate);

        while (currentMonday <= endDate) {
            const currentFriday = new Date(currentMonday);
            currentFriday.setDate(currentMonday.getDate() + 4); // Get the Friday of the same week

            result.push({
                monday: currentMonday.toISOString().split("T")[0],
                friday: currentFriday.toISOString().split("T")[0]
            });

            currentMonday.setDate(currentMonday.getDate() + 7); // Move to the next week
        };

        return result;

    } catch (error) {
        console.error("Error in GetWeekRangeDates:", error);
        return error;
    };
};