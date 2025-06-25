"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleCronJob = void 0;
const contact_model_1 = require("../models/contact_model");
const uuid_1 = require("uuid");
const types_1 = require("../utils/types");
const node_schedule_1 = __importDefault(require("node-schedule"));
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const logModel_1 = require("../models/logModel");
const formatter_1 = require("../utils/formatter");
const retellClient = new retell_sdk_1.default({
    apiKey: process.env.RETELL_API_KEY,
});
const scheduleCronJob = async (scheduledTimePST, agentId, limit, fromNumber, formattedDate, lowerCaseTag, address) => {
    const jobId = (0, uuid_1.v4)();
    const todayString = new Date().toISOString().split("T")[0];
    try {
        await logModel_1.DailyStatsModel.create({
            day: todayString,
            agentId,
            jobProcessedBy: jobId,
        });
        const existingJob = await contact_model_1.jobModel.findOne({
            agentId,
            scheduledTime: formattedDate,
            callstatus: { $in: [types_1.jobstatus.ON_CALL, types_1.jobstatus.QUEUED] },
            shouldContinueProcessing: true,
        });
        if (existingJob) {
            console.log(`A job is already running for agent: ${agentId} and tag: ${lowerCaseTag}.`);
            return { message: "Job already running", jobId: existingJob.jobId };
        }
        // const CUTOFF_HOUR = 14;
        // const CUTOFF_MINUTE = 10;
        const CUTOFF_HOUR = 16;
        const CUTOFF_MINUTE = 10;
        await contact_model_1.jobModel.create({
            callstatus: types_1.jobstatus.QUEUED,
            jobId,
            agentId,
            scheduledTime: formattedDate,
            shouldContinueProcessing: true,
            tagProcessedFor: lowerCaseTag,
        });
        const contactLimit = limit ? parseInt(limit) : null;
        const contacts = await contact_model_1.contactModel
            .find(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (lowerCaseTag ? { tag: lowerCaseTag } : {})), { isOnDNCList: false, isTaken: false }))
            .limit(contactLimit)
            .sort({ createdAt: "desc" });
        if (contacts.length > 0) {
            const contactIds = contacts.map(contact => contact._id);
            await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: true } });
        }
        const job = node_schedule_1.default.scheduleJob(jobId, scheduledTimePST, async () => {
            try {
                let currentJob = await contact_model_1.jobModel.findOneAndUpdate({ jobId }, { callstatus: types_1.jobstatus.ON_CALL }, { new: true });
                const totalContacts = await contact_model_1.contactModel
                    .countDocuments(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (lowerCaseTag ? { tag: lowerCaseTag } : {})), { isOnDNCList: false, isTaken: false }))
                    .limit(contactLimit);
                // Log the query and the result
                console.log("Query for total contacts:", Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (lowerCaseTag ? { tag: lowerCaseTag } : {})), { isOnDNCList: false }));
                console.log("Total contacts found:", totalContacts);
                await contact_model_1.jobModel.findOneAndUpdate({ jobId }, { totalContactToProcess: totalContacts });
                for (const contact of contacts) {
                    currentJob = await contact_model_1.jobModel.findOne({ jobId });
                    const now = (0, moment_timezone_1.default)().tz("America/Los_Angeles");
                    // Time cutoff check
                    if (now.hour() > CUTOFF_HOUR ||
                        (now.hour() === CUTOFF_HOUR && now.minute() >= CUTOFF_MINUTE)) {
                        console.log("Job processing stopped due to time cutoff (9:45 PST).");
                        await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: "cancelled", shouldContinueProcessing: false });
                        break;
                    }
                    if (!currentJob || currentJob.shouldContinueProcessing === false) {
                        console.log("Job processing stopped by user flag.");
                        await contact_model_1.jobModel.updateOne({ jobId }, { callstatus: "cancelled", shouldContinueProcessing: false });
                        console.log("contacts: ", contacts);
                        if (contacts.length > 0) {
                            const contactIds = contacts.map(contact => contact._id);
                            console.log("In here");
                            console.log("cont ids: ", contactIds);
                            await contact_model_1.contactModel.updateMany({ _id: { $in: contactIds } }, { $set: { isTaken: false } });
                        }
                        break;
                    }
                    try {
                        const postdata = {
                            fromNumber,
                            toNumber: contact.phone,
                            userId: contact._id.toString(),
                            agentId,
                        };
                        await retellClient.call.registerPhoneCall({
                            agent_id: agentId,
                            from_number: fromNumber,
                            to_number: (0, formatter_1.formatPhoneNumber)(postdata.toNumber),
                            retell_llm_dynamic_variables: {
                                user_firstname: contact.firstname,
                                user_email: contact.email,
                                user_lastname: contact.lastname,
                                job_id: jobId,
                                user_address: contact.address,
                            },
                        });
                        const registerCallResponse = await retellClient.call.createPhoneCall({
                            from_number: fromNumber,
                            to_number: (0, formatter_1.formatPhoneNumber)(postdata.toNumber),
                            override_agent_id: agentId,
                            retell_llm_dynamic_variables: {
                                user_firstname: contact.firstname,
                                user_email: contact.email,
                                user_lastname: contact.lastname,
                                job_id: jobId,
                                user_address: contact.address,
                            },
                        });
                        await contact_model_1.contactModel.findByIdAndUpdate(contact._id, {
                            callId: registerCallResponse.call_id,
                            $push: { jobProcessedWithId: jobId },
                            isusercalled: true,
                        });
                        const updatedProcessedContacts = currentJob.processedContacts + 1;
                        const currentPercentage = (updatedProcessedContacts / totalContacts) * 100;
                        await contact_model_1.jobModel.findOneAndUpdate({ jobId }, {
                            $inc: { processedContacts: 1 },
                            completedPercent: currentPercentage,
                        });
                        console.log(`Call successful for contact: ${contact.firstname}`);
                    }
                    catch (error) {
                        console.log("Error during call processing:", error);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 4000));
                }
                await contact_model_1.jobModel.findOneAndUpdate({ jobId }, { callstatus: types_1.jobstatus.CALLED, shouldContinueProcessing: false });
            }
            catch (error) {
                console.error("Error in job processing:", error);
            }
        });
        console.log(`Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}`);
        return { jobId, scheduledTime: scheduledTimePST, contacts };
    }
    catch (error) {
        console.error("Error scheduling job:", error);
        throw error;
    }
};
exports.scheduleCronJob = scheduleCronJob;
