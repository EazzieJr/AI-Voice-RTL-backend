import RootService from "./_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authRequest";
import { format, toZonedTime } from "date-fns-tz";
import { callstatusenum, DateOption } from "../utils/types";
import { subDays } from "date-fns";
import { contactModel, jobModel } from "../models/contact_model";
import { DashboardSchema, CallHistorySchema, UploadCSVSchema } from "../validations/client";
import { userModel } from "../models/userModel";
import { DailyStatsModel } from "../models/logModel";
import callHistoryModel from "../models/historyModel";
import fs from "fs";
import { IContact } from "../utils/types";
import csvParser from "csv-parser";
import { formatPhoneNumber } from "../utils/formatter";
import { DateTime } from "luxon";
import { dailyGraphModel } from "../models/graphModel";

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

    async upload_csv(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            if (!req.file) return res.status(500).json({ message: "No file found" });
            const body = req.body;

            const { error } = UploadCSVSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);
            
            const csvFile = req.file;
            const { agentId, tag } = body;
            const lowerCaseTag = typeof tag === "string" ? tag.toLowerCase() : "";
        
            const requiredHeaders = ["firstname", "lastname", "phone", "email"];
            const uniqueRecordsMap = new Map<string, IContact>();
            const failedContacts: any[] = [];
            const duplicateKeys = new Set<string>();

            fs.createReadStream(csvFile.path)
                .pipe(csvParser())
                .on("headers", (headers) => {
                    const missing_headers = requiredHeaders.filter((header)  => !headers.includes(header.trim().toLowerCase()));

                    if (missing_headers.length > 0) return res.status(100).json({
                        message: "CSV must contain the followin headers; firstname, lastname, phone, and email"
                    })
                })
                .on("data", (row) => {
                    const { firstname, lastname, email, phone, address } = row;

                    if (firstname && phone) {
                        const formattedPhone = formatPhoneNumber(phone);

                        if (uniqueRecordsMap.has(formattedPhone)) {
                            duplicateKeys.add(formattedPhone);
                            failedContacts.push({ row, reason: "duplicate" });
                        } else {
                            uniqueRecordsMap.set(formattedPhone, {
                                firstname,
                                lastname,
                                phone: formattedPhone,
                                email,
                                address: address || ""
                            });
                        };
                    } else {
                        failedContacts.push({ row, reason: "missing required fields" });
                    };
                })
                .on("end", async() => {
                    const uniqueUsersToInsert = Array.from(uniqueRecordsMap.values()).filter(
                        (user) => !duplicateKeys.has(user.phone)
                    );

                    const dncList: string[] = [""];
                    const usersWithAgentId = uniqueUsersToInsert.map((user) => ({
                        ...user,
                        agentId: agentId,
                        tag: lowerCaseTag,
                        isOnDNCList: dncList.includes(user.phone),
                    }));

                    const phoneNumbersToCheck = usersWithAgentId.map((user) => user.phone);
                    const existingUsers = await contactModel.find({
                        isDeleted: false,
                        phone: { $in: phoneNumbersToCheck },
                    });

                    const dbDuplicates = existingUsers;
                    const existingPhoneNumbers = new Set(
                        existingUsers.map((user) => user.phone)
                    );

                    const finalUsersToInsert = usersWithAgentId.filter(
                        (user) => !existingPhoneNumbers.has(user.phone) && user.phone
                    );
        
                    if (finalUsersToInsert.length > 0) {
                        console.log("Inserting users:", finalUsersToInsert);
                        await contactModel.bulkWrite(
                            finalUsersToInsert.map((user) => ({
                            insertOne: { document: user },
                            }))
                        );
                        await userModel.updateOne(
                            { "agents.agentId": agentId },
                            { $addToSet: { "agents.$.tag": lowerCaseTag } }
                        );
                    };

                    fs.unlink(csvFile.path, (err) => {
                        if (err) {
                            console.error("Unable to delete file: ", err);
                        } else {
                            console.log("Deleted file successfully");
                        };
                    });

                    res.status(200).json({
                        message: `Upload successful, contacts uploaded: ${finalUsersToInsert.length}`,
                        duplicates: dbDuplicates,
                        failedContacts
                    });
                })
                .on("error", (err) => {
                    console.error("Error processing CSV: ", err);
                    res.status(500).json({ message: "Failed to process CSV data" });
                });
                
        } catch (e) {
            console.error("Error uploading csv file: ", e);
            next(e);
        };
    };

    async graph_chart(req: AuthRequest, res: Response, next: NextFunction): Promise<Response>{
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

            const selectedDateOption = dateOption;
            const timeZone = "America/Los_Angeles";

            const createHourlyTemplate = () => 
                Array.from({ length: 7 }, (_, i) => ({
                    x: `${(9 + i).toString().padStart(2, "0")}:00`,
                    y: 0
                }));
            
            const sumHourlyCalls = (hourlyCalls: Map<string, number>, start = 9, end = 15) => 
                Array.from(hourlyCalls.entries())
                    .filter(([hour]) => {
                    const hourInt = parseInt(hour.split(":")[0], 10);
                    return hourInt >= start && hourInt < end;
                    })
                    .reduce((sum, [, count]) => sum + count, 0);
        
            const getWeekDays = (startDay: DateTime) => 
                Array.from({ length: 7 }, (_, i) => startDay.minus({ days: i }).toISODate()).reverse();
            
            // Fetching data based on DateOption;
            let response: any[];

            if (selectedDateOption === DateOption.Today) {
                console.log("hello: I am here");
                const today = DateTime.now().setZone(timeZone).startOf("day").toISODate();

                const stats = await dailyGraphModel.find({
                    agentId: { $in: agentIds },
                    date: today
                });

                if (stats.length === 0) {
                    return res.status(404).json({ message: "No stats found for the given agents and day" });
                };

                const aggregatedCalls = stats.reduce((acc, stat) => {
                    const hourlyCalls = stat.hourlyCalls as Map<string, number>;
                    hourlyCalls.forEach((count, hour) => {
                        if (!acc[hour]) acc[hour] = 0;
                        acc[hour] += count;
                    });
                    return acc;
                }, {} as { [hour: string]: number });

                response = createHourlyTemplate().map((entry) => ({
                    ...entry,
                    y: aggregatedCalls[entry.x] || 0
                }));
            } else if (selectedDateOption === DateOption.ThisWeek) {
                const startDay = DateTime.now().setZone(timeZone).startOf("day");
                const weekDays: string[] = getWeekDays(startDay);

                const stats = await dailyGraphModel.find({
                    agentId: { $in: agentIds },
                    date: { $in: weekDays }
                });

                if (stats.length === 0) {
                    return res.status(404).json({ message: "No stats found for the given agents and timeframe" });
                };

                response = weekDays.map((day) => {
                    const dayStats = stats.filter((stat) => stat.date === day);
                    const dailySum = dayStats.reduce((sum, stat) => sum + sumHourlyCalls(stat.hourlyCalls), 0);

                    const dayName = DateTime.fromISO(day, { zone: timeZone }).toLocaleString({ weekday: "long" });

                    return { x: dayName, y: dailySum || 0 };
                });
            } else if (selectedDateOption === DateOption.ThisMonth) {
                const stats = await dailyGraphModel.find({ agentId: { $in: agentIds } });
                console.log("month: ", stats);

                if (stats.length === 0) {
                    return res.status(404).json({ message: "No stats found for the given agents and timeframe" });
                };

                response = Array.from({ length: 12 }, (_, i) => {
                    const monthStats = stats.filter(
                        (stat) => DateTime.fromISO(stat.date).month === i + 1
                    );
                    const monthlySum = monthStats.reduce((sum, stat) => sum + sumHourlyCalls(stat.hourlyCalls), 0);

                    const monthName = DateTime.fromObject({ month: i + 1 }).toLocaleString({ month: "long" });
                    
                    return { x: monthName, y: monthlySum };
                });
            } else if (selectedDateOption === DateOption.LAST_SCHEDULE) {
                const lastStat = await dailyGraphModel
                    .findOne({ agentId: { $in: agentIds } })
                    .sort({ date: -1 });

                if (!lastStat) {
                    response = createHourlyTemplate();
                } else  {
                    const stats = await dailyGraphModel.find({
                        agentId: { $in: agentIds },
                        date: lastStat.date,
                    });

                    if (stats.length === 0) {
                        return res.status(404).json({ message: "No stats found for the given agents and timeframe" });
                    };

                    const aggregatedCalls = stats.reduce((acc, stat) => {
                        const hourlyCalls = stat.hourlyCalls as Map<string, number>;
                        hourlyCalls.forEach((count, hour) => {
                            if (!acc[hour]) acc[hour] = 0;
                            acc[hour] += count;
                        });
                        return acc;
                    }, {} as { [hour: string]: number });

                    response = createHourlyTemplate().map((entry) => ({
                        ...entry,
                        y: aggregatedCalls[entry.x] || 0,
                    }));
                };
            } else {
                return res.status(400).json({ error: "Invalid dateOption" });
            };

            return res.status(200).json({
                success: true,
                response
            });

        } catch (e) {
            console.error("Error fetching client graph" + e);
            next(e);
        };
    };
};

export const client_service = new ClientService();