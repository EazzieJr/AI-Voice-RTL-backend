import Retell from "retell-sdk";
import { v4 as uuidv4 } from "uuid";
import { DailyStatsModel } from "../models/logModel";
import { contactModel, jobModel } from "../models/contact_model";
import { callstatusenum, jobstatus } from "./types";
import schedule from "node-schedule";
import moment from "moment-timezone";
import { formatPhoneNumber } from "./formatter";
import { Response, NextFunction } from "express";

const retell_client = new Retell({
    apiKey: process.env.RETELL_API_KEY
});

export const scheduleCronJob = async (
    scheduledTimePST: Date,
    agentId: string,
    limit: number,
    fromNumber: string,
    formattedDate: string,
    lowerCaseTag: string,
    res: Response,
    next: NextFunction
) => {

    try {
        const jobId = uuidv4();
        console.log("jobId: ", jobId);
        const todayString = new Date().toISOString().split("T")[0];

        const CUTOFF_HOUR = 15;
        const CUTOFF_MINUTE = 30;

        const existingJob = await jobModel.findOne({
            agentId,
            scheduledTime: formattedDate,
            callstatus: { $in: [jobstatus.ON_CALL, jobstatus.QUEUED]},
            shouldContinueProcessing: true
        });

        if (existingJob) {
            console.log(`job running for ${agentId} and tag ${lowerCaseTag}`);
            // return { message: "job already running", jobId: existingJob.jobId };
            return res.status(200).json({
                message: "Job already running",
                jobId: existingJob.jobId
            });
        };

        const newJob = await jobModel.create({
            jobId,
            agentId,
            callstatus: jobstatus.QUEUED,
            scheduledTime: formattedDate,
            shouldContinueProcessing: true,
            tagProcessedFor: lowerCaseTag
        });

        if (!newJob._id) {
            // return next(new Error("Unable to create new Job model"));
            return res.status(500).json({ message: "Unable to create new Job model" });
        };
        await DailyStatsModel.create({
            day: todayString,
            agentId,
            jobProcessedBy: jobId
        });

        const contacts = await contactModel
            .find({
                agentId,
                dial_status: callstatusenum.NOT_CALLED,
                isDeleted: false,
                ...(lowerCaseTag ? { tag: lowerCaseTag } : {}),
                isOnDNCList: false,
                isTaken: false
            })
            .limit(limit)
            .sort({ createdAt: "desc" });
        
        console.log("contacts: ", contacts);
        if (!contacts?.length) return res.status(400).json({ message: "No contacts found" }) /** return next(new Error("No contacts found")); **/
        
        const contactIds = contacts.map(contact => contact._id);
        console.log("contIds: ", contactIds);

        const contact_update = await contactModel.updateMany(
            { _id: { $in: contactIds } },
            { $set: { isTaken: true } }
        );

        if (!(contact_update.acknowledged && contact_update.modifiedCount > 0)) return res.status(500).json({ message: "Schedule: No contacts got updated from isTaken to false" });
         /**return next(new Error("Schedule: No contacts got updated from isTaken(false")); **/

        const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
            try {
                const update_job_status = await jobModel.updateOne(
                    { jobId },
                    { callstatus: jobstatus.ON_CALL }
                );
                if (!(update_job_status.acknowledged && update_job_status.modifiedCount === 1)) return res.status(400).json({ message: "Error updating job status to on call" }) /**{ message: "Error updating job status" }; **/

                const contacts_count = await contactModel
                    .countDocuments({
                        agentId,
                        dial_status: callstatusenum.NOT_CALLED,
                        isDeleted: false,
                        ...(lowerCaseTag ? { tag: lowerCaseTag } : {}),
                        isOnDNCList: false,
                        isTaken: true
                    });
                console.log("Total contacts found: ", contacts_count);

                const update_contacts_to_process = await jobModel.updateOne(
                    { jobId },
                    { totalContactToProcess: contacts_count }
                );

                if (!(update_contacts_to_process.acknowledged && update_contacts_to_process.modifiedCount === 1)) return res.status(400).json({ message: "Error updating contacts to process" }); /**next(new Error("Error updating contacts to process")); **/

                for (const contact of contacts) {
                    const currentJob = await jobModel.findOne({ jobId });
                    const now = moment().tz("America/Los_Angeles");

                    if (!currentJob) return res.status(500).json({ message: "JobId ${jobId} was not found in the database" }); /** next(new Error(`JobId ${jobId} was not found in the database`)); **/

                    if (currentJob.shouldContinueProcessing === false) {

                        const set_isTaken_toFalse = await contactModel.updateMany(
                            { _id: { $in: contactIds } },
                            { $set: { isTaken: false } }
                        );

                        console.log("isTaken: ", set_isTaken_toFalse);

                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0) ) return res.status(400).json({ message: "Schedule: No contacts got updated from isTaken back to true" }); /**next(new Error("Schedule: No contacts got updated from isTaken back to true")); **/

                        return res.status(500).json({ message: `shouldContinueProcessing for jobId: ${jobId} has been set to false`}); /**next(new Error(`shouldContinueProcessing for jobId: ${jobId} has been set to false`));**/
                    };

                    if (
                        now.hour() > CUTOFF_HOUR ||
                        (now.hour() === CUTOFF_HOUR && now.minute() >= CUTOFF_MINUTE)
                    ) {
                        console.log("Job stopped due to time cut off");

                        const cancel_job_status = await jobModel.updateOne(
                            { jobId },
                            { callstatus: "cancelled", shouldContinueProcessing: false }
                        );

                        console.log("status: ", cancel_job_status);

                        if (!(cancel_job_status.acknowledged && cancel_job_status.modifiedCount === 1)) return res.status(500).json({ message: "Error updating job status to cancelled"}) /**next(new Error("Error updating job status to cancelled")); **/

                        const set_isTaken_toFalse = await contactModel.updateMany(
                            { _id: { $in: contactIds } },
                            { $set: { isTaken: false } }
                        );

                        console.log("isTaken: ", set_isTaken_toFalse);

                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0) ) return res.status(400).json({ message: "Schedule: No contacts got updated from isTaken back to true" });
                    };

                    try {
                        const post_data = {
                            fromNumber,
                            toNumber: contact.phone,
                            userId: contact._id.toString(),
                            agentId
                        };

                        const registerCall = await retell_client.call.registerPhoneCall({
                            agent_id: agentId,
                            from_number: fromNumber,
                            to_number: formatPhoneNumber(post_data.toNumber),
                            retell_llm_dynamic_variables: {
                                user_firstname: contact.firstname,
                                user_email: contact.email,
                                user_lastname: contact.lastname,
                                job_id: jobId,
                                user_address: contact.address
                            }
                        });

                        console.log("Register call: ", registerCall);

                        const create_call = await retell_client.call.createPhoneCall({
                            from_number: fromNumber,
                            to_number: formatPhoneNumber(post_data.toNumber),
                            override_agent_id: agentId,
                            retell_llm_dynamic_variables: {
                                user_firstname: contact.firstname,
                                user_email: contact.email,
                                user_lastname: contact.lastname,
                                job_id: jobId,
                                user_address: contact.address
                            }
                        });
                        console.log("new call: ", create_call);

                        const { call_id } = create_call;

                        const update_callId = await contactModel.updateOne(
                            { _id: contact._id},
                            {
                                callId: call_id,
                                $push: {
                                    jobProcessedWithId: jobId
                                },
                                isusercalled: true
                            }
                        );

                        if (!(update_callId.acknowledged && update_callId.modifiedCount === 1) ) return res.status(400).json({ message: "Unable to update callId in contact model" }) /** next(new Error("Unable to update callId in contact model")); **/

                        const updated_proc_contacts = currentJob.processedContacts + 1;
                        const currentPercentage = (updated_proc_contacts / contacts_count) * 100;

                        console.log("updat: ", updated_proc_contacts);
                        console.log("percent: ", currentPercentage);

                        const update_job_processed_contacts = await jobModel.updateOne(
                            { jobId },
                            {
                                processedContacts: updated_proc_contacts,
                                completedPercent: currentPercentage
                            }
                        );

                        if (!(update_job_processed_contacts.acknowledged && update_job_processed_contacts.modifiedCount === 1) ) return res.status(400).json({ message: "Unable to update processed contacts in job model"}) /** next(new Error("Unable to update processed contacts in job model")); **/

                        console.log(`Call successful for ${contact.firstname}`);

                    } catch (e) {
                        console.error("Error creating phone call: ", e);
                        // return res.status(500).json({
                        //     error: e,
                        //     message: "Error creating phone call"
                        // });
                    };

                    await new Promise((resolve) => setTimeout(resolve, 3000));
                };

                const update_status_to_called = await jobModel.updateOne(
                    { jobId },
                    {
                        callstatus: jobstatus.CALLED,
                        shouldContinueProcessing: false
                    }
                );

                if (!(update_status_to_called.acknowledged && update_status_to_called.modifiedCount === 1) ) return res.status(400).json({ message: "Unable to update call status to called"}) /** next(new Error("Unable to update call status to called")); **/

            } catch (e) {
                console.error(`Error creating schedule for jobId: ${jobId} `, e);
                // return res.status(500).json({
                //     error: e,
                //     message: `Error creating schedule for JobId: ${jobId}`
                // });
            };
        });

        // console.log(`Job: ${jobId} successful, Next scheduled run: ${job.nextInvocation()}`);

        return { jobId, scheduleTine: scheduledTimePST, contacts };

    } catch (e) {
        console.error("Error scheduling cron job: ", e);
        return res.status(500).json({
            error: e,
            message: "Error scheduling cron job"
        });
    };
};