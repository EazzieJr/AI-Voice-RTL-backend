import schedule from "node-schedule";
import { userModel } from "../models/userModel";
import callHistoryModel from "../models/historyModel";
import { DailyStatsModel } from "../models/logModel";
import { jobModel } from "../models/contact_model";
import axios from "axios";
import { ReplyModel } from "../models/emailReply";

export const DailyReport = () => {
    const job = schedule.scheduleJob("11 6 * * *", async () => {
        console.log("Daily report job running at 4:00 AM every day.");

        try {
            const users = await userModel.find({ "agents.agentId": { $exists: true, $ne: null } }).select("name group agents").lean();

            for (const user of users) {
                const date = new Date().toISOString().split("T")[0];
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

                foundClient = clients_data.find((client: ClientObject) => client.logo === name);
            
                if (!foundClient) {
                    console.log("Client not found for logo: ", name);
                    continue;
                };

                const { id } = foundClient;
    
                const url = `${process.env.SMART_LEAD_URL}/campaigns?api_key=${process.env.SMART_LEAD_API_KEY}`;
    
                const campaign = await axios.get(url);
                const all_campaigns = campaign.data;
        
                const client_campaigns = all_campaigns.filter((campaign: any) => campaign.client_id === id && campaign.status === "ACTIVE");

                console.log("client_campaigns: ", client_campaigns);
                const activeCampaigns = client_campaigns.length;

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

                const totalAnalytics = campaignAnalytics.reduce((totals, analytics) => {
                    const { sent_count, bounce_count, reply_count } = analytics;
                    totals.sentCount += Number(sent_count || 0);
                    totals.bounceCount += Number(bounce_count || 0);
                    totals.replyCount += Number(reply_count || 0);
                    return totals;
                }, { sentCount: 0, openCount: 0, replyCount: 0, bounceCount: 0 });

                const positiveReplies = await ReplyModel.countDocuments({
                    time_replied: date,
                    reply_category: {
                        $in: [1, 2]
                    }
                });

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
                            activeCampaigns,
                            sent: totalAnalytics.sentCount,
                            replied: totalAnalytics.replyCount,
                            positiveReplies,
                            bounced: totalAnalytics.bounceCount,
                        }
                    }

                };

                console.log("body_to_send: ", body_to_send);

                // const response = await axios.post(`https://hook.us1.make.com/5nugogfgy1js6obkqqdd7tn3spz075nh`, body_to_send);

                // const result = response.data;

                // console.log("Make response: ", result);
                console.log("Daily report done for: ", group);
            };
        } catch (e) {
            console.error("Error in daily report job:", e);
        };
    });
}