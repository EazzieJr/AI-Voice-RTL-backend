import RootService from "./_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authRequest";
import { format, toZonedTime } from "date-fns-tz";
import { callstatusenum, DateOption } from "../utils/types";
import { subDays } from "date-fns";
import { contactModel, jobModel } from "../models/contact_model";
import { DashboardSchema, CallHistorySchema } from "../validations/client";
import { userModel } from "../models/userModel";
import { DailyStatsModel } from "../models/logModel";
import callHistoryModel from "../models/historyModel";

class ClientService extends RootService {
    async dashboard_stats(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = DashboardSchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const dateOption = req.body.dateOption as DateOption;
            const { agentIds } = body;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            if (!Object.values(DateOption).includes(dateOption)) {
                return res.status(400).json({ error: "Invalid date option" })
            };

            let dateFilter = {};
            let dateFilter2 = {};

            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = toZonedTime(now, timeZone);
            const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

            switch (dateOption) {
                case DateOption.Today:
                    dateFilter = { datesCalled: today };
                    dateFilter2 = { day: today };

                    break;
                
                case DateOption.Yesterday:
                    const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
                    const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });

                    dateFilter = { datesCalled: yesterday };
                    dateFilter2 = { day: yesterday };

                    break;

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

                    dateFilter = { datesCalled: { $in: weekdays }};
                    dateFilter2 = { day: { $in: weekdays }};

                    break;

                case DateOption.ThisMonth:
                    const monthDates: string[] = [];
                    for (let i = 0; i < now.getDate(); i++) {
                        const day = subDays(now, i);
                        const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                        monthDates.unshift(valid_day);
                    };

                    dateFilter = { datesCalled: { $in: monthDates } };
                    dateFilter2 = { day: { $in: monthDates } };

                    break;

                case DateOption.PastMonth:
                    const pastDates: string[] = [];
                    for (let i = 0; i < 30; i++) {
                        const day = subDays(now, i);
                        const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                        pastDates.unshift(valid_day);
                    };

                    dateFilter = { datesCalled: { $in: pastDates } };
                    dateFilter2 = { day: { $in: pastDates } };

                    break;

                case DateOption.Total:
                    dateFilter = {};
                    dateFilter2 = {};

                    break;

                case DateOption.LAST_SCHEDULE:
                    const recent_job = jobModel
                        .findOne({ agentId: { $in: agentIds} })
                        .sort({ createdAt: -1 })
                        .lean();

                    if (!recent_job) {
                        dateFilter = {};
                        dateFilter2 = {};
                    } else {
                        const dateToCheck = (await recent_job).scheduledTime.split("T")[0];

                        dateFilter = { datesCalled: dateToCheck };
                        dateFilter2 = { day: dateToCheck };
                    };

                    break;
            };

            // const foundContacts = await contactModel
            //     .find({
            //         agentId: { $in: agentIds },
            //         isDeleted: false,
            //         ...dateFilter
            //     });

            const totalContactForAgent = await contactModel.countDocuments({
                agentId: { $in: agentIds },
                isDeleted: false
            });

            const totalNotCalledForAgent = await contactModel.countDocuments({
                agentId: { $in: agentIds },
                isDeleted: false,
                dial_status: callstatusenum.NOT_CALLED,
                ...dateFilter
            });

            const totalAnsweredCalls = await contactModel.countDocuments({
                agentId: { $in: agentIds },
                isDeleted: false,
                dial_status: callstatusenum.CALLED,
                ...dateFilter
            });

            const stats = await DailyStatsModel.aggregate([
                {
                    $match: {
                        agentId: { $in: agentIds },
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

            function convertMsToHourMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;

                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            };

            const combinedCallDuration = convertMsToHourMinSec(stats[0]?.totalCallDuration || 0);                

            return res.status(200).json({
                totalContactForAgent,
                totalAnsweredCalls,
                totalNotCalledForAgent,
                callDuration: combinedCallDuration,
                totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
                totalAppointment: stats[0]?.totalAppointment || 0,
                totalCallsTransffered: stats[0]?.totalCallsTransffered || 0,
                totalCalls: stats[0]?.totalCalls || 0,
                totalFailedCalls: stats[0]?.totalFailedCalls || 0,
                totalAnsweredByIVR: stats[0]?.totalAnsweredByIVR || 0,
                totalDialNoAnswer: stats[0]?.totalDialNoAnswer || 0,
                totalCallInactivity: stats[0]?.totalCallInactivity || 0
            });

        } catch (error) {
            console.error("Error fetching dashboard stats: ", error);
            next(error);
        };
    };

    async call_history(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = CallHistorySchema.validate(body, { abortEarly: false } );
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { agentIds, startDate, endDate } = body;
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

            const callHistory = await callHistoryModel
                .find(query)
                .sort({ startTimestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean();

            if (!callHistory || callHistory.length === 0) {
                return res.status(200).json({
                    message: "No Call history found"
                });
            };

            const callHistories = callHistory.map((history) => ({
                callId: history.callId || "",
                firstName: history.userFirstname || "",
                lastName: history.userLastname || "",
                email: history.userEmail || "",
                phone: history.toNumber || "",
                agentId: history.agentId || "",
                duration: history.durationMs || "",
                status: history.callStatus || "",
                dial_status: history.dial_status || "",
                transcript: history.transcript || "",
                sentiment: history.userSentiment || "",
                timestamp: history.endTimestamp || "",
                summary: history.callSummary || "",
                recording: history.recordingUrl || "",
                address: history.address || ""
            }));

            const totalRecords = await callHistoryModel.countDocuments(query);
            const totalPages = Math.ceil(totalRecords / pageSize);

            if (page > totalPages) {
                return res.status(400).json({
                    error: "Page exceeds available data"
                });
            };

            return res.status(200).json({
                callHistories,
                totalRecords,
                totalPages,
                page
            });

        } catch (error) {
            console.error("Error fetching call history: ", error);
            next(error);
        };
    };
};

export const client_service = new ClientService();