import { toZonedTime, format } from "date-fns-tz";
import { subDays } from "date-fns";

const timeZone = "America/Los_Angeles";
const now = new Date();
const zonedNow = toZonedTime(now, timeZone);

export const NormalizeWeekRange = (start: string, end: string) => {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);

        const startDay = startDate.getDay();
        const endDay = endDate.getDay();

        console.log("Start Date:", startDay);
        console.log("End Date:", endDay);
        
        if (startDay > 0) {
            startDate.setDate(startDate.getDate() - startDay);
        };

        if (endDay < 4) {
            endDate.setDate(endDate.getDate() + (4 - endDay));
        } else if (endDay > 4) {
            endDate.setDate(endDate.getDate() + (endDay - 4));
        };

        return {
            monday: startDate.toISOString().split("T")[0],
            friday: endDate.toISOString().split("T")[0]
        };

    } catch (error) {
        console.error("Error in CurrentWeekDates:", error);
        return error;
    };
};

export const GetWeekBounds = (start: string, end: string) => {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);

        const startDay = startDate.getDay();
        const endDay = endDate.getDay();

        console.log("Start Date:", startDay);
        console.log("End Date:", endDay);

        if (startDay < 4) {
            startDate.setDate(startDate.getDate() + (4 - startDay));
        } else if (startDay > 4) {
            startDate.setDate(startDate.getDate() - (startDay - 4));
        };

        if (endDay > 0) {
            endDate.setDate(endDate.getDate() - endDay);
        };

        return {
            friday: startDate.toISOString().split("T")[0],
            monday: endDate.toISOString().split("T")[0]
        };

    } catch (error) {
        console.error("Error in GetWeekBounds:", error);
        return error;
    };
};