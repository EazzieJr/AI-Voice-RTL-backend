import schedule from "node-schedule";
import { jobModel, contactModel } from "../models/contact_model";
import { scheduleCronJob } from "./scheduleJob";
import moment  from "moment-timezone";
import { jobstatus, callstatusenum } from "./types";
import { Response } from "express";
import { IContact } from "./types";
import Retell from "retell-sdk";
import { formatPhoneNumber } from "./formatter";

const retell_client = new Retell({
    apiKey: process.env.RETELL_API_KEY
});

export const executeJob = async (
    jobId: string,
    agentId: string,
    scheduledTimePST: Date,
    limit: number,
    contacts: IContact[],
    fromNumber: string,
    tagProcessedFor: string,
    res: Response
) => {
    try {
        const CUTOFF_HOUR = 15;
        const CUTOFF_MINUTE = 30;

        const update_job_status = await jobModel.updateOne(
            { jobId },
            { callstatus: jobstatus.ON_CALL }
        );

        if (!(update_job_status.acknowledged && update_job_status.modifiedCount === 1)) return res.status(400).json({ message: "Error updating job status to on call" });

        const contacts_count = await contactModel
            .countDocuments({
                agentId,
                dial_status: callstatusenum.NOT_CALLED,
                isDeleted: false,
                ...(tagProcessedFor ? { tag: tagProcessedFor } : {}),
                isOnDNCList: false,
                isTaken: true
            }).limit(limit);
        console.log("Total contacts to process: ", contacts_count);

        const update_contacts_to_process = await jobModel.updateOne(
            { jobId },
            { totalContactToProcess: contacts_count }
        );

        if (!(update_contacts_to_process.acknowledged && update_contacts_to_process.modifiedCount === 1)) return res.status(400).json({ message: "Error updating contacts to process" });

        const contactIds = contacts.map((contact) => contact._id);

        for (const contact of contacts) {
            const currentJob = await jobModel.findOne({ jobId });
            const now = moment().tz("America/Los_Angeles");
            
            if (!currentJob) return res.status(500).json({ message: "Job not found" });

            if (currentJob.shouldContinueProcessing === false) {

                const set_isTaken_toFalse = await contactModel.updateMany(
                    { _id: { $in: contactIds } },
                    { $set: { isTaken: false } }
                );

                if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0) ) return res.status(400).json({ message: "Schedule: No contacts got updated from isTaken back to true" }); /**next(new Error("Schedule: No contacts got updated from isTaken back to true")); **/

                return res.status(500).json({ message: `shouldContinueProcessing for jobId: ${jobId} has been set to false`}); /**next(new Error(`shouldContinueProcessing for jobId: ${jobId} has been set to false`));**/
            };

            if (
                now.hour() > CUTOFF_HOUR ||
                (now.hour() === CUTOFF_HOUR && now.minute() >= CUTOFF_MINUTE)
            ) {
                const cancel_job_status = await jobModel.updateOne(
                    { jobId },
                    { callstatus: callstatusenum.CANCELED, shouldContinueProcessing: false }
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

                const toNumber = formatPhoneNumber(post_data.toNumber);

                const registerCall = await retell_client.call.registerPhoneCall({
                    agent_id: agentId,
                    from_number: fromNumber,
                    to_number: toNumber,
                    retell_llm_dynamic_variables: {
                        user_firstname: contact.firstname,
                        user_email: contact.email,
                        user_lastname: contact.lastname,
                        job_id: jobId,
                        user_address: contact.address
                    }
                });

                const create_call = await retell_client.call.createPhoneCall({
                    from_number: fromNumber,
                    to_number: toNumber,
                    override_agent_id: agentId,
                    retell_llm_dynamic_variables: {
                        user_firstname: contact.firstname,
                        user_email: contact.email,
                        user_lastname: contact.lastname,
                        job_id: jobId,
                        user_address: contact.address
                    }
                });
                console.log("new call", create_call.call_id);

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
        
        return {
            jobId,
            scheduleTime: scheduledTimePST,
            contacts
        };

    } catch (e) {
        console.error(`Error scheduling job ${jobId}: `, e);
    };

};