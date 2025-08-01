"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateFilterObjects = exports.AutomatedResponses = void 0;
exports.convertMsToMinSec = convertMsToMinSec;
const contact_model_1 = require("../models/contact_model");
const types_1 = require("./types");
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
function convertMsToMinSec(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
;
const AutomatedResponses = async (jobId) => {
    const responses = await contact_model_1.contactModel.aggregate([
        {
            $match: {
                jobProcessedWithId: {
                    $in: [jobId]
                },
            }
        },
        {
            $lookup: {
                from: "transcripts",
                localField: "referenceToCallId",
                foreignField: "_id",
                as: "referenceToCallId"
            }
        },
        {
            $unwind: {
                path: "$referenceToCallId",
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                "referenceToCallId.disconnectionReason": {
                    $in: ["voicemail_reached", "machine_detected"]
                }
            }
        }
    ]);
    return responses.length;
};
exports.AutomatedResponses = AutomatedResponses;
const DateFilterObjects = async (dateOption, agentId) => {
    let dateFilter = {};
    let dateFilter2 = {};
    let date_to_check;
    const timeZone = "America/Los_Angeles";
    const now = new Date();
    const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
    const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
    switch (dateOption) {
        case types_1.DateOption.Today:
            dateFilter = { datesCalled: today };
            dateFilter2 = { day: today };
            date_to_check = { date: today };
            break;
        case types_1.DateOption.Yesterday:
            const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
            const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", { timeZone });
            dateFilter = { datesCalled: yesterday };
            dateFilter2 = { day: yesterday };
            date_to_check = { date: yesterday };
            break;
        case types_1.DateOption.ThisWeek:
            const weekdays = [];
            for (let i = 0; i < 7; i++) {
                const day = (0, date_fns_1.subDays)(zonedNow, i);
                const dayOfWeek = day.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const valid_day = (0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone });
                    weekdays.push(valid_day);
                }
                ;
            }
            ;
            dateFilter = { datesCalled: { $in: weekdays } };
            dateFilter2 = { day: { $in: weekdays } };
            date_to_check = { date: { $in: weekdays } };
            break;
        case types_1.DateOption.ThisMonth:
            const monthDates = [];
            for (let i = 0; i < now.getDate(); i++) {
                const day = (0, date_fns_1.subDays)(now, i);
                const valid_day = (0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone });
                monthDates.unshift(valid_day);
            }
            ;
            dateFilter = { datesCalled: { $in: monthDates } };
            dateFilter2 = { day: { $in: monthDates } };
            date_to_check = { date: { $in: monthDates } };
            break;
        case types_1.DateOption.PastMonth:
            const pastDates = [];
            for (let i = 0; i < 30; i++) {
                const day = (0, date_fns_1.subDays)(now, i);
                const valid_day = (0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone });
                pastDates.unshift(valid_day);
            }
            ;
            dateFilter = { datesCalled: { $in: pastDates } };
            dateFilter2 = { day: { $in: pastDates } };
            date_to_check = { date: { $in: pastDates } };
            break;
        case types_1.DateOption.Total:
            dateFilter = {};
            dateFilter2 = {};
            date_to_check = {};
            break;
        case types_1.DateOption.LAST_SCHEDULE:
            const recent_job = await contact_model_1.jobModel
                .findOne({ agentId })
                .sort({ createdAt: -1 })
                .lean();
            if (!recent_job) {
                dateFilter = {};
                dateFilter2 = {};
                date_to_check = {};
            }
            else {
                const dateToCheck = recent_job.scheduledTime.split("T")[0];
                dateFilter = { datesCalled: dateToCheck };
                dateFilter2 = { day: dateToCheck };
                date_to_check = { date: dateToCheck };
            }
            ;
            break;
    }
    ;
    console.log("dateFilter: ", dateFilter);
    console.log("dateFilter2: ", dateFilter2);
    console.log("date_to_check: ", date_to_check);
    return { dateFilter, dateFilter2, date_to_check };
};
exports.DateFilterObjects = DateFilterObjects;
