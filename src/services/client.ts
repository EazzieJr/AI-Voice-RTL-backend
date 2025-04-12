import RootService from "./_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authRequest";
import { format, toZonedTime } from "date-fns-tz";
import { callstatusenum, DateOption } from "../utils/types";
import { subDays } from "date-fns";
import { contactModel, EventModel, jobModel } from "../models/contact_model";
import { DashboardSchema, CallHistorySchema, UploadCSVSchema, CampaignStatisticsSchema, ForwardReplySchema, ReplyLeadSchema, AddWebhookSchema, AgentDataSchema, UpdateAgentIdSchema, ContactsSchema, EditProfileSchema } from "../validations/client";
import { userModel } from "../models/userModel";
import { DailyStatsModel } from "../models/logModel";
import callHistoryModel from "../models/historyModel";
import fs, { stat } from "fs";
import { IContact } from "../utils/types";
import csvParser from "csv-parser";
import { formatPhoneNumber } from "../utils/formatter";
import { DateTime } from "luxon";
import { dailyGraphModel } from "../models/graphModel";
import axios from "axios";
import { WebhookModel } from "../models/webhook";
import { IReply, ReplyModel } from "../models/emailReply";
import { reviewTranscript } from "../utils/transcript-review";
import argon2 from "argon2";
import { cloudinary } from "../utils/upload";
import streamifier from "streamifier";

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

            const totalContactForAgent = await contactModel.countDocuments({
                agentId: { $in: agentIds },
                isDeleted: false
            });

            // const totalNotCalledForAgent = await contactModel.countDocuments({
            //     agentId: { $in: agentIds },
            //     isDeleted: false,
            //     dial_status: callstatusenum.NOT_CALLED,
            //     ...dateFilter
            // });

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

            function convertMsToMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }

            const combinedCallDuration = convertMsToMinSec(stats[0]?.totalCallDuration || 0);

            const totalCalls = stats[0]?.totalCalls || 0;
            const answerRate = (totalAnsweredCalls / totalCalls) * 100;

            const automatedAnswers = (stats[0]?.totalAnsweredByVm || 0) + (stats[0]?.totalAnsweredByIVR || 0);

            const automatedRate = (automatedAnswers / totalCalls) * 100;

            return res.status(200).json({
                totalContactForAgent,
                totalAnsweredCalls,
                answerRate: `${answerRate.toFixed(2)}%`,
                // totalNotCalledForAgent,
                callDuration: combinedCallDuration,
                totalAutomatedAnswers: automatedAnswers,
                automatedRate: `${automatedRate.toFixed(2)}%`,
                // totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
                totalAppointment: stats[0]?.totalAppointment || 0,
                totalCallsTransferred: stats[0]?.totalCallsTransffered || 0,
                totalCalls,
                // totalFailedCalls: stats[0]?.totalFailedCalls || 0,
                // totalAnsweredByIVR: stats[0]?.totalAnsweredByIVR || 0,
                // totalDialNoAnswer: stats[0]?.totalDialNoAnswer || 0,
                // totalCallInactivity: stats[0]?.totalCallInactivity || 0
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

    async all_campaigns(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaigns = await axios.get(url);
            const result = campaigns.data;

            if (!result) return res.status(400).json({ message: "all stats not found"});

            return res.status(200).json({
                success: true,
                result
            });
    
        } catch (e) {
            console.error('Error fetching all campaigns from smart lead: ' + e);
            next(e);
        };
    };

    async single_campaign(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const campaignId = req.query.campaignId;

            if (campaignId === null || campaignId === undefined || !campaignId) return res.status(400).json({ message: "CampaignId is required" });

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const result = campaign.data;

            if (!result) return res.status(400).json({ message: "stats not found"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching single campaign from smart-lead: " + e);
            next(e);
        };
    };

    async single_campaign_stats(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = CampaignStatisticsSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const { campaignId, limit, email_status, startDate, endDate } = body;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});
            
            const baseUrl = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/statistics?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const queryParams = [];

            if (limit) queryParams.push(`limit=${limit}`);
            if (email_status) queryParams.push(`email_status=${email_status}`);
            if (startDate) queryParams.push(`sent_time_start_date=${startDate}`);
            if (endDate) queryParams.push(`sent_time_end_date=${endDate}`);

            const url = queryParams.length ? `${baseUrl}&${queryParams.join('&')}` : baseUrl;

            const campaign = await axios.get(url);

            const result = campaign.data;

            if (!result) return res.status(400).json({ message: "history not found"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching single campaign stats from smart lead: " + e);
            next(e);
        };
    };

    async single_campaign_analytics(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const campaignId = req.query.campaignId;

            if (campaignId === null || campaignId === undefined || !campaignId) return res.status(400).json({ message: "CampaignId is required" });

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/analytics?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const result = campaign.data;

            if (!result) return res.status(400).json({ message: "history not found"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching sinle campaign analytics: " + e);
            next(e);
        };
    };

    async all_campaign_analytics(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const page = req.query.page as string;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { name } = check_user;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            let foundClient;

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };
            
            if (name === "Legacy Alliance Club") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Digital Mavericks Media");
            } else if (name === "Cory Lopez-Warfield") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Cory Warfield");
            } else {
                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            }

            if (!foundClient) return res.status(400).json({ error: "Client not found in Intuitive Campaigns" });

            const { id } = foundClient;

            const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const all_campaigns = campaign.data;

            if (!all_campaigns) return res.status(400).json({ message: "No Analytics not found"});

            const client_campaigns = all_campaigns.filter((campaign: any) => campaign.client_id === id);

            const limit = 15;
            const page_to_use = parseInt(page) || 1;
            const startIndex = (page_to_use - 1) * limit;
            const endIndex = page_to_use * limit;
            const totalPages = Math.ceil(client_campaigns.length / limit);


            if (page_to_use > totalPages) {
                return res.status(400).json({
                    error: "Page exceeds available data"
                });
            };

            const campaignsToFetch = client_campaigns.slice(startIndex, endIndex);

            let result: Object[] = [];

            for (const campaign of campaignsToFetch) {
                const { id } = campaign;

                const analyticsUrl = `${process.env.SMART_LEAD_URL}/campaigns/${id}/analytics?api_key=${process.env.SMART_LEAD_API_KEY}`;

                const analytics = await axios.get(analyticsUrl);
                const campaign_analytics = analytics.data;
                
                result.push(campaign_analytics);
            };

            return res.status(200).json({
                success: true,
                result,
                page: page_to_use,
                totalPages
            });

        } catch (e) {
            console.error("Error fetching all campaign analytics: " + e);
            next(e);
        };
    };

    async fetch_message_history(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const campaignId = req.query.campaignId;
            const lead_id = req.query.lead_id;
            const date = req.query.date;

            if (campaignId === null || campaignId === undefined || !campaignId) return res.status(400).json({ message: "CampaignId is required" });

            if (lead_id === null || lead_id === undefined || !lead_id) return res.status(400).json({ message: "LeadId is required" });

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            let url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/leads/${lead_id}/message-history?api_key=${process.env.SMART_LEAD_API_KEY}`;

            if (date) {
                url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/leads/${lead_id}/message-history?api_key=${process.env.SMART_LEAD_API_KEY}&event_time_gt=${date}`;
            };

            const campaign = await axios.get(url);

            const result = campaign.data;

            if (!result) return res.status(400).json({ message: "history not found"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching message history from Intuitive Campaign: " + e);
            next(e);
        };
    };

    async forward_email(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = ForwardReplySchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { campaignId, message_id, stats_id, to_emails } = body;

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/forward-email?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.post(url, {
                message_id,
                stats_id,
                to_emails
            });

            console.log("campa: ", campaign);

            const result = campaign.data;
            console.log("result: ", result);

            if (!result) return res.status(400).json({ message: "unable to forward message"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error forwarding reply via Intuitive campaign: " + e);
            next(e);
        };
    };

    async list_leads(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const campaignId = req.query.campaignId;

            if (campaignId === null || campaignId === undefined || !campaignId) return res.status(400).json({ message: "CampaignId is required" });

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/leads?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const result = campaign.data;

            if (!result) return res.status(400).json({ message: "No leads found"});

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching list of leads: " + e);
            next(e);
        };
    };

    async reply_lead(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = ReplyLeadSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { campaignId, email_body, reply_message_id, reply_email_time, reply_email_body, cc, bcc, add_signature, to_first_name, to_last_name, to_email } = body;
            const body_to_send = Object.entries({
                email_body,
                reply_message_id,
                reply_email_time,
                reply_email_body,
                cc,
                bcc,
                add_signature,
                to_first_name, 
                to_last_name,
                to_email
            }).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    acc[key] = value;
                }
                return acc;
            }, {} as Record<string, any>);

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/reply-email-thread?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.post(url, body_to_send);

            const result = campaign.data;
            console.log("result: ", result);

            if (result.ok !== "true") return res.status(400).json({ message: "unable to reply to lead"});

            // return res.status(200).json({
            //     success: true,
            //     result
            // });

            const update_reply = await ReplyModel.updateOne(
                {
                    campaign_id: campaignId,
                    message_id: reply_message_id,
                    replied_to: false
                },
                { replied_to: true }
            );

            if (!update_reply.acknowledged) {
                return res.status(200).json({
                    success: true,
                    result
                });

            } else {
                return res.status(200).json({
                    success: true,
                    message: "Reply made but Unable to update replied_to status in db",
                    result
                });
            }

        } catch (e) {
            console.error("Error replying email lead: " + e);
            next(e);
        };
    };

    async campaign_dashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { name } = check_user;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            let foundClient;

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };
            
            if (name === "Legacy Alliance Club") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Digital Mavericks Media");
            } else if (name === "Cory Lopez-Warfield") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Cory Warfield");
            } else {
                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            }

            if (!foundClient) return res.status(400).json({ error: "Client not found in Intuitive Campaign" });

            const { id } = foundClient;

            const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const all_campaigns = campaign.data;

            if (!all_campaigns) return res.status(400).json({ message: "No Analytics not found"});

            const client_campaigns = all_campaigns.filter((campaign: any) => campaign.client_id === id);

            let result: Object[] = [];

            for (const campaign of client_campaigns) {
                const { id } = campaign;

                const analyticsUrl = `${process.env.SMART_LEAD_URL}/campaigns/${id}/analytics?api_key=${process.env.SMART_LEAD_API_KEY}`;

                const analytics = await axios.get(analyticsUrl);
                const campaign_analytics = analytics.data;
                
                result.push(campaign_analytics);
            };
            
            interface CampaignObject {
                id: number,
                user_id: number,
                created_at: string,
                status: string,
                name: string,
                sent_count: string,
                open_count: string,
                click_count: string,
                reply_count: string,
                block_count: string,
                total_count: string,
                sequence_count: string,
                drafted_count: string,
                tags: any,
                unique_sent_count: string,
                unique_open_count: string,
                unique_click_count: string,
                client_id: number,
                bounce_count: string,
                parent_campaign_id: any,
                unsubscribed_count: string,
                campaign_lead_stats: {
                    total: number,
                    paused: number,
                    blocked: number,
                    revenue: number,
                    stopped: number,
                    completed: number,
                    inprogress: number,
                    interested: number,
                    notStarted: number
                },
                team_member_id: any,
                send_as_plain_text: boolean,
                client_name: string,
                client_email: string,
                client_company_name: string
            };

            const summedValues: { [key: string]: number } = {};

            const parent_keys = ["sent_count", "open_count", "click_count", "reply_count", "bounce_count"];
            const stat_keys = ["total", "interested"];

            parent_keys.forEach((key) => {
                summedValues[key] = 0;
            });
            stat_keys.forEach((key) => {
                summedValues[key] = 0;
            });

            (result as CampaignObject[]).forEach((campaign: CampaignObject) => {
                parent_keys.forEach((key) => {
                    summedValues[key] += parseInt(campaign[key as keyof CampaignObject] as string) || 0;
                });
                
                stat_keys.forEach((key) => {
                    summedValues[key] += campaign.campaign_lead_stats[key as keyof typeof campaign.campaign_lead_stats] || 0;
                });
            });

            const dashboard = {
                total_sent: summedValues.sent_count,
                replied: summedValues.reply_count,
                opened: summedValues.open_count,
                clicked: summedValues.click_count,
                positive_reply: summedValues.interested,
                bounced: summedValues.bounce_count,
                contacts: summedValues.total
            };

            return res.status(200).json({
                success: true,
                result: {
                    ...dashboard
                }
            });

        } catch (e) {
            console.error("Error fetching campaign dashboard: " + e);
            next(e);
        };
    };

    async campaign_overview(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { name } = check_user;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            let foundClient;

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };
            
            if (name === "Legacy Alliance Club") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Digital Mavericks Media");
            } else if (name === "Cory Lopez-Warfield") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Cory Warfield");
            } else {
                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            }

            if (!foundClient) return res.status(400).json({ error: "Client not found in Intuitive Campaigns"});

            const { id } = foundClient;

            const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const campaign = await axios.get(url);
            const all_campaigns = campaign.data;

            if (!all_campaigns) return res.status(400).json({ message: "No Analytics not found"});

            const client_campaigns = all_campaigns.filter((campaign: any) => campaign.client_id === id);

            let result: Object[] = [];

            for (const campaign of client_campaigns) {
                const { id } = campaign;

                const analyticsUrl = `${process.env.SMART_LEAD_URL}/campaigns/${id}/analytics?api_key=${process.env.SMART_LEAD_API_KEY}`;

                const analytics = await axios.get(analyticsUrl);
                const campaign_analytics = analytics.data;
                
                result.push(campaign_analytics);
            };

            interface CampaignObject {
                id: number,
                user_id: number,
                created_at: string,
                status: string,
                name: string,
                sent_count: string,
                open_count: string,
                click_count: string,
                reply_count: string,
                block_count: string,
                total_count: string,
                sequence_count: string,
                drafted_count: string,
                tags: any,
                unique_sent_count: string,
                unique_open_count: string,
                unique_click_count: string,
                client_id: number,
                bounce_count: string,
                parent_campaign_id: any,
                unsubscribed_count: string,
                campaign_lead_stats: {
                    total: number,
                    paused: number,
                    blocked: number,
                    revenue: number,
                    stopped: number,
                    completed: number,
                    inprogress: number,
                    interested: number,
                    notStarted: number
                },
                team_member_id: any,
                send_as_plain_text: boolean,
                client_name: string,
                client_email: string,
                client_company_name: string
            };

            const summedValues: { [key: string]: number } = {};

            const parent_keys = ["sent_count", "reply_count", "bounce_count"];
            const stat_keys = ["total", "interested"];

            parent_keys.forEach((key) => {
                summedValues[key] = 0;
            });
            stat_keys.forEach((key) => {
                summedValues[key] = 0;
            });

            (result as CampaignObject[]).forEach((campaign: CampaignObject) => {
                parent_keys.forEach((key) => {
                    summedValues[key] += parseInt(campaign[key as keyof CampaignObject] as string) || 0;
                });
                
                stat_keys.forEach((key) => {
                    summedValues[key] += campaign.campaign_lead_stats[key as keyof typeof campaign.campaign_lead_stats] || 0;
                });
            });

            const bounce = (summedValues.bounce_count / summedValues.total) * 100;
            const bounce_rate = bounce.toFixed(2) + "%";

            const overview = {
                emails_sent: summedValues.sent_count,
                replies: summedValues.reply_count,
                positive_responses: summedValues.interested,
                bounces: summedValues.bounce_count,
                total_contacts: summedValues.total,
                bounce_rate
            };

            return res.status(200).json({
                success: true,
                result: {
                    ...overview
                }
            });

        } catch (e) {
            console.error("Error fetching campaign overview: " + e);
            next(e);
        };
    };

    async add_webhook(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = AddWebhookSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { campaignId, name, webhook_url, event_types, categories } = body;

            const body_to_send = {
                id: null as number | null,
                name,
                webhook_url,
                event_types,
                categories
            };

            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/webhooks?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const webhook = await axios.post(url, body_to_send);
            const response = webhook.data;

            if (response.ok !== true) return res.status(400).json({ message: "unable to add webhook"});

            return res.status(200).json({
                success: true,
                result: response
            });

        } catch (e) {
            console.error("Error adding webhook: " + e);
            next(e);
        };
    };

    async email_sent_webhook(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const body = req.body;

            console.log("email sent webhook: ", body);

            const log = new WebhookModel(body);
            await log.save();

            return res.status(200).json({
                success: true,
                message: "email sent webhook received",
            });

        } catch (e) {
            console.error("Error receiving email sent webhook: " + e);
            next(e);
        };
    };

    async fetch_agent_data(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = AgentDataSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { agentId } = body;
            const dateOption = req.body.dateOption as DateOption;

            let date_filter = {};
            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = toZonedTime(now, timeZone);
            const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
            const cur_now = DateTime.now().setZone("America/Los_Angeles");

            const totalContacts = await contactModel.countDocuments({
                agentId,
                isDeleted: false
            });

            const totalNotCalled = await contactModel.countDocuments({
                agentId,
                isDeleted: false,
                dial_status: callstatusenum.NOT_CALLED
            });

            switch (dateOption) {
                case DateOption.Today:
                    date_filter = { day: today };
                    break;

                case DateOption.Yesterday:
                    const yest_zone = toZonedTime(subDays(now, 1), timeZone);
                    const yesterday = format(yest_zone, "yyyy-MM-dd", { timeZone });
                    date_filter = { day: yesterday };

                    break;

                case DateOption.ThisWeek:
                    const weekdays: string[] = [];
                    for (let i = 0; i < 7; i++) {
                        const day = subDays(zonedNow, i);
                        const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                        weekdays.push(valid_day);
                    }
                    date_filter = { day: { $in: weekdays } };

                    break;

                case DateOption.ThisMonth:
                    const startOfMonth = cur_now.startOf("month");
                    const todayDate = cur_now.startOf("day");

                    const monthDates: string[] = [];
                    let currentDate = startOfMonth;

                    while (currentDate <= todayDate) {
                        monthDates.push(currentDate.toFormat("yyyy-MM-dd"));

                        currentDate = currentDate.plus({ days: 1 });
                    };

                    date_filter = { day: { $in: monthDates } };

                    break;
                
                case DateOption.PastMonth:
                    const startDate = cur_now.minus({ days: 30 }).startOf("day");

                    const pastMonthDates: string[] = [];
                    let currentDatePast = startDate;

                    while (currentDatePast <= cur_now.startOf("day")) {
                        pastMonthDates.push(currentDatePast.toFormat("yyyy-MM-dd"));
                    
                        currentDatePast = currentDatePast.plus({ days: 1 });
                    };

                    date_filter = { day: { $in: pastMonthDates } };

                    break;

                case DateOption.Total:
                    date_filter = {};

                    break;
                
                case DateOption.LAST_SCHEDULE:
                    const recentJob = await jobModel
                        .findOne({ agentId })
                        .sort({ createdAt: -1 })
                        .lean();

                    if (recentJob) {
                        const dateToCheck = recentJob.scheduledTime.split("T")[0];

                        date_filter = { day: dateToCheck };

                    } else {
                        date_filter = {};
                    };

                    break;

            };

            const stats = await DailyStatsModel.aggregate([
                {
                    $match: {
                        agentId,
                        ...date_filter
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
                        totalDialNoAnswer: { $sum: "$totalDialNoAnswer" },
                        totalAnsweredByIVR: { $sum: "$totalAnsweredByIVR" },
                        totalCallInactivity: { $sum: "$totalCallInactivity" },
                        totalCallDuration: { $sum: "$totalCallDuration" },
                    }
                }
            ]);

            function convertMillisecondsToTime(milliseconds: number): string {
                const hours = Math.floor(milliseconds / (1000 * 60 * 60));
                const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
              
                const formattedHours = String(hours).padStart(2, '0');
                const formattedMinutes = String(minutes).padStart(2, '0');
                const formattedSeconds = String(seconds).padStart(2, '0');
              
                return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
            };

            const milliseconds = stats[0]?.totalCallDuration || 0;

            const combinedCallDuration = convertMillisecondsToTime(milliseconds);

            const result = {
                totalContacts,
                totalCalls: stats[0]?.totalCalls || 0,
                totalNotCalled,
                totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
                totalFailedCalls: stats[0]?.totalFailedCalls || 0,
                totalAnsweredCalls: stats[0]?.totalAnsweredCalls || 0,
                totalCallsTransferred: stats[0]?.totalCallsTransffered || 0,
                totalCallsDuration: combinedCallDuration,
                totalAppointments: stats[0]?.totalAppointment || 0
            };

            return res.status(200).json({
                success: true,
                result
            });

        } catch (e) {
            console.error("Error fetching single agent stats" + e);
            next(e);
        };
    };

    async schedule_details(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const agentId = req.query.agentId as string;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const recent_schedule = await jobModel
                .findOne({ agentId })
                .sort({ createdAt: -1 })
                .lean();

            if (!recent_schedule) return res.status(400).json({ message: "No schedule found"});

            const { scheduledTime, tagProcessedFor } = recent_schedule;

            const dateToCheck = scheduledTime.split("T")[0];

            const startDate = `${dateToCheck}T00:00:00.000`;
            const endDate = `${dateToCheck}T23:59:59.999`;

            const schedules = await jobModel.find({
                agentId,
                scheduledTime: {
                    $gte: startDate,
                    $lte: endDate
                },
                callstatus: { $in: ["Calling", "Called"] }
            });

            let allContactsToProcess: number = 0;
            let allCompletedPercent: number = 0;
            let allProcessedContacts: number = 0;

            console.log("sched: ", schedules);

            for (const schedule of schedules) {
                console.log("schedule: ", schedule);
                const totalContactToProcess = schedule.totalContactToProcess ?? 0;
                const completedPercent = schedule.completedPercent || "0";
                const processedContacts = schedule.processedContacts || 0;
                
                allContactsToProcess += totalContactToProcess;
                allCompletedPercent += parseInt(completedPercent);
                allProcessedContacts += processedContacts;
            };

            const contactsRemaining = allContactsToProcess - allProcessedContacts || 0;
            const completedPercent = allCompletedPercent / schedules.length;

            const stats = await DailyStatsModel.aggregate([
                {
                    $match: {
                        agentId,
                        day: dateToCheck
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCalls: { $sum: "$totalCalls" },
                        totalAppointments: { $sum: "$totalAppointment" }
                    }
                }
            ]);

            const calls = stats[0]?.totalCalls || 0;
            const bookings = stats[0]?.totalAppointments || 0;

            const result = {
                name: tagProcessedFor,
                contacts: allContactsToProcess,
                calls,
                bookings,
                scheduleProgress: Math.ceil(Number(completedPercent)),
                contactsRemaining,
                contactsDone: allProcessedContacts,
            };
 
            return res.status(200).json({
                success: true,
                ...result
            });

        } catch (e) {
            console.error("Error fetching schedule details: " + e);
            next(e);
        };
    };

    async email_reply_webhook(request: AuthRequest, response: Response) {
        try {
            const body = request.body[0];

            console.log("email reply webhook: ", body);

            const clientId = body.clientId;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`;

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };

            const foundClient = clients_data.find((client: ClientObject) => client.id === clientId);

            if (!foundClient) {
                console.error("Could not find client");
            };

            const client_name = foundClient.logo;

            let client;

            if (client_name === "Digital Mavericks Media") {
                const client_details = await userModel.findOne({ name: client_name }).select("-password -passwordHash");

                client = client_details._id;

            } else if (client_name === "Cory Warfield") {
                const client_details = await userModel.findOne({ name: "Cory Lopez-Warfield" }).select("-password -passwordHash");

                client = client_details._id;

            } else {
                const client_details = await userModel.findOne({ name: client_name }).select("-password -passwordHash");

                client = client_details._id;

            };

            const new_reply = await ReplyModel.create({
                client,
                ...body
            });

            if (!new_reply._id) {
                console.error("Error creating new reply");
            };

        } catch (e) {
            console.error("Error receiving email sent webhook: " + e);
        };
    };

    async fetch_replies(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const page = parseInt(req.query.page as string) || 1;
            const campaign_id = req.query.campaignId as string;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { name } = check_user;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            let foundClient;
            let query: { [key: string]: any } = {};

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };
            
            if (name === "Legacy Alliance Club") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Digital Mavericks Media");
            } else {
                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            }

            if (!foundClient) return res.status(400).json({ error: "Client not found in Intuitive Campaigns" });

            const { id } = foundClient;

            const limit = 50;
            const skip = (page - 1) * limit;

            query.client_id = id;
            if (campaign_id) {
                query.campaign_id = campaign_id;
            };

            const totalRecords = await ReplyModel.countDocuments(query);
            const totalPages = Math.ceil(totalRecords / limit);

            if (totalRecords < 1) {
                return res.status(200).json({ result: [] });
            };

            if (page > totalPages) {
                return res.status(400).json({
                    error: "Page exceeds available data"
                });
            };

            const replies = await ReplyModel
                .find(query)
                .sort({ event_timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            return res.status(200).json({
                success: true,
                result: replies,
                page,
                totalPages,
                totalRecords
            });

        } catch (e) {
            console.error("Error fetching replies: " + e);
            next(e);
        };
    };

    async update_agent(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = UpdateAgentIdSchema.validate(body, { abortEarly: false});
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "Client not found"});

            const { agentId, newAgentId } = body;

            const check_agent = await userModel.findOne({ "agents.agentId": agentId });

            if (!check_agent) return res.status(400).json({ message: "AgentId to replace not found" });

            let successUpdates = [];
            let failedUpdates = [];

            const user = await userModel.updateOne(
                { "agents.agentId": agentId },
                { $set: {
                        'agents.$.agentId': newAgentId
                    }
                }
            );
            if (user.acknowledged) {
                successUpdates.push("user");
            } else {
                failedUpdates.push("user");
            };

            const retell = await contactModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (retell.acknowledged) {
                successUpdates.push("contacts");
            } else {
                failedUpdates.push("contacts");
            };

            const transcript = await EventModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (transcript.acknowledged) {
                successUpdates.push("transcripts");
            } else {
                failedUpdates.push("transcripts")
            };

            const job = await jobModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (job.acknowledged) {
                successUpdates.push("job");
            } else {
                failedUpdates.push("job");
            };

            const graph = await dailyGraphModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (graph.acknowledged) {
                successUpdates.push("graph");
            } else {
                failedUpdates.push("graph");
            };

            const daily = await DailyStatsModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (daily.acknowledged) {
                successUpdates.push("daily");
            } else {
                failedUpdates.push("daily");
            };

            const history = await callHistoryModel.updateMany(
                { agentId },
                {
                    $set: {
                        agentId: newAgentId
                    }
                }
            );
            if (history.acknowledged) {
                successUpdates.push("history");
            } else {
                failedUpdates.push("history");
            };

            return res.status(200).json({
                successUpdates,
                failedUpdates
            });

        } catch (e) {
            console.error("Error updating agent" + e);
            next(e);
        };
    };

    async minutes_used(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            // const username = req.query.username as string;
            // const new_password = req.query.new_password as string;

            // console.log("user: ", username);
            // console.log("pass: ", new_password);

            // const new_hash = await argon2.hash(new_password);

            // const update = await userModel.updateOne(
            //     { username },
            //     {
            //         password: new_password,
            //         passwordHash: new_hash
            //     }
            // );

            // console.log("update: ", update);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = toZonedTime(now, timeZone);
            const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

            const monthDates: string[] = [];
            for (let i = 0; i < now.getDate(); i++) {
                const day = subDays(now, i);
                const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                monthDates.unshift(valid_day);
            };

            const { agents } = check_user;

            const agentId = agents[0].agentId;

            const stats = await DailyStatsModel.aggregate([
                {
                    $match: {
                        agentId: agentId,
                        day: {
                            $in: monthDates
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCallDuration: {
                            $sum: "$totalCallDuration"
                        }
                    }
                }
            ]);

            function convertMsToMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                // return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                return `${String(minutes).padStart(2, "0")}`;
            };

            const minutesUsed = convertMsToMinSec(stats[0]?.totalCallDuration || 0);

            return res.status(200).json({
                success: true,
                minutesUsed
            });

        } catch (e) {
            console.error("Error fetching minutes used: " + e);
            next(e);
        };
    };

    async trigger_lead_calls(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { name } = check_user;

            const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`

            const clients = await axios.get(clients_url);
            const clients_data = clients.data;

            let foundClient;

            interface ClientObject {
                id: number,
                name: string,
                email: string,
                uuid: string,
                created_at: string,
                user_id: number,
                logo: string,
                logo_url: any,
                client_permision: object[]
            };
            
            if (name === "Legacy Alliance Club") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Digital Mavericks Media");
            } else if (name === "Cory Lopez-Warfield") {
                foundClient = clients_data.find((client: ClientObject) => client.logo === "Cory Warfield");
            } else {
                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            }

            if (!foundClient) return res.status(400).json({ error: "Client not found in Intuitive Campaigns"});

            const { id } = foundClient;
            console.log("client id: ", id);

            const leads_to_call = await ReplyModel.find({
                client_id: id,
                is_meeting_request: true,
                phone: {
                    $exists: true,
                    $ne: ""
                }
            });

            console.log("leads to call: ", leads_to_call);

            if (leads_to_call.length < 1) return res.status(200).json({ message: "No leads to call" });

            this.call_leads(leads_to_call);

            return res.status(200).json({
                success: true,
                message: "Lead calls triggered"
            });

        } catch (e) {
            console.error("Error triggering lead calls: " + e);
            next(e);
        };
    };

    async call_leads(leads: IReply[]) {
        console.log("inside call leads");
    };

    async sentiment_correction_script(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const body = req.body;

            const { error } = ContactsSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const { contacts } = body;

            for (const contact of contacts) {
                const fetch_contact = await contactModel.findOne({ _id: contact })
                    .populate("referenceToCallId");
                if (!fetch_contact) return res.status(400).json({ message: `contact ${contact} not found`});

                const { referenceToCallId, callId } = fetch_contact;
                const { _id, transcript } = referenceToCallId;

                const review = await reviewTranscript(transcript);
                const sentiment = review.message.content;

                const result = await EventModel.updateOne(
                    { _id },
                    { 
                        userSentiment: sentiment,
                        analyzedTranscript: sentiment
                    }
                );

                await callHistoryModel.updateOne(
                    { callId },
                    {
                        userSentiment: sentiment
                    }
                );

                if (!result.acknowledged) return res.status(400).json({ message: `unable to update sentiment for contact ${contact}`});

            };

            return res.status(200).json({
                success: true,
                message: "sentiments updated for contacts"
            });

        } catch (e) {
            console.error("Error correcting sentiment: " + e);
            next(e);
        };
    };

    async edit_profile(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = EditProfileSchema.validate(body, { abortEarly: false } );
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { username, password, email, group, name, agent } = body;
            let data_to_update = {};

            if (password) {
                const new_hash = await argon2.hash(password);

                data_to_update = {
                    password,
                    passwordHash: new_hash
                };
            };

            if (agent) {
                // const existingAgentIndex = check_user.agents.findIndex((a: any) => a.agentId === agent.agentId);

                // if (existingAgentIndex !== -1) {
                //     check_user.agents[existingAgentIndex] = agent;
                // } else {
                //     check_user.agents.push(agent);
                // }

                data_to_update = {
                    ...data_to_update,
                    "agents.0.agentId": agent
                };
            };

            if (email) {
                const check_email = await userModel.findOne({ email });
                if (check_email) return res.status(400).json({ error: "Email already exists for another user" });

                data_to_update = {
                    ...data_to_update,
                    email
                };
            };

            const fieldsToUpdate = { username, group, name };
            for (const [key, value] of Object.entries(fieldsToUpdate)) {
                if (value !== undefined && value !== null && value !== '') {
                    data_to_update = {
                        ...data_to_update,
                        [key]: value
                    };
                }
            };

            const updatedUser = await userModel.updateOne(
                { _id: clientId },
                { $set: data_to_update }
            );

            if (!updatedUser.acknowledged) {
                return res.status(400).json({ message: "Unable to update profile" });
            };

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully"
            });

        } catch (e) {
            console.error("Error editing profile: " + e);
            next(e);
        };
    };

    async upload_svg(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const file = req.file as Express.Multer.File;

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            if (!file) return res.status(400).json({ error: "No file uploaded" });

            const uploadImageHandler = () => {
                return new Promise((resolve, reject) => {
                    const svgImageResult = cloudinary.v2.uploader.upload_stream(
                        { 
                            resource_type: "raw", 
                            folder: `Profile_Pictures`,     
                        }, 
                        (error, data) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(data);
                                return data; 
                            }
                        });

                    streamifier.createReadStream(file.buffer).pipe(svgImageResult);
                });
            };

            const svgResult = await uploadImageHandler() as any;

            const svgUrl = svgResult.secure_url;

            const update = await userModel.updateOne(
                { _id: clientId },
                {
                    svgUrl: svgUrl
                }
            );

            if (!update.acknowledged) return res.status(400).json({ message: "Unable to upload SVG" });

            return res.status(200).json({
                success: true,
                message: "SVG uploaded successfully",
                svgUrl
            });
            
        } catch (e) {
            console.error("Error uploading SVG: " + e);
            next(e);
        };
    }
};

export const client_service = new ClientService();