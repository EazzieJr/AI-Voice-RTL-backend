import RootService from "../_root";
import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import callHistoryModel from "../../models/historyModel";
import { VoiceKPISchema, DashboardSchema, CallHistorySchema } from "../../validations/client/voice_data";
import { DateOption } from "../../utils/types";
import { userModel } from "../../models/userModel";
import { format, toZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";
import { jobModel, contactModel } from "../../models/contact_model";
import { DateTime } from "luxon";
import { date } from "joi";
import { DailyStatsModel } from "../../models/logModel";
import { AutomatedResponses, convertMsToMinSec, DateFilterObjects } from "../../utils/client";
import { calloutcome } from "../../utils/types";
import fs from "fs";

class VoiceDataService extends RootService {
    async voice_kpi(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = VoiceKPISchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const dateOption = req.body.dateOption as DateOption;
            const { agentIds, data } = body;

            const page = parseInt(body.page) || 1;

            const pageSize = 100;
            const skip = (page - 1) * pageSize;


            let query: { [key: string]: any } = {
                agentId: { $in: agentIds }
            };

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            if (!Object.values(DateOption).includes(dateOption)) {
                return res.status(400).json({ error: "Invalid date option" })
            };

            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = toZonedTime(now, timeZone);

            switch (dateOption) {
                case DateOption.ThisWeek:
                    const weekdays: string[] = [];
                    for (let i = 0; i < 7; i++) {
                        const day = subDays(zonedNow, i);
                        const dayOfWeek = day.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                            weekdays.push(valid_day);
                        };
                    };

                    query.date = { $in: weekdays };

                    break;
                
                case DateOption.ThisMonth:
                    const monthDates: string[] = [];
                    for (let i = 0; i < now.getDate(); i++) {
                        const day = subDays(now, i);
                        const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                        monthDates.unshift(valid_day);
                    };

                    query.date = { $in: monthDates };

                    break;

                case DateOption.PastMonth:
                    const pastDates: string[] = [];
                    for (let i = 0; i < 30; i++) {
                        const day = subDays(now, i);
                        const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                        pastDates.unshift(valid_day);
                    };

                    query.date = { $in: pastDates };

                    break;

                case DateOption.Total:
                    // query.date = {};
                    console.log("total");

                    break;

                case DateOption.LAST_SCHEDULE:
                    const recent_job = await jobModel
                        .findOne({ agentId: { $in: agentIds} })
                        .sort({ createdAt: -1 })
                        .lean();

                    console.log("recent job: ", recent_job);

                    if (!recent_job) {
                        query.date = {};
                    } else {
                        const dateToCheck = recent_job.scheduledTime.split("T")[0];
                        query.date = dateToCheck;
                    };

                    break;
            };

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
            };
            console.log("queryyyyyyy: ", query);

            const callHistory = await callHistoryModel
                .find(query)
                .sort({ startTimestamp: -1})
                .skip(skip)
                .limit(pageSize)
                .lean()

            let totalDurationInSeconds = 0;
            let durationCount = 0;
            let averageDuration;

            if (check_user?.clientType === "inbound" || check_user?.clientType === "voice") {
                callHistory.forEach((history) => {
                    if (history.durationMs) {
                        let durationInSeconds = 0;

                        if (typeof history.durationMs === "string") {
                            const parts = history.durationMs.split(":").map(Number); // [hh, mm, ss]
                            if (parts.length === 3) {
                                durationInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            } else if (parts.length === 2) {
                                durationInSeconds = parts[0] * 60 + parts[1];
                            };

                        } else if (typeof history.durationMs === "number") {
                            durationInSeconds = Math.floor(history.durationMs / 1000);
                        };

                        if (!isNaN(durationInSeconds)) {
                            totalDurationInSeconds += durationInSeconds;
                            durationCount++;
                        };

                    };
                });

                const averageDurationInSeconds = durationCount ? totalDurationInSeconds / durationCount: 0;

                const hours = Math.floor(averageDurationInSeconds / 3600);
                const minutes = Math.floor((averageDurationInSeconds % 3600) / 60);
                const seconds = Math.floor(averageDurationInSeconds % 60);

                const averageDurationFormatted = hours > 0
                    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

                console.log("Average Duration: ", averageDurationFormatted);

                averageDuration = averageDurationFormatted;
            };

            console.log("Total Duration in Seconds: ", totalDurationInSeconds);
            console.log("Duration Count: ", durationCount);

            const callHistories = await Promise.all(callHistory.map(async (history) => {
                const lead = await contactModel.findOne({ callId: history.callId }).lean();
                const calledTimes = lead?.calledTimes || 0;
                const lastCalled = lead?.datesCalled[0] || "";
                const timestamp = history.startTimestamp || 0;
                const time = DateTime.fromMillis(timestamp).toFormat('MM/dd/yyyy HH:mm');
                const formattedDuration = history.durationMs ? (() => {
                    const durationParts = typeof history?.durationMs === "string" ? history.durationMs.split(":") : ["00", "00", "00"];
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

            const totalRecords = await callHistoryModel.countDocuments(query);
            const totalPages = Math.ceil(totalRecords / pageSize);

            return res.status(200).json({
                callHistories,
                totalRecords,
                totalPages,
                page,
                ...(averageDuration ? { averageDuration } : {})
            });

        } catch (e) {
            console.error("Error fetching voice kpi: " + e);
            next(e);
        };
    };

    async schedule_history(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found" });

            const agentId = check_user.agents.find(agent => agent.type === "outbound")?.agentId;
            if (!agentId) return res.status(400).json({ error: "No outbound agent found" });

            const schedules = await jobModel.find({ agentId }).sort({ createdAt: -1 }).lean();

            const result = schedules.map((schedule: any) => {
                const jobId = schedule.jobId;

                if (!jobId) return null;
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

        } catch (e) {
            console.error("Error fetching dates called: " + e);
            next(e);
        };
    };

    async dashboard_stats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found" });

            const { error } = DashboardSchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const dateOption = body.dateOption as DateOption;
            const jobId = body.jobId;

            if (!dateOption && !jobId) {
                return res.status(400).json({ error: "Either dateOption or jobId must be provided" });
            };

            if (dateOption && jobId) {
                return res.status(400).json({ error: "Only one of dateOption or jobId should be provided" });
            };  

            const agentId = check_user.agents.find(agent => agent.type === "outbound")?.agentId;
            if (!agentId) return res.status(400).json({ error: "No outbound agent found" });

            console.log("agentId: ", agentId);

            const totalContactForAgent = await contactModel.countDocuments({
                agentId,
                isDeleted: false,
            });

            let voiceData: any;
            let conversionRate;
            let averageCallDuration;

            if (jobId) {
                const job = await jobModel.findOne({ jobId }).lean();
                if (!job) {
                    return res.status(404).json({ error: "JobId not found" });
                };

                console.log("Job found: ", job);

                const stats = await DailyStatsModel.find({
                    jobProcessedBy: jobId
                }).lean();

                console.log("Stats: ", stats);

                if (stats.length === 0) {
                    return res.status(404).json({ error: "No stats found for the provided jobId" });
                };

                const automatedResponse = await AutomatedResponses(jobId);

                voiceData = {
                    answeredCalls: stats[0]?.totalCallAnswered || 0,
                    callDurationInMs: stats[0]?.totalCallDuration || 0,
                    automatedResponse,
                    totalAppointments: stats[0]?.totalAppointment || 0,
                    totalCalls: stats[0]?.totalCalls || 0,
                    totalCallsTransferred: stats[0]?.totalTransffered || 0,
                };
                
            } else if (dateOption) {
                if (!Object.values(DateOption).includes(dateOption)) {
                    return res.status(400).json({ error: "Invalid date option" });
                };

                const dateFilters = await DateFilterObjects(dateOption, agentId);

                const { dateFilter, dateFilter2, date_to_check } = dateFilters;

                const stats = await DailyStatsModel.aggregate([
                    {
                        $match: {
                            agentId,
                            ...dateFilter2
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalCalls: { $sum: "$totalCalls" },
                            totalAnsweredByVm: { $sum: "$totalAnsweredByVm" },
                            totalAppointment: { $sum: "$totalAppointment" },
                            totalCallsTransffered: { $sum: "$totalTransffered" },
                            totalFailedCalls: { $sum: "$totalFailed" },
                            totalAnsweredCalls: { $sum: "$totalCallAnswered" },
                            totalAnsweredByIVR: { $sum: "$totalAnsweredByIVR" },
                            totalCallInactivity: { $sum: "$totalCallInactivity" },
                            totalCallDuration: { $sum: "$totalCallDuration" },
                            totalDialNoAnswer: { $sum: "$totalDialNoAnswer" },
                        }
                    }
                ]);
                console.log("Stats for dateOption: ", stats);

                const automatedResponse = await callHistoryModel.countDocuments({
                    agentId,
                    disconnectionReason: { $in: ["voicemail_reached", "machine_detected"] },
                    ...date_to_check
                });

                const totalAppointments = stats[0]?.totalAppointment || 0;
                const answeredCalls = stats[0]?.totalAnsweredCalls || 0;

                const inboundAgent = check_user.agents.find(agent => agent.type === "inbound")?.agentId;
                let inboundCalls = 0;

                if (inboundAgent) {
                    inboundCalls = await callHistoryModel.countDocuments({
                        agentId: inboundAgent,
                        direction: "inbound",
                        ...date_to_check
                    });
                };
                
                voiceData = {
                    answeredCalls,
                    callDurationInMs: stats[0]?.totalCallDuration || 0,
                    automatedResponse,
                    totalAppointments,
                    totalCalls: stats[0]?.totalCalls || 0,
                    totalCallsTransferred: stats[0]?.totalCallsTransferred || 0,
                    inboundCalls
                };

            };

            console.log("voice data: ", voiceData);

            const totalAppointments = voiceData.totalAppointments;
            const totalAnsweredCalls = voiceData.answeredCalls;
            const totalCallDuration = voiceData.callDurationInMs;

            if (check_user.clientType === "inbound" || check_user.clientType === "voice") {
                conversionRate = (totalAppointments / totalAnsweredCalls) * 100;

                if (totalAnsweredCalls > 0) {
                    const averageDuration = totalCallDuration / totalAnsweredCalls;

                    averageCallDuration = convertMsToMinSec(averageDuration);
                } else {
                    averageCallDuration = "00:00";
                };
            };

            const answerRate = (totalAnsweredCalls / voiceData.totalCalls) * 100 || 0;
            const automatedRate = (voiceData.automatedResponse / voiceData.totalCalls) * 100 || 0;
            const callDurationInMinutes = convertMsToMinSec(totalCallDuration);

            return res.status(200).json({
                totalContactForAgent,
                totalAnsweredCalls,
                answerRate: `${answerRate.toFixed(2)}%`,
                callDuration: callDurationInMinutes,
                totalAutomatedResponses: voiceData.automatedResponse,
                automatedRate: `${automatedRate.toFixed(2)}%`,
                totalAppointment: totalAppointments,
                totalCallsTransferred: voiceData.totalCallsTransferred,
                totalCalls: voiceData.totalCalls,
                ...(conversionRate !== undefined && { conversionRate: `${conversionRate.toFixed(2)}%` }),
                ...(averageCallDuration !== undefined && { averageCallDuration }),
                ...(voiceData.inboundCalls !== undefined && { inboundCalls: voiceData.inboundCalls }),
            });

        } catch (e) {
            console.error("Error fetching dashboard stats: " + e);
            next(e);
        };
    };

    async call_history(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = CallHistorySchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found" });
            
            const agentIds = check_user.agents.map(agent => agent.agentId);
            if (agentIds.length === 0) return res.status(400).json({ error: "No agents found for this user" });

            const { startDate, endDate, sentiment, date, status, tag, contact, disconnectionReason, callType, callOutcome, direction } = body;
            const page = parseInt(body.page) || 1;
            const pageSize = 100;
            const skip = (page - 1) * pageSize;

            let query: { [key: string]: any } = {
                agentId: { $in: agentIds }
            };

            if ((startDate && !endDate) || (!startDate && endDate)) {
                return res.status(400).json({ error: "Both start and end dates must be provided"});
            };

            if (startDate && endDate) {
                query.startTimestamp = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            if (date) {
                query.date = date;
            };

            if (sentiment) {
                const sentiments = ["positive", "negative", "neutral", "unknown"];

                if (!sentiments.includes(sentiment)) {
                    return res.status(400).json({ error: "Invalid sentiment" });
                };
                query.userSentiment = sentiment;
            };

            if (status) {
                query.callStatus = status;
            };

            if (tag) {
                const leadsWithTag = await contactModel.find({ tag, callId: { $exists: true, $ne: "" } }).select("callId").lean();

                const callIds = leadsWithTag.map((lead) => lead.callId);

                if (!callIds || callIds.length === 0) {
                    return res.status(200).json({
                        result: [],
                        message: "No history found for the given tag"
                    });
                };

                query.callId = { $in: callIds };
            };

            if (contact) {
                const leadContacts = await contactModel.find({
                    $or: [
                        {
                            firstname: {
                                $regex: contact,
                                $options: "i"
                            }
                        },
                        {
                            lastname: {
                                $regex: contact,
                                $options: "i"
                            }
                        },
                        {
                            email: {
                                $regex: contact,
                                $options: "i"
                            }
                        },
                        {
                            phone: {
                                $regex: contact,
                                $options: "i"
                            }
                        }
                    ],
                    callId: {
                        $exists: true,
                        $ne: ""
                    }
                }).select("callId").lean();

                const callIds = leadContacts.map((lead) => lead.callId);

                if (!callIds || callIds.length === 0) {
                    return res.status(200).json({
                        result: [],
                        message: "No history found for the given contact"
                    });
                };

                query.callId = { $in: callIds };
            };

            if (disconnectionReason) {
                const reasons = ["user_hangup", "agent_hangup", "dial_failed", "dial_no_answer", "inactivity", "call_transfer", "voicemail_reached", "machine_detected", "max_duration_reached", "concurrency_limit_reached", "dial_busy", "error"];

                if (!reasons.includes(disconnectionReason)) {
                    return res.status(400).json({ error: "Invalid disconnection reason" });
                };

                if (disconnectionReason === "error") {
                    const errors = ["error_inbound_webhook", "error_llm_websocket_open", "error_llm_websocket_lost_connection", "error_llm_websocket_runtime", "error_llm_websocket_corrupt_payload", "error_frontend_corrupted_payload", "error_twilio", "error_no_audio_received", "error_asr", "error_retell", "error_unknown", "error_user_not_joined"];

                    query.disconnectionReason = { $in: errors };
                } else {
                    query.disconnectionReason = disconnectionReason
                };
            };

            if (callType) {
                const callTypes = ["web_call", "phone_call"];

                if (!callTypes.includes(callType)) {
                    return res.status(400).json({ error: "Invalid call type" });
                };

                query.callType = callType;
            };

            if (callOutcome) {
                const validOutcomes = Object.values(calloutcome);
                                    
                if (!validOutcomes.includes(callOutcome)) {
                    return res.status(400).json({ error: "Invalid call outcome" });
                };

                query.call_outcome = callOutcome;
            };

            if (direction) {

                const directions = ["inbound", "outbound"];

                if (!directions.includes(direction)) {
                    return res.status(400).json({ error: "Invalid call direction" });
                };

                query.direction = direction;
            };

            console.log("Query for call history: ", query);

            const callHistory = await callHistoryModel
                .find(query)
                .sort({ startTimestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean();

            const callIds = callHistory.map(history => history.callId);
            const leads = await contactModel.find({
                callId: { $in: callIds }
            }).lean();

            const leadMap = new Map(leads.map(lead => [lead.callId, lead]));

            const callHistories = callHistory.map(history => {
                const lead = leadMap.get(history.callId);
                const calledTimes = lead?.calledTimes || 0;
                const lastCalled = lead?.datesCalled[0] || "";
                const timestamp = history.startTimestamp || 0;
                const time = DateTime.fromMillis(timestamp).toFormat('MM/dd/yyyy HH:mm');
                const formattedDuration = history.durationMs ? (() => {
                    const durationParts = typeof history?.durationMs === "string" ? history.durationMs.split(":") : ["00", "00", "00"];
                    return `${durationParts[1]}:${durationParts[2]}`;
                })() : "00:00";

                const tagToDisplay = (lead?.tag && typeof lead.tag === "string") ? lead.tag.toLowerCase() : "";

                return {
                    callId: history.callId || "",
                    firstName: history.userFirstname || "",
                    lastName: history.userLastname || "",
                    email: history.userEmail || "",
                    phone: history.toNumber || "",
                    agentId: history.agentId || "",
                    duration: formattedDuration,
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
                    notes: history.notes || "",
                    tag: tagToDisplay
                };
            });

            const totalRecords = await callHistoryModel.countDocuments(query);
            const totalPages = Math.ceil(totalRecords / pageSize);

            if (page > totalPages) {
                return res.status(404).json({
                    error: "Page exceeds available data"
                });
            };

            return res.status(200).json({
                callHistories,
                totalRecords,
                totalPages,
                page
            });

        } catch (e) {
            console.error("Error fetching call history: " + e);
            next(e);
        };
    };
};

export const voice_data_service = new VoiceDataService();