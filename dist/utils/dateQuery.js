"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetWeekBounds = exports.NormalizeWeekRange = void 0;
const date_fns_tz_1 = require("date-fns-tz");
const timeZone = "America/Los_Angeles";
const now = new Date();
const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
const NormalizeWeekRange = (start, end) => {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const startDay = startDate.getDay();
        const endDay = endDate.getDay();
        console.log("Start Date:", startDay);
        console.log("End Date:", endDay);
        if (startDay > 0) {
            startDate.setDate(startDate.getDate() - startDay);
        }
        ;
        if (endDay < 4) {
            endDate.setDate(endDate.getDate() + (4 - endDay));
        }
        else if (endDay > 4) {
            endDate.setDate(endDate.getDate() + (endDay - 4));
        }
        ;
        return {
            monday: startDate.toISOString().split("T")[0],
            friday: endDate.toISOString().split("T")[0]
        };
    }
    catch (error) {
        console.error("Error in CurrentWeekDates:", error);
        return error;
    }
    ;
};
exports.NormalizeWeekRange = NormalizeWeekRange;
const GetWeekBounds = (start, end) => {
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const startDay = startDate.getDay();
        const endDay = endDate.getDay();
        console.log("Start Date:", startDay);
        console.log("End Date:", endDay);
        if (startDay < 4) {
            startDate.setDate(startDate.getDate() + (4 - startDay));
        }
        else if (startDay > 4) {
            startDate.setDate(startDate.getDate() - (startDay - 4));
        }
        ;
        if (endDay > 0) {
            endDate.setDate(endDate.getDate() - endDay);
        }
        ;
        return {
            friday: startDate.toISOString().split("T")[0],
            monday: endDate.toISOString().split("T")[0]
        };
    }
    catch (error) {
        console.error("Error in GetWeekBounds:", error);
        return error;
    }
    ;
};
exports.GetWeekBounds = GetWeekBounds;
