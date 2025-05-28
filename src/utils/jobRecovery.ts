import { jobModel, contactModel } from "../models/contact_model";
import moment  from "moment-timezone";
import { jobstatus, callstatusenum } from "./types";
import { executeJob } from "./jobExecutor";

export const restartScheduledJobs = async () => {
    try {
        console.log("Restarting scheduled jobs...");
        const now = moment().tz("America/Los_Angeles").format("YYYY-MM-DDTHH:mm:ss");

        console.log("Current time: ", now);

        const pendingJobs = await jobModel.find({
            callstatus: jobstatus.QUEUED,
            shouldContinueProcessing: true,
            scheduledTime: { $gt: now }
        });

        if (!pendingJobs.length) {
            console.log("No pending jobs", pendingJobs);
            return;
        };

        for (const job of pendingJobs) {
            const { agentId, scheduledTime, tagProcessedFor, jobId, limit, fromNumber } = job;

            const contacts = await contactModel.find({
                agentId,
                dial_status: callstatusenum.NOT_CALLED,
                isDeleted: false,
                ...(tagProcessedFor ? { tag: tagProcessedFor }: {}),
                isOnDNCList: false,
                isTaken: true
            })
                .limit(limit)
                .sort({ createdAt: "desc" });

            if (!contacts.length) {
                console.log("No contacts for requeued job; ", jobId);
                continue;
            };

            const scheduledTimePST = moment(scheduledTime)
                .tz("America/Los_Angeles")
                .toDate();

            console.log("Rescheduling job for; ", jobId);

            await executeJob(
                jobId,
                agentId,
                scheduledTimePST,
                limit,
                fromNumber,
                tagProcessedFor
            );

        };

        console.log("All pending jobs have been rescheduled");
    } catch (e) {
        console.error("Error restarting scheduled jobs: ", e);
    };
    
};