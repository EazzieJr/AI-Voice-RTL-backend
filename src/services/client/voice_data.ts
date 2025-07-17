import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import callHistoryModel from "../../models/historyModel";
import { VoiceKPISchema } from "../../validations/client/voice_data";
import { DateOption } from "../../utils/types";
import { userModel } from "../../models/userModel";
import { format, toZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";
import { jobModel, contactModel } from "../../models/contact_model";
import { DateTime } from "luxon";


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
                const time = DateTime.fromMillis(timestamp).toFormat('dd/MM/yyyy HH:mm');
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
                    jobId
                }
            });

            console.log("Dates called result: ", result);

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

};

export const voice_data_service = new VoiceDataService();