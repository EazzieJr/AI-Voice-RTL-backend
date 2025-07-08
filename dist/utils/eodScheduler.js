"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyReport = exports.DailyReport = void 0;
const node_schedule_1 = __importDefault(require("node-schedule"));
const userModel_1 = require("../models/userModel");
const historyModel_1 = __importDefault(require("../models/historyModel"));
const logModel_1 = require("../models/logModel");
const contact_model_1 = require("../models/contact_model");
const axios_1 = __importDefault(require("axios"));
const emailReply_1 = require("../models/emailReply");
const DailyReport = () => {
    const job = node_schedule_1.default.scheduleJob("0 15 * * *", async () => {
        var _a, _b, _c, _d, _e;
        console.log("Daily report job running at 3:00 PM every day.");
        try {
            const users = await userModel_1.userModel.find({ "agents.agentId": { $exists: true, $ne: null } }).select("name group agents").lean();
            const date = new Date().toISOString().split("T")[0];
            // const _date = new Date();
            // _date.setDate(_date.getDate() - 1);
            // const date = _date.toISOString().split("T")[0];
            console.log("Date: ", date);
            const usersToCheck = [];
            for (const user of users) {
                const check_job = await contact_model_1.jobModel.findOne({ agentId: user.agents[0].agentId, scheduledTime: {
                        $gte: `${date}T00:00:00+00:00`,
                        $lte: `${date}T23:59:59+00:00`
                    } }).lean();
                if (!check_job) {
                    console.log("No job found for agentId: ", user.agents[0].agentId);
                }
                else {
                    usersToCheck.push(user);
                }
            }
            ;
            console.log("Users to check: ", usersToCheck);
            for (const user of usersToCheck) {
                const { name, group, agents } = user;
                const agentId = agents[0].agentId;
                let email;
                if (group === "ARS") {
                    email = "ars@tvagai.com";
                }
                else if (group === "DME") {
                    email = "dme@tvagai.com";
                }
                else if (group === "ESG") {
                    email = "esg@tvagai.com";
                }
                else if (group === "KSA") {
                    email = "ksa@tvagai.com";
                }
                else if (group === "NFS") {
                    email = "nfs@tvagai.com";
                }
                else if (group === "CWS") {
                    email = "cws@tvagai.com";
                }
                else if (group === "RWY") {
                    email = "runway@tvagai.com";
                }
                else if (group === "CPA") {
                    email = "clearpath@tvagai.com";
                }
                else {
                    email: user.email;
                }
                ;
                // Fetching Voice Data
                const stats = await logModel_1.DailyStatsModel.aggregate([
                    {
                        $match: {
                            agentId,
                            day: date
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            outbound: { $sum: "$totalCalls" },
                            liveAnswers: { $sum: "$totalCallAnswered" },
                            transfers: { $sum: "$totalTransffered" },
                            jobIds: { $push: "$jobProcessedBy" },
                            totalDuration: { $sum: "$totalCallDuration" }
                        }
                    }
                ]);
                const outbound = ((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.outbound) || 0;
                const liveAnswers = ((_b = stats[0]) === null || _b === void 0 ? void 0 : _b.liveAnswers) || 0;
                const transfers = ((_c = stats[0]) === null || _c === void 0 ? void 0 : _c.transfers) || 0;
                function convertMsToMinSec(ms) {
                    const totalSeconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    return `${String(minutes).padStart(2, "0")}`;
                }
                ;
                const minutesUsed = convertMsToMinSec(((_d = stats[0]) === null || _d === void 0 ? void 0 : _d.totalDuration) || 0);
                let scheduleTime;
                let listsCalled = [];
                const jobIds = ((_e = stats[0]) === null || _e === void 0 ? void 0 : _e.jobIds) || [];
                for (const jobId of jobIds) {
                    const job_deets = await contact_model_1.jobModel.findOne({ jobId }).lean();
                    if (job_deets) {
                        const { scheduledTime, tagProcessedFor } = job_deets;
                        scheduleTime = scheduledTime;
                        listsCalled.push(tagProcessedFor);
                    }
                    ;
                }
                ;
                const reasons = ["voicemail_reached", "machine_detected"];
                const positive = await historyModel_1.default.countDocuments({ agentId, date, userSentiment: "positive" });
                const negative = await historyModel_1.default.countDocuments({ agentId, date, userSentiment: "negative" });
                const neutral = await historyModel_1.default.countDocuments({ agentId, date, userSentiment: "neutral" });
                const automatedAnswers = await historyModel_1.default.countDocuments({
                    agentId,
                    date,
                    disconnectionReason: {
                        $in: reasons
                    }
                });
                const appointments = await historyModel_1.default.countDocuments({ agentId, date, dial_status: "appt-scheduled" });
                // Fetching Email Data
                const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`;
                const clients = await axios_1.default.get(clients_url);
                const clients_data = clients.data;
                let foundClient;
                ;
                let activeCampaigns;
                let totalAnalytics;
                let positiveReplies;
                foundClient = clients_data.find((client) => client.logo === name);
                if (!foundClient) {
                    console.log("Client not found for logo: ", name);
                }
                else {
                    const { id } = foundClient;
                    const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;
                    const campaign = await axios_1.default.get(url);
                    const all_campaigns = campaign.data;
                    const client_campaigns = all_campaigns.filter((campaign) => campaign.client_id === id && campaign.status === "ACTIVE");
                    console.log("client_campaigns: ", client_campaigns);
                    activeCampaigns = client_campaigns.length;
                    const campaignIds = client_campaigns.map((campaign) => campaign.id);
                    ;
                    let campaignAnalytics = [];
                    for (const campaignId of campaignIds) {
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${date}&end_date=${date}`;
                        const analytics = await axios_1.default.get(url);
                        const campaign_analytics = analytics.data;
                        campaignAnalytics.push(campaign_analytics);
                    }
                    ;
                    totalAnalytics = campaignAnalytics.reduce((totals, analytics) => {
                        const { sent_count, bounce_count, reply_count } = analytics;
                        totals.sentCount += Number(sent_count || 0);
                        totals.bounceCount += Number(bounce_count || 0);
                        totals.replyCount += Number(reply_count || 0);
                        return totals;
                    }, { sentCount: 0, openCount: 0, replyCount: 0, bounceCount: 0 });
                    positiveReplies = await emailReply_1.ReplyModel.countDocuments({
                        time_replied: {
                            $gte: `${date}T00:00:00+00:00`,
                            $lte: `${date}T23:59:59+00:00`
                        },
                        reply_category: {
                            $in: [1, 2]
                        }
                    });
                }
                const body_to_send = {
                    name,
                    email,
                    group,
                    date,
                    eodReport: {
                        voice: {
                            outbound,
                            liveAnswers,
                            automatedAnswers,
                            transfers,
                            appointments,
                            positive,
                            negative,
                            neutral,
                            minutesUsed,
                            listsCalled,
                            scheduledTime: scheduleTime
                        },
                        email: {
                            activeCampaigns: activeCampaigns || 0,
                            sent: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.sentCount) || 0,
                            replied: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.replyCount) || 0,
                            positiveReplies: positiveReplies || 0,
                            bounced: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.bounceCount) || 0,
                        }
                    }
                };
                console.log("body_to_send: ", body_to_send);
                const response = await axios_1.default.post(`https://hook.us1.make.com/5nugogfgy1js6obkqqdd7tn3spz075nh`, body_to_send);
                const result = response.data;
                console.log("Make response: ", result);
                console.log("Daily report done for: ", group);
            }
            ;
        }
        catch (e) {
            console.error("Error in daily report job:", e);
        }
        ;
    });
};
exports.DailyReport = DailyReport;
const WeeklyReport = () => {
    const job = node_schedule_1.default.scheduleJob("00 15 * * 5", async () => {
        var _a, _b, _c, _d, _e;
        console.log("Weekly report job running at 5:00 PM every Friday.");
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.unshift(date.toISOString().split("T")[0]);
        }
        console.log("Last 5 days (Monday through Friday):", dates);
        try {
            const users = await userModel_1.userModel.find({ "agents.agentId": { $exists: true, $ne: null } }).select("name group agents email").lean();
            const usersToCheck = [];
            for (const user of users) {
                const check_job = await contact_model_1.jobModel.findOne({ agentId: user.agents[0].agentId, scheduledTime: {
                        $gte: `${dates[0]}T00:00:00+00:00`,
                        $lte: `${dates[4]}T23:59:59+00:00`
                    } }).lean();
                if (!check_job) {
                    console.log("No job found for agentId: ", user.agents[0].agentId);
                }
                else {
                    usersToCheck.push(user);
                }
                ;
            }
            ;
            console.log("Users to check: ", usersToCheck);
            for (const user of usersToCheck) {
                const { name, group, agents, autoEmail } = user;
                const agentId = agents[0].agentId;
                const email = autoEmail || user.email;
                // Fetching Voice Data
                const stats = await logModel_1.DailyStatsModel.aggregate([
                    {
                        $match: {
                            agentId,
                            day: { $in: dates }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            outbound: { $sum: "$totalCalls" },
                            liveAnswers: { $sum: "$totalCallAnswered" },
                            transfers: { $sum: "$totalTransffered" },
                            jobIds: { $push: "$jobProcessedBy" },
                            totalDuration: { $sum: "$totalCallDuration" }
                        }
                    }
                ]);
                const outbound = ((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.outbound) || 0;
                const liveAnswers = ((_b = stats[0]) === null || _b === void 0 ? void 0 : _b.liveAnswers) || 0;
                const transfers = ((_c = stats[0]) === null || _c === void 0 ? void 0 : _c.transfers) || 0;
                function convertMsToMinSec(ms) {
                    const totalSeconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    return `${String(minutes).padStart(2, "0")}`;
                }
                ;
                const minutesUsed = convertMsToMinSec(((_d = stats[0]) === null || _d === void 0 ? void 0 : _d.totalDuration) || 0);
                let scheduleTime;
                let listsCalled = [];
                const jobIds = ((_e = stats[0]) === null || _e === void 0 ? void 0 : _e.jobIds) || [];
                for (const jobId of jobIds) {
                    const job_deets = await contact_model_1.jobModel.findOne({ jobId }).lean();
                    if (job_deets) {
                        const { scheduledTime, tagProcessedFor } = job_deets;
                        scheduleTime = scheduledTime;
                        listsCalled.push(tagProcessedFor);
                    }
                    ;
                }
                ;
                const reasons = ["voicemail_reached", "machine_detected"];
                const positive = await historyModel_1.default.countDocuments({ agentId, date: { $in: dates }, userSentiment: "positive" });
                const negative = await historyModel_1.default.countDocuments({ agentId, date: { $in: dates }, userSentiment: "negative" });
                const neutral = await historyModel_1.default.countDocuments({ agentId, date: { $in: dates }, userSentiment: "neutral" });
                const automatedAnswers = await historyModel_1.default.countDocuments({
                    agentId,
                    date: { $in: dates },
                    disconnectionReason: {
                        $in: reasons
                    }
                });
                const appointments = await historyModel_1.default.countDocuments({ agentId, date: { $in: dates }, dial_status: "appt-scheduled" });
                // Fetching Email Data
                const clients_url = `${process.env.SMART_LEAD_URL}/client/?api_key=${process.env.SMART_LEAD_API_KEY}`;
                const clients = await axios_1.default.get(clients_url);
                const clients_data = clients.data;
                let foundClient;
                ;
                let activeCampaigns;
                let totalAnalytics;
                foundClient = clients_data.find((client) => client.logo === name);
                if (!foundClient) {
                    console.log("Client not found for logo: ", name);
                }
                else {
                    const { id } = foundClient;
                    const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;
                    const campaign = await axios_1.default.get(url);
                    const all_campaigns = campaign.data;
                    const client_campaigns = all_campaigns.filter((campaign) => campaign.client_id === id && campaign.status === "ACTIVE");
                    console.log("client_campaigns: ", client_campaigns);
                    activeCampaigns = client_campaigns.length;
                    const campaignIds = client_campaigns.map((campaign) => campaign.id);
                    ;
                    let campaignAnalytics = [];
                    for (const campaignId of campaignIds) {
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${dates[0]}&end_date=${dates[4]}`;
                        const analytics = await axios_1.default.get(url);
                        const campaign_analytics = analytics.data;
                        campaignAnalytics.push(campaign_analytics);
                    }
                    ;
                    totalAnalytics = campaignAnalytics.reduce((totals, analytics) => {
                        const { sent_count, bounce_count, reply_count, positive_reply_count } = analytics;
                        totals.sentCount += Number(sent_count || 0);
                        totals.bounceCount += Number(bounce_count || 0);
                        totals.replyCount += Number(reply_count || 0);
                        totals.positiveReplyCount += Number(positive_reply_count || 0);
                        return totals;
                    }, { sentCount: 0, openCount: 0, replyCount: 0, bounceCount: 0, positiveReplyCount: 0 });
                }
                ;
                const body_to_send = {
                    name,
                    email,
                    group,
                    dates,
                    eowReport: {
                        voice: {
                            outbound,
                            liveAnswers,
                            automatedAnswers,
                            transfers,
                            appointments,
                            positive,
                            negative,
                            neutral,
                            minutesUsed,
                            listsCalled,
                            scheduledTime: scheduleTime
                        },
                        email: {
                            activeCampaigns: activeCampaigns || 0,
                            sent: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.sentCount) || 0,
                            replied: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.replyCount) || 0,
                            positiveReplies: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.positiveReplyCount) || 0,
                            bounced: (totalAnalytics === null || totalAnalytics === void 0 ? void 0 : totalAnalytics.bounceCount) || 0,
                        }
                    }
                };
                console.log("body: ", body_to_send);
            }
        }
        catch (e) {
            console.error("Error in weekly report job:", e);
        }
        ;
    });
};
exports.WeeklyReport = WeeklyReport;
