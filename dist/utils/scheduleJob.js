"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleCronJob = void 0;
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const uuid_1 = require("uuid");
const logModel_1 = require("../models/logModel");
const contact_model_1 = require("../models/contact_model");
const types_1 = require("./types");
const node_schedule_1 = __importDefault(require("node-schedule"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const formatter_1 = require("./formatter");
const retell_client = new retell_sdk_1.default({
    apiKey: process.env.RETELL_API_KEY
});
const scheduleCronJob = async (scheduledTimePST, agentId, limit, fromNumber, formattedDate, lowerCaseTag, res, next) => {
    try {
        const jobId = (0, uuid_1.v4)();
        console.log("jobId: ", jobId);
        const todayString = new Date().toISOString().split("T")[0];
        const CUTOFF_HOUR = 15;
        const CUTOFF_MINUTE = 30;
        const existingJob = await contact_model_1.jobModel.findOne({
            agentId,
            scheduledTime: formattedDate,
            callstatus: { $in: [types_1.jobstatus.ON_CALL, types_1.jobstatus.QUEUED] },
            shouldContinueProcessing: true
        });
        if (existingJob) {
            console.log(`job running for ${agentId} and tag ${lowerCaseTag}`);
            // return { message: "job already running", jobId: existingJob.jobId };
            return res.status(200).json({
                message: "Job already running",
                jobId: existingJob.jobId
            });
        }
        ;
        const newJob = await contact_model_1.jobModel.create({
            jobId,
            agentId,
            callstatus: types_1.jobstatus.QUEUED,
            scheduledTime: formattedDate,
            shouldContinueProcessing: true,
            tagProcessedFor: lowerCaseTag,
            limit,
            fromNumber
        });
        if (!newJob._id) {
            // return next(new Error("Unable to create new Job model"));
            return res.status(500).json({ message: "Unable to create new Job model" });
        }
        ;
        await logModel_1.DailyStatsModel.create({
            day: todayString,
            agentId,
            jobProcessedBy: jobId
        });
        const contacts = await contact_model_1.contactModel
            .find(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (lowerCaseTag ? { tag: lowerCaseTag } : {})), { isOnDNCList: false, isTaken: false }))
            .limit(limit)
            .sort({ createdAt: "desc" });
        console.log("contacts: ", contacts);
        if (!(contacts === null || contacts === void 0 ? void 0 : contacts.length))
            return res.status(400).json({ message: "No contacts found" }); /** return next(new Error("No contacts found")); **/
        const contactIds = contacts.map(contact => contact._id);
        console.log("contIds: ", contactIds);
        const contact_update = await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: true } });
        if (!(contact_update.acknowledged && contact_update.modifiedCount > 0))
            return res.status(500).json({ message: "Schedule: No contacts got updated from isTaken to false" });
        /**return next(new Error("Schedule: No contacts got updated from isTaken(false")); **/
        const job = node_schedule_1.default.scheduleJob(jobId, scheduledTimePST, async () => {
            try {
                const update_job_status = await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: types_1.jobstatus.ON_CALL });
                if (!(update_job_status.acknowledged && update_job_status.modifiedCount === 1))
                    return res.status(400).json({ message: "Error updating job status to on call" }); /**{ message: "Error updating job status" }; **/
                const contacts_count = await contact_model_1.contactModel
                    .countDocuments(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (lowerCaseTag ? { tag: lowerCaseTag } : {})), { isOnDNCList: false, isTaken: true })).limit(limit);
                console.log("Total contacts found: ", contacts_count);
                const update_contacts_to_process = await contact_model_1.jobModel.updateOne({ jobId }, { totalContactToProcess: contacts_count });
                if (!(update_contacts_to_process.acknowledged && update_contacts_to_process.modifiedCount === 1))
                    return res.status(400).json({ message: "Error updating contacts to process" }); /**next(new Error("Error updating contacts to process")); **/
                for (const contact of contacts) {
                    const currentJob = await contact_model_1.jobModel.findOne({ jobId });
                    const now = (0, moment_timezone_1.default)().tz("America/Los_Angeles");
                    if (!currentJob)
                        return res.status(500).json({ message: "JobId ${jobId} was not found in the database" }); /** next(new Error(`JobId ${jobId} was not found in the database`)); **/
                    if (currentJob.shouldContinueProcessing === false) {
                        const set_isTaken_toFalse = await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: false } });
                        console.log("isTaken: ", set_isTaken_toFalse);
                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0))
                            return res.status(400).json({ message: "Schedule: No contacts got updated from isTaken back to true" }); /**next(new Error("Schedule: No contacts got updated from isTaken back to true")); **/
                        return res.status(500).json({ message: `shouldContinueProcessing for jobId: ${jobId} has been set to false` }); /**next(new Error(`shouldContinueProcessing for jobId: ${jobId} has been set to false`));**/
                    }
                    ;
                    if (now.hour() > CUTOFF_HOUR ||
                        (now.hour() === CUTOFF_HOUR && now.minute() >= CUTOFF_MINUTE)) {
                        console.log("Job stopped due to time cut off");
                        const cancel_job_status = await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: "cancelled", shouldContinueProcessing: false });
                        console.log("status: ", cancel_job_status);
                        if (!(cancel_job_status.acknowledged && cancel_job_status.modifiedCount === 1))
                            return res.status(500).json({ message: "Error updating job status to cancelled" }); /**next(new Error("Error updating job status to cancelled")); **/
                        const set_isTaken_toFalse = await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: false } });
                        console.log("isTaken: ", set_isTaken_toFalse);
                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0))
                            return res.status(400).json({ message: "Schedule: No contacts got updated from isTaken back to true" });
                    }
                    ;
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
                            to_number: (0, formatter_1.formatPhoneNumber)(post_data.toNumber),
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
                            to_number: (0, formatter_1.formatPhoneNumber)(post_data.toNumber),
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
                        const update_callId = await contact_model_1.contactModel.updateOne({ _id: contact._id }, {
                            callId: call_id,
                            $push: {
                                jobProcessedWithId: jobId
                            },
                            isusercalled: true
                        });
                        if (!(update_callId.acknowledged && update_callId.modifiedCount === 1))
                            return res.status(400).json({ message: "Unable to update callId in contact model" }); /** next(new Error("Unable to update callId in contact model")); **/
                        const updated_proc_contacts = currentJob.processedContacts + 1;
                        const currentPercentage = (updated_proc_contacts / contacts_count) * 100;
                        console.log("updat: ", updated_proc_contacts);
                        console.log("percent: ", currentPercentage);
                        const update_job_processed_contacts = await contact_model_1.jobModel.updateOne({ jobId }, {
                            processedContacts: updated_proc_contacts,
                            completedPercent: currentPercentage
                        });
                        if (!(update_job_processed_contacts.acknowledged && update_job_processed_contacts.modifiedCount === 1))
                            return res.status(400).json({ message: "Unable to update processed contacts in job model" }); /** next(new Error("Unable to update processed contacts in job model")); **/
                        console.log(`Call successful for ${contact.firstname}`);
                    }
                    catch (e) {
                        console.error("Error creating phone call: ", e);
                        // return res.status(500).json({
                        //     error: e,
                        //     message: "Error creating phone call"
                        // });
                    }
                    ;
                    await new Promise((resolve) => setTimeout(resolve, 10000));
                }
                ;
                const update_status_to_called = await contact_model_1.jobModel.updateOne({ jobId }, {
                    callstatus: types_1.jobstatus.CALLED,
                    shouldContinueProcessing: false
                });
                if (!(update_status_to_called.acknowledged && update_status_to_called.modifiedCount === 1))
                    return res.status(400).json({ message: "Unable to update call status to called" }); /** next(new Error("Unable to update call status to called")); **/
            }
            catch (e) {
                console.error(`Error creating schedule for jobId: ${jobId} `, e);
                // return res.status(500).json({
                //     error: e,
                //     message: `Error creating schedule for JobId: ${jobId}`
                // });
            }
            ;
        });
        // console.log(`Job: ${jobId} successful, Next scheduled run: ${job.nextInvocation()}`);
        return { jobId, scheduleTine: scheduledTimePST, contacts };
    }
    catch (e) {
        console.error("Error scheduling cron job: ", e);
        return res.status(500).json({
            error: e,
            message: "Error scheduling cron job"
        });
    }
    ;
};
exports.scheduleCronJob = scheduleCronJob;
