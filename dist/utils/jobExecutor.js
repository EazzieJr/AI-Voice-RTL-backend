"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeJob = void 0;
const node_schedule_1 = __importDefault(require("node-schedule"));
const contact_model_1 = require("../models/contact_model");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const types_1 = require("./types");
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const formatter_1 = require("./formatter");
const retell_client = new retell_sdk_1.default({
    apiKey: process.env.RETELL_API_KEY
});
const executeJob = async (jobId, agentId, scheduledTimePST, limit, fromNumber, tagProcessedFor) => {
    try {
        const CUTOFF_HOUR = 15;
        const CUTOFF_MINUTE = 30;
        node_schedule_1.default.scheduleJob(jobId, scheduledTimePST, async () => {
            try {
                const update_job_status = await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: types_1.jobstatus.ON_CALL });
                if (!(update_job_status.acknowledged && update_job_status.modifiedCount === 1)) {
                    throw new Error("Error updating job status to on call");
                }
                ;
                const contacts = await contact_model_1.contactModel
                    .find(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (tagProcessedFor ? { tag: tagProcessedFor } : {})), { isOnDNCList: false, isTaken: true }))
                    .limit(limit)
                    .sort({ createdAt: "desc" });
                const contacts_count = contacts.length;
                const update_contacts_to_process = await contact_model_1.jobModel.updateOne({ jobId }, { totalContactToProcess: contacts_count });
                if (!(update_contacts_to_process.acknowledged && update_contacts_to_process.modifiedCount === 1)) {
                    throw new Error("Error; updating contacts to process");
                }
                ;
                const contactIds = contacts.map((contact) => contact._id);
                for (const contact of contacts) {
                    const currentJob = await contact_model_1.jobModel.findOne({ jobId });
                    const now = (0, moment_timezone_1.default)().tz("America/Los_Angeles");
                    if (!currentJob) {
                        throw new Error("Job not found");
                    }
                    ;
                    if (currentJob.shouldContinueProcessing === false) {
                        const set_isTaken_toFalse = await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: false } });
                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0)) {
                            throw new Error("Schedule: No contacts got updated from isTaken back to true");
                        }
                        ;
                        return `shouldContinueProcessing for jobId: ${jobId} has been set to false`;
                    }
                    ;
                    if (now.hour() > CUTOFF_HOUR ||
                        (now.hour() === CUTOFF_HOUR && now.minute() >= CUTOFF_MINUTE)) {
                        const cancel_job_status = await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: types_1.callstatusenum.CANCELED, shouldContinueProcessing: false });
                        console.log("status: ", cancel_job_status);
                        if (!(cancel_job_status.acknowledged && cancel_job_status.modifiedCount === 1)) {
                            throw new Error("Error updating job status to cancelled");
                        }
                        ;
                        const set_isTaken_toFalse = await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: false } });
                        console.log("isTaken: ", set_isTaken_toFalse);
                        if (!(set_isTaken_toFalse.acknowledged && set_isTaken_toFalse.modifiedCount > 0)) {
                            throw new Error("Schedule: No contacts got updated from isTaken back to true");
                        }
                        ;
                        return;
                    }
                    ;
                    try {
                        const post_data = {
                            fromNumber,
                            toNumber: contact.phone,
                            userId: contact._id.toString(),
                            agentId
                        };
                        const toNumber = (0, formatter_1.formatPhoneNumber)(post_data.toNumber);
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
                        const update_callId = await contact_model_1.contactModel.updateOne({ _id: contact._id }, {
                            callId: call_id,
                            $push: {
                                jobProcessedWithId: jobId
                            },
                            isusercalled: true
                        });
                        if (!(update_callId.acknowledged && update_callId.modifiedCount === 1)) {
                            throw new Error("Unable to update callId in contact model");
                        }
                        ;
                        const updated_proc_contacts = currentJob.processedContacts + 1;
                        const currentPercentage = (updated_proc_contacts / contacts_count) * 100;
                        console.log("updat: ", updated_proc_contacts);
                        console.log("percent: ", currentPercentage);
                        const update_job_processed_contacts = await contact_model_1.jobModel.updateOne({ jobId }, {
                            processedContacts: updated_proc_contacts,
                            completedPercent: currentPercentage
                        });
                        if (!(update_job_processed_contacts.acknowledged && update_job_processed_contacts.modifiedCount === 1)) {
                            throw new Error("Unable to update processed contacts in job model");
                        }
                        ;
                        console.log(`Call successful for ${contact.firstname}`);
                    }
                    catch (e) {
                        console.error("Error creating phone call: ", e);
                    }
                    ;
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                ;
                const update_status_to_called = await contact_model_1.jobModel.updateOne({ jobId }, {
                    callstatus: types_1.jobstatus.CALLED,
                    shouldContinueProcessing: false
                });
                if (!(update_status_to_called.acknowledged && update_status_to_called.modifiedCount === 1)) {
                    throw new Error("Unable to update call status to called");
                }
                ;
            }
            catch (e) {
                console.error("Error scheduling job for jobId: ", jobId);
            }
            ;
        });
        return {
            jobId,
            scheduleTime: scheduledTimePST,
        };
    }
    catch (e) {
        console.error(`Error scheduling job ${jobId}: `, e);
    }
    ;
};
exports.executeJob = executeJob;
