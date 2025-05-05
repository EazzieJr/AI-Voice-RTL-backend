import schedule from "node-schedule";
import { userModel } from "../models/userModel";
import callHistoryModel from "../models/historyModel";
import { DailyStatsModel } from "../models/logModel";
import { jobModel } from "../models/contact_model";
import axios from "axios";

export const DailyReport = () => {
    const job = schedule.scheduleJob("10 15 * * *", async () => {
        console.log("Daily report job running at 3:10 PM every day.");

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
}