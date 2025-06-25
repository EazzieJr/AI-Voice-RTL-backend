"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsToCsv = void 0;
const csv_writer_1 = require("csv-writer");
const contact_model_1 = require("../models/contact_model");
const path_1 = __importDefault(require("path"));
const types_1 = require("../utils/types");
const date_fns_1 = require("date-fns");
const date_fns_2 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const logsToCsv = async (agentId, newlimit, startDate, endDate, statusOption, sentimentOption, dateOption, tag) => {
    try {
        const validSentimentOptions = [
            "unknown",
            "scheduled",
            "call-back",
            "neutral",
            "positive",
            "negative",
            "dnc",
            "all",
        ];
        if (sentimentOption && !validSentimentOptions.includes(sentimentOption)) {
            return { status: 400, error: "Invalid sentiment option provided." };
        }
        const validStatusOptions = [
            "called",
            "not-called",
            "voicemail",
            "failed",
            "all",
        ];
        if (statusOption && !validStatusOptions.includes(statusOption)) {
            return { status: 400, error: "Invalid status option provided." };
        }
        let dateFilter1 = {};
        const timeZone = "America/Los_Angeles"; // PST time zone
        const now = new Date();
        const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
        const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
        switch (dateOption) {
            case types_1.DateOption.Today:
                dateFilter1 = { day: today };
                break;
            case types_1.DateOption.Yesterday:
                const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_2.subDays)(now, 1), timeZone);
                const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", { timeZone });
                dateFilter1 = { day: yesterday };
                break;
            case types_1.DateOption.ThisWeek:
                const pastDays = [];
                for (let i = 1; pastDays.length < 5; i++) {
                    const day = (0, date_fns_2.subDays)(now, i);
                    const dayOfWeek = day.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        // Exclude weekends
                        pastDays.push((0, date_fns_tz_1.format)((0, date_fns_tz_1.toZonedTime)(day, timeZone), "yyyy-MM-dd", { timeZone }));
                    }
                }
                dateFilter1 = {
                    day: { $gte: pastDays[pastDays.length - 1], $lte: today },
                };
                break;
            case types_1.DateOption.ThisMonth:
                const zonedStartOfMonth = (0, date_fns_tz_1.toZonedTime)((0, date_fns_2.startOfMonth)(now), timeZone);
                const startOfMonthDate = (0, date_fns_tz_1.format)(zonedStartOfMonth, "yyyy-MM-dd", {
                    timeZone,
                });
                dateFilter1 = { day: { $gte: startOfMonthDate } };
                break;
            case types_1.DateOption.Total:
                dateFilter1 = {};
                break;
            case types_1.DateOption.LAST_SCHEDULE:
                const recentJob = await contact_model_1.jobModel
                    .findOne({})
                    .sort({ createdAt: -1 })
                    .lean();
                if (!recentJob) {
                    return "No jobs found for today's filter.";
                }
                const dateToCheck = recentJob.scheduledTime.split("T")[0];
                dateFilter1 = { day: { $gte: dateToCheck } };
                break;
        }
        let query = Object.assign({ isDeleted: false }, dateFilter1);
        if (agentId) {
            query.agentId = agentId;
        }
        if (statusOption && statusOption !== "all") {
            let callStatus;
            if (statusOption === "called") {
                callStatus = types_1.callstatusenum.CALLED;
            }
            else if (statusOption === "not-called") {
                callStatus = types_1.callstatusenum.NOT_CALLED;
            }
            else if (statusOption === "voicemail") {
                callStatus = types_1.callstatusenum.VOICEMAIL;
            }
            else if (statusOption === "failed") {
                callStatus = types_1.callstatusenum.FAILED;
            }
            query.dial_status = callStatus;
        }
        const formattedStartDate = startDate
            ? new Date(startDate).toISOString().split("T")[0]
            : null;
        const formattedEndDate = endDate
            ? new Date(endDate).toISOString().split("T")[0]
            : null;
        const getDatesInRange = (start, end) => {
            const startDateObj = new Date(start);
            const endDateObj = new Date(end);
            const daysDiff = (0, date_fns_1.differenceInDays)(endDateObj, startDateObj);
            const dates = [];
            for (let i = 0; i <= daysDiff; i++) {
                dates.push((0, date_fns_1.addDays)(startDateObj, i).toISOString().split("T")[0]);
            }
            return dates;
        };
        // Filter by date range
        if (formattedStartDate && formattedEndDate) {
            const datesInRange = getDatesInRange(formattedStartDate, formattedEndDate);
            query["datesCalled"] = { $in: datesInRange };
        }
        else if (formattedStartDate) {
            query["datesCalled"] = formattedStartDate;
        }
        if (tag) {
            query.tag = tag;
        }
        let contactQuery = contact_model_1.contactModel
            .find(query)
            .sort({ createdAt: "desc" })
            .select("firstname lastname email phone dial_status referenceToCallId datesCalled")
            .populate("referenceToCallId", "transcript analyzedTranscript recordingUrl");
        console.log("Executing MongoDB Query:", JSON.stringify(contactQuery.getQuery(), null, 2));
        // Conditionally add limit if provided
        if (newlimit && Number.isInteger(newlimit) && newlimit > 0) {
            contactQuery = contactQuery.limit(newlimit);
        }
        const foundContacts = await contactQuery.exec();
        console.log(foundContacts.length);
        const filePath = path_1.default.join(__dirname, "..", "..", "public", "logs.csv");
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: "firstname", title: "firstname" },
                { id: "lastname", title: "lastname" },
                { id: "email", title: "email" },
                { id: "phone", title: "phone" },
                { id: "dial_status", title: "status" },
                { id: "transcript", title: "transcript" },
                { id: "call_recording_url", title: "call_recording_url" },
                { id: "analyzedTranscript", title: "analyzedTranscript" },
                { id: "last_date_called", title: "last_date_called" },
            ],
        });
        let callSentimentStatus;
        if (sentimentOption === "unknown") {
            callSentimentStatus = types_1.callSentimentenum.UNKNOWN;
        }
        else if (sentimentOption === "dnc") {
            callSentimentStatus = types_1.callSentimentenum.DNC;
        }
        else if (sentimentOption === "scheduled") {
            callSentimentStatus = types_1.callSentimentenum.SCHEDULED;
        }
        else if (sentimentOption === "call-back") {
            callSentimentStatus = types_1.callSentimentenum.CALLBACK;
        }
        else if (sentimentOption === "neutral") {
            callSentimentStatus = types_1.callSentimentenum.NEUTRAL;
        }
        else if (sentimentOption === "positive") {
            callSentimentStatus = types_1.callSentimentenum.POSITIVE;
        }
        else if (sentimentOption === "negative") {
            callSentimentStatus = types_1.callSentimentenum.NEGATIVE;
        }
        else if (sentimentOption === "all") {
            callSentimentStatus = "";
        }
        console.log(callSentimentStatus);
        const contactsData = foundContacts
            .map((contact) => {
            var _a, _b, _c;
            return ({
                firstname: contact.firstname,
                lastname: contact.lastname,
                email: contact.email,
                phone: contact.phone,
                status: contact.dial_status,
                transcript: (_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript,
                call_recording_url: (_b = contact.referenceToCallId) === null || _b === void 0 ? void 0 : _b.recordingUrl,
                analyzedTranscript: (_c = contact.referenceToCallId) === null || _c === void 0 ? void 0 : _c.analyzedTranscript,
                last_date_called: contact.datesCalled,
            });
        })
            .filter((contact) => {
            return (!sentimentOption || contact.analyzedTranscript === callSentimentStatus);
        });
        await csvWriter.writeRecords(contactsData);
        console.log("CSV file logs.csv has been written successfully");
        return filePath;
    }
    catch (error) {
        console.error(`Error generating CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
        return {
            error: error instanceof Error ? error.message : "An unknown error occurred.",
        };
    }
};
exports.logsToCsv = logsToCsv;
