"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voice_data_service = void 0;
const _root_1 = __importDefault(require("../_root"));
const historyModel_1 = __importDefault(require("../../models/historyModel"));
const voice_data_1 = require("../../validations/client/voice_data");
const types_1 = require("../../utils/types");
const userModel_1 = require("../../models/userModel");
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
const contact_model_1 = require("../../models/contact_model");
const luxon_1 = require("luxon");
class VoiceDataService extends _root_1.default {
    async voice_kpi(req, res, next) {
        try {
            const clientId = req.user._id;
            const body = req.body;
            const { error } = voice_data_1.VoiceKPISchema.validate(body, {
                abortEarly: false
            });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const dateOption = req.body.dateOption;
            const { agentIds, data } = body;
            const page = parseInt(body.page) || 1;
            const pageSize = 100;
            const skip = (page - 1) * pageSize;
            let query = {
                agentId: { $in: agentIds }
            };
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return res.status(400).json({ error: "User not found" });
            if (!Object.values(types_1.DateOption).includes(dateOption)) {
                return res.status(400).json({ error: "Invalid date option" });
            }
            ;
            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
            switch (dateOption) {
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
                    query.date = { $in: weekdays };
                    break;
                case types_1.DateOption.ThisMonth:
                    const monthDates = [];
                    for (let i = 0; i < now.getDate(); i++) {
                        const day = (0, date_fns_1.subDays)(now, i);
                        const valid_day = (0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone });
                        monthDates.unshift(valid_day);
                    }
                    ;
                    query.date = { $in: monthDates };
                    break;
                case types_1.DateOption.PastMonth:
                    const pastDates = [];
                    for (let i = 0; i < 30; i++) {
                        const day = (0, date_fns_1.subDays)(now, i);
                        const valid_day = (0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone });
                        pastDates.unshift(valid_day);
                    }
                    ;
                    query.date = { $in: pastDates };
                    break;
                case types_1.DateOption.Total:
                    // query.date = {};
                    console.log("total");
                    break;
                case types_1.DateOption.LAST_SCHEDULE:
                    const recent_job = await contact_model_1.jobModel
                        .findOne({ agentId: { $in: agentIds } })
                        .sort({ createdAt: -1 })
                        .lean();
                    console.log("recent job: ", recent_job);
                    if (!recent_job) {
                        query.date = {};
                    }
                    else {
                        const dateToCheck = recent_job.scheduledTime.split("T")[0];
                        query.date = dateToCheck;
                    }
                    ;
                    break;
            }
            ;
            switch (data) {
                case "outbound":
                    query.direction = "outbound";
                    break;
                case "liveAnswers":
                    query.call_outcome = "successful";
                    break;
                case "automatedAnswers":
                    query.disconnectionReason = { $in: ["voicemail_reached", "machine_detected"] };
                    break;
                case "transfers":
                    query.disconnectionReason = "call_transfer";
                    break;
                case "appointments":
                    query.userSentiment = "scheduled";
                    break;
            }
            ;
            console.log("queryyyyyyy: ", query);
            const callHistory = await historyModel_1.default
                .find(query)
                .sort({ startTimestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean();
            let totalDurationInSeconds = 0;
            let durationCount = 0;
            let averageDuration;
            if ((check_user === null || check_user === void 0 ? void 0 : check_user.clientType) === "inbound" || (check_user === null || check_user === void 0 ? void 0 : check_user.clientType) === "voice") {
                callHistory.forEach((history) => {
                    if (history.durationMs) {
                        let durationInSeconds = 0;
                        if (typeof history.durationMs === "string") {
                            const parts = history.durationMs.split(":").map(Number); // [hh, mm, ss]
                            if (parts.length === 3) {
                                durationInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            }
                            else if (parts.length === 2) {
                                durationInSeconds = parts[0] * 60 + parts[1];
                            }
                            ;
                        }
                        else if (typeof history.durationMs === "number") {
                            durationInSeconds = Math.floor(history.durationMs / 1000);
                        }
                        ;
                        if (!isNaN(durationInSeconds)) {
                            totalDurationInSeconds += durationInSeconds;
                            durationCount++;
                        }
                        ;
                    }
                    ;
                });
                const averageDurationInSeconds = durationCount ? totalDurationInSeconds / durationCount : 0;
                const hours = Math.floor(averageDurationInSeconds / 3600);
                const minutes = Math.floor((averageDurationInSeconds % 3600) / 60);
                const seconds = Math.floor(averageDurationInSeconds % 60);
                const averageDurationFormatted = hours > 0
                    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                console.log("Average Duration: ", averageDurationFormatted);
                averageDuration = averageDurationFormatted;
            }
            ;
            console.log("Total Duration in Seconds: ", totalDurationInSeconds);
            console.log("Duration Count: ", durationCount);
            const callHistories = await Promise.all(callHistory.map(async (history) => {
                const lead = await contact_model_1.contactModel.findOne({ callId: history.callId }).lean();
                const calledTimes = (lead === null || lead === void 0 ? void 0 : lead.calledTimes) || 0;
                const lastCalled = (lead === null || lead === void 0 ? void 0 : lead.datesCalled[0]) || "";
                const timestamp = history.startTimestamp || 0;
                const time = luxon_1.DateTime.fromMillis(timestamp).toFormat('dd/MM/yyyy HH:mm');
                const formattedDuration = history.durationMs ? (() => {
                    const durationParts = typeof (history === null || history === void 0 ? void 0 : history.durationMs) === "string" ? history.durationMs.split(":") : ["00", "00", "00"];
                    return `${durationParts[1]}:${durationParts[2]}`;
                })() : "00:00";
                return {
                    callId: history.callId || "",
                    firstName: history.userFirstname || "",
                    lastName: history.userLastname || "",
                    email: history.userEmail || "",
                    phone: history.toNumber || "",
                    agentId: history.agentId || "",
                    duration: formattedDuration || "",
                    status: history.callStatus || "",
                    dial_status: history.dial_status || "",
                    transcript: history.transcript || "",
                    sentiment: history.userSentiment || "",
                    timestamp: history.endTimestamp || "",
                    summary: history.callSummary || "",
                    recording: history.recordingUrl || "",
                    address: history.address || "",
                    callAttempts: calledTimes || 0,
                    lastCalled,
                    time,
                    callType: history.callType || "",
                    disconnectionReason: history.disconnectionReason || "",
                    direction: history.direction || "",
                    callOutcome: history.call_outcome || "",
                    notes: history.notes || ""
                };
            }));
            const totalRecords = await historyModel_1.default.countDocuments(query);
            const totalPages = Math.ceil(totalRecords / pageSize);
            return res.status(200).json(Object.assign({ callHistories,
                totalRecords,
                totalPages,
                page }, (averageDuration ? { averageDuration } : {})));
        }
        catch (e) {
            console.error("Error fetching voice kpi: " + e);
            next(e);
        }
        ;
    }
    ;
    async schedule_history(req, res, next) {
        var _a;
        try {
            const clientId = req.user._id;
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return res.status(400).json({ error: "User not found" });
            const agentId = (_a = check_user.agents.find(agent => agent.type === "outbound")) === null || _a === void 0 ? void 0 : _a.agentId;
            if (!agentId)
                return res.status(400).json({ error: "No outbound agent found" });
            const schedules = await contact_model_1.jobModel.find({ agentId }).sort({ createdAt: -1 }).lean();
            const result = schedules.map((schedule) => {
                const jobId = schedule.jobId;
                if (!jobId)
                    return null;
                const date = schedule.scheduledTime.split("T")[0];
                const tag = schedule.tagProcessedFor ? schedule.tagProcessedFor.toLowerCase() : "unknown";
                return {
                    date,
                    tag,
                    jobId,
                    totalCalls: schedule.totalContactToProcess,
                    callsMade: schedule.processedContacts,
                    status: schedule.callstatus
                };
            });
            res.status(200).json({
                success: true,
                message: "Dates called fetched successfully",
                dateTagArray: result.filter(item => item !== null)
            });
        }
        catch (e) {
            console.error("Error fetching dates called: " + e);
            next(e);
        }
        ;
    }
    ;
}
;
exports.voice_data_service = new VoiceDataService();
