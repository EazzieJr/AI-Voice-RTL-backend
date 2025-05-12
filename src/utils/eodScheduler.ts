import schedule from "node-schedule";
import { userModel } from "../models/userModel";
import callHistoryModel from "../models/historyModel";
import { DailyStatsModel } from "../models/logModel";
import { jobModel } from "../models/contact_model";
import axios from "axios";
import { ReplyModel } from "../models/emailReply";

export const DailyReport = () => {
    const job = schedule.scheduleJob("0 15 * * *", async () => {
        console.log("Daily report job running at 3:00 PM every day.");

        try {
            const users = await userModel.find({ "agents.agentId": { $exists: true, $ne: null } }).select("name group agents").lean();

            const date = new Date().toISOString().split("T")[0];
            // const _date = new Date();
            // _date.setDate(_date.getDate() - 1);
            // const date = _date.toISOString().split("T")[0];

            console.log("Date: ", date)

            const usersToCheck = [];
            for (const user of users) {
                const check_job = await jobModel.findOne({ agentId: user.agents[0].agentId, scheduledTime: {
                    $gte: `${date}T00:00:00+00:00`,
                    $lte: `${date}T23:59:59+00:00`
                } }).lean();

                if (!check_job) {
                    console.log("No job found for agentId: ", user.agents[0].agentId);
                } else {
                    usersToCheck.push(user);
                }
            };

            console.log("Users to check: ", usersToCheck);

            for (const user of usersToCheck) {
                const { name, group, agents } = user;
                const agentId = agents[0].agentId; 
                let email;

                if (group === "ARS") {
                    email = "ars@tvagai.com";
                } else if (group === "DME") {
                    email = "dme@tvagai.com";
                } else if (group === "ESG") {
                    email = "esg@tvagai.com";
                } else if (group === "KSA") {
                    email = "ksa@tvagai.com";
                } else if (group === "NFS") {
                    email = "nfs@tvagai.com";
                } else if (group === "CWS") {
                    email = "cws@tvagai.com";
                } else if (group === "RWY") {
                    email = "runway@tvagai.com";
                } else if (group === "CPA") {
                    email = "clearpath@tvagai.com";
                } else {
                    email: user.email;
                };

                // Fetching Voice Data
                const stats = await DailyStatsModel.aggregate([
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

                const outbound = stats[0]?.outbound || 0;
                const liveAnswers = stats[0]?.liveAnswers || 0;
                const transfers = stats[0]?.transfers || 0;

                function convertMsToMinSec(ms: number): string {
                    const totalSeconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
    
                    return `${String(minutes).padStart(2, "0")}`;
                };
    
                const minutesUsed = convertMsToMinSec(stats[0]?.totalDuration || 0);
    
                let scheduleTime;
                let listsCalled = [];
                const jobIds = stats[0]?.jobIds || [];

                for (const jobId of jobIds) {
                    const job_deets = await jobModel.findOne({ jobId }).lean();
                    if (job_deets) {
                        const { scheduledTime, tagProcessedFor } = job_deets;
                        scheduleTime = scheduledTime;
                        listsCalled.push(tagProcessedFor);
                    };
                    
                };

                const reasons = ["voicemail_reached", "machine_detected"]

                const positive = await callHistoryModel.countDocuments({ agentId, date, userSentiment: "positive"});
                const negative = await callHistoryModel.countDocuments({ agentId, date, userSentiment: "negative"});
                const neutral = await callHistoryModel.countDocuments({ agentId, date, userSentiment: "neutral"});
                const automatedAnswers = await callHistoryModel.countDocuments({ 
                    agentId, 
                    date, 
                    disconnectionReason: {
                        $in: reasons
                    }
                });
                const appointments = await callHistoryModel.countDocuments({ agentId, date, dial_status: "appt-scheduled" });

                // Fetching Email Data
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

                let activeCampaigns;
                let totalAnalytics: any;
                let positiveReplies

                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            
                if (!foundClient) {
                    console.log("Client not found for logo: ", name);
                } else {
                    const { id } = foundClient;
    
                    const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;
        
                    const campaign = await axios.get(url);
                    const all_campaigns = campaign.data;
            
                    const client_campaigns = all_campaigns.filter((campaign: any) => campaign.client_id === id && campaign.status === "ACTIVE");

                    console.log("client_campaigns: ", client_campaigns);
                    activeCampaigns = client_campaigns.length;

                    const campaignIds = client_campaigns.map((campaign: any) => campaign.id);

                    interface CampaignAnalytics {
                        id: number,
                        user_id: number,
                        created_at: string,
                        status: string,
                        name: string,
                        start_date: string,
                        end_date: string,
                        sent_count: string,
                        unique_sent_count: string,
                        open_count: string,
                        unique_open_count: string,
                        click_count: string,
                        unique_click_count: string,
                        reply_count: string,
                        block_count: string,
                        total_count: string,
                        drafted_count: string,
                        bounce_count: string,
                        unsubscribed_count: string
                    };
    
                    let campaignAnalytics: CampaignAnalytics[] = [];
                    for (const campaignId of campaignIds) {
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${date}&end_date=${date}`;
    
                        const analytics = await axios.get(url);
                        const campaign_analytics = analytics.data;
    
                        campaignAnalytics.push(campaign_analytics);
    
                    };
    
                    totalAnalytics = campaignAnalytics.reduce((totals, analytics) => {
                        const { sent_count, bounce_count, reply_count } = analytics;
                        totals.sentCount += Number(sent_count || 0);
                        totals.bounceCount += Number(bounce_count || 0);
                        totals.replyCount += Number(reply_count || 0);
                        return totals;
                    }, { sentCount: 0, openCount: 0, replyCount: 0, bounceCount: 0 });
    
                    positiveReplies = await ReplyModel.countDocuments({
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
                            sent: totalAnalytics?.sentCount || 0,
                            replied: totalAnalytics?.replyCount || 0,
                            positiveReplies: positiveReplies || 0,
                            bounced: totalAnalytics?.bounceCount || 0,
                        }
                    }

                };

                console.log("body_to_send: ", body_to_send);

                const response = await axios.post(`https://hook.us1.make.com/5nugogfgy1js6obkqqdd7tn3spz075nh`, body_to_send);

                const result = response.data;

                console.log("Make response: ", result);
                console.log("Daily report done for: ", group);
            };
        } catch (e) {
            console.error("Error in daily report job:", e);
        };
    });
};

export const WeeklyReport = () => {
    const job = schedule.scheduleJob("00 15 * * 5", async () => {
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
            const users = await userModel.find({ "agents.agentId": { $exists: true, $ne: null } }).select("name group agents email").lean();

            const usersToCheck = [];
            for (const user of users) {
                const check_job = await jobModel.findOne({ agentId: user.agents[0].agentId, scheduledTime: {
                    $gte: `${dates[0]}T00:00:00+00:00`,
                    $lte: `${dates[4]}T23:59:59+00:00`
                } }).lean();

                if (!check_job) {
                    console.log("No job found for agentId: ", user.agents[0].agentId);
                } else {
                    usersToCheck.push(user);
                };
            };
            console.log("Users to check: ", usersToCheck);

            for (const user of usersToCheck) {
                const { name, group, agents } = user;
                const agentId = agents[0].agentId; 
                let email;

                if (group === "ARS") {
                    email = "ars@tvagai.com";
                } else if (group === "DME") {
                    email = "dme@tvagai.com";
                } else if (group === "ESG") {
                    email = "esg@tvagai.com";
                } else if (group === "KSA") {
                    email = "ksa@tvagai.com";
                } else if (group === "NFS") {
                    email = "nfs@tvagai.com";
                } else if (group === "CWS") {
                    email = "cws@tvagai.com";
                } else if (group === "RWY") {
                    email = "runway@tvagai.com";
                } else if (group === "CPA") {
                    email = "clearpath@tvagai.com";
                } else {
                    console.log("email is heere: ", user.email);
                    email: user.email;
                };

                // Fetching Voice Data
                const stats = await DailyStatsModel.aggregate([
                    {
                        $match: {
                            agentId,
                            day: { $in: dates }
                        }
                    },
                    {
                        $group:{
                            _id: null,
                            outbound: { $sum: "$totalCalls" },
                            liveAnswers: { $sum: "$totalCallAnswered" },
                            transfers: { $sum: "$totalTransffered" },
                            jobIds: { $push: "$jobProcessedBy" },
                            totalDuration: { $sum: "$totalCallDuration" }
                        }
                    }
                ]);

                const outbound = stats[0]?.outbound || 0;
                const liveAnswers = stats[0]?.liveAnswers || 0;
                const transfers = stats[0]?.transfers || 0;

                function convertMsToMinSec(ms: number): string {
                    const totalSeconds = Math.floor(ms / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
    
                    return `${String(minutes).padStart(2, "0")}`;
                };
    
                const minutesUsed = convertMsToMinSec(stats[0]?.totalDuration || 0);

                let scheduleTime;
                let listsCalled = [];
                const jobIds = stats[0]?.jobIds || [];

                for (const jobId of jobIds) {
                    const job_deets = await jobModel.findOne({ jobId }).lean();
                    if (job_deets) {
                        const { scheduledTime, tagProcessedFor } = job_deets;
                        scheduleTime = scheduledTime;
                        listsCalled.push(tagProcessedFor);
                    };
                    
                };

                const reasons = ["voicemail_reached", "machine_detected"]

                const positive = await callHistoryModel.countDocuments({ agentId, date: { $in: dates }, userSentiment: "positive"});
                const negative = await callHistoryModel.countDocuments({ agentId, date: { $in: dates }, userSentiment: "negative"});
                const neutral = await callHistoryModel.countDocuments({ agentId, date: { $in: dates }, userSentiment: "neutral"});
                const automatedAnswers = await callHistoryModel.countDocuments({ 
                    agentId, 
                    date: { $in: dates }, 
                    disconnectionReason: {
                        $in: reasons
                    }
                });
                const appointments = await callHistoryModel.countDocuments({ agentId, date: { $in: dates }, dial_status: "appt-scheduled" });

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
                        }
                    }
                }


                console.log("body: ", body_to_send);
            }
        } catch (e) {
            console.error("Error in weekly report job:", e);
        };
    });
};