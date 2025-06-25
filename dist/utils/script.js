"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.script = script;
exports.convertMsToHourMinSec = convertMsToHourMinSec;
const historyModel_1 = __importDefault(require("../models/historyModel"));
const transcript_review_1 = require("./transcript-review");
const types_1 = require("./types");
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const logModel_1 = require("../models/logModel");
const contact_model_1 = require("../models/contact_model");
// Helper function to split an array into chunks
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
async function processBatch(batch, retellClient) {
    const results = await Promise.all(batch.map(async (contact) => {
        var _a, _b, _c, _d;
        try {
            const result = await retellClient.call.retrieve(contact.callId);
            const isCallFailed = result.disconnection_reason === "dial_failed";
            const isCallTransferred = result.disconnection_reason === "call_transfer";
            const isDialNoAnswer = result.disconnection_reason === "dial_no_answer";
            const isCallInactivity = result.disconnection_reason === "inactivity";
            const isCallAnswered = result.disconnection_reason === "user_hangup" ||
                result.disconnection_reason === "agent_hangup";
            const analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(result.transcript);
            const isCallScheduled = analyzedTranscriptForStatus.message.content === "scheduled";
            const isMachine = analyzedTranscriptForStatus.message.content === "voicemail";
            const isIVR = analyzedTranscriptForStatus.message.content === "ivr";
            let callStatus;
            let statsUpdate = { $inc: {} };
            // if (isMachine) {
            //   callStatus = callstatusenum.VOICEMAIL;
            // } else if (isIVR) {
            //   callStatus = callstatusenum.IVR;
            // } else if (isCallScheduled) {
            //   callStatus = callstatusenum.SCHEDULED;
            // } else if (isCallFailed) {
            //   callStatus = callstatusenum.FAILED;
            // } else if (isCallTransferred) {
            //   callStatus = callstatusenum.TRANSFERRED;
            // } else if (isDialNoAnswer) {
            //   callStatus = callstatusenum.NO_ANSWER;
            // } else if (isCallInactivity) {
            //   callStatus = callstatusenum.INACTIVITY;
            // } else if (isCallAnswered) {
            //   callStatus = callstatusenum.CALLED;
            // }
            statsUpdate.$inc.totalCalls = 1;
            statsUpdate.$inc.totalCallDuration = result.duration_ms;
            if (isMachine) {
                statsUpdate.$inc.totalAnsweredByVm = 1;
                callStatus = types_1.callstatusenum.VOICEMAIL;
            }
            else if (isIVR) {
                statsUpdate.$inc.totalAnsweredByIVR = 1;
                callStatus = types_1.callstatusenum.IVR;
            }
            else if (isCallScheduled) {
                statsUpdate.$inc.totalAppointment = 1;
                callStatus = types_1.callstatusenum.SCHEDULED;
            }
            else if (isCallFailed) {
                statsUpdate.$inc.totalFailed = 1;
                callStatus = types_1.callstatusenum.FAILED;
            }
            else if (isCallTransferred) {
                statsUpdate.$inc.totalTransffered = 1;
                callStatus = types_1.callstatusenum.TRANSFERRED;
            }
            else if (isDialNoAnswer) {
                statsUpdate.$inc.totalDialNoAnswer = 1;
                callStatus = types_1.callstatusenum.NO_ANSWER;
            }
            else if (isCallInactivity) {
                statsUpdate.$inc.totalCallInactivity = 1;
                callStatus = types_1.callstatusenum.INACTIVITY;
            }
            else if (isCallAnswered) {
                statsUpdate.$inc.totalCallAnswered = 1;
                callStatus = types_1.callstatusenum.CALLED;
            }
            function convertTimestampToDateFormatPST(timestamp) {
                // Create a Date object from the timestamp
                const date = new Date(timestamp);
                // Convert to 'America/Los_Angeles' timezone (PST) and format as 'YYYY-MM-DD'
                const formattedDate = date.toLocaleDateString("en-CA", {
                    timeZone: "America/Los_Angeles", // Ensure the date is in PST
                });
                return formattedDate;
            }
            // await callHistoryModel.findOneAndUpdate(
            //   { callId: result.call_id, agentId: result.agent_id },
            //   { dial_status: callStatus },
            //   { upsert: true },
            // );
            const todays = new Date();
            todays.setHours(0, 0, 0, 0);
            const todayString = todays.toISOString().split("T")[0];
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const hours = String(today.getHours()).padStart(2, "0");
            const minutes = String(today.getMinutes()).padStart(2, "0");
            const newDuration = convertMsToHourMinSec(result.duration_ms);
            const todayStringWithTime = `${year}-${month}-${day}`;
            const time = `${hours}:${minutes}`;
            const callData = {
                callId: result.call_id,
                agentId: result.agent_id,
                userFirstname: ((_a = result.retell_llm_dynamic_variables) === null || _a === void 0 ? void 0 : _a.user_firstname) || null,
                userLastname: ((_b = result.retell_llm_dynamic_variables) === null || _b === void 0 ? void 0 : _b.user_lastname) || null,
                userEmail: ((_c = result.retell_llm_dynamic_variables) === null || _c === void 0 ? void 0 : _c.user_email) || null,
                recordingUrl: result.recording_url || null,
                disconnectionReason: result.disconnection_reason || null,
                callStatus: result.call_status,
                startTimestamp: result.start_timestamp || null,
                endTimestamp: result.end_timestamp || null,
                durationMs: convertMsToHourMinSec(result.end_timestamp - result.start_timestamp) || 0,
                transcript: result.transcript || null,
                transcriptObject: result.transcript_object || [],
                transcriptWithToolCalls: result.transcript_with_tool_calls || [],
                publicLogUrl: result.public_log_url || null,
                callType: result.call_type || null,
                fromNumber: result.from_number || null,
                toNumber: result.to_number || null,
                direction: result.direction || null,
                date: convertTimestampToDateFormatPST(result.start_timestamp),
                address: ((_d = result.retell_llm_dynamic_variables) === null || _d === void 0 ? void 0 : _d.user_address) || null,
                dial_status: callStatus,
            };
            await historyModel_1.default.findOneAndUpdate({ callId: result.call_id, agentId: result.agent_id }, { $set: callData }, { upsert: true, new: true });
            const resultss = await contact_model_1.EventModel.findOneAndUpdate({
                callId: result.call_id,
                agentId: result.agent_id,
            }, {
                callId: result.call_id,
                recordingUrl: result.recording_url,
                callDuration: newDuration,
                disconnectionReason: result.disconnection_reason,
                retellCallStatus: result.call_status,
                duration: convertMsToHourMinSec(result.end_timestamp - result.start_timestamp),
                timestamp: result.end_timestamp,
                transcript: result.transcript,
            }, { upsert: true, new: true });
            await contact_model_1.contactModel.findOneAndUpdate({ callId: result.call_id, agentId: result.agent_id }, {
                dial_status: callStatus,
                timescalled: time,
                $push: { datesCalled: todayStringWithTime },
                referenceToCallId: resultss._id,
            });
            let statsResults;
            // if(resultforcheck.calledTimes < 0){
            statsResults = await logModel_1.DailyStatsModel.findOneAndUpdate({
                day: convertTimestampToDateFormatPST(result.start_timestamp),
                agentId: result.agent_id,
                jobProcessedBy: result.retell_llm_dynamic_variables.job_id,
            }, statsUpdate, { upsert: true, returnOriginal: false });
            return { success: true, contactId: contact.callId };
        }
        catch (error) {
            console.error(`Error processing contact ${contact.callId}:`, error);
            return { success: false, contactId: contact.callId, error };
        }
    }));
    return results;
}
async function script(jobid) {
    try {
        const retellClient = new retell_sdk_1.default({
            apiKey: process.env.RETELL_API_KEY,
        });
        const contacts = await contact_model_1.contactModel
            .find({ jobProcessedWithId: jobid })
            .sort({ createdAt: -1 })
            .limit(2000); // Fetch all contacts
        await logModel_1.DailyStatsModel.findOneAndDelete({ jobProcessedBy: jobid });
        const startOfDayPST = new Date("2025-01-06T00:00:00-08:00").getTime(); // Start of day in PST
        const endOfDayPST = new Date("2025-01-06T23:59:59-08:00").getTime(); // End of day in PST
        // //1736186951683
        // console.log(startOfDayPST)
        // // Define filter criteria using `after_start_timestamp` and `before_start_timestamp`
        // const filterCriteria: CallListParams.FilterCriteria = {
        //   after_start_timestamp: startOfDayPST, // Calls starting at or after this time
        //   //before_start_timestamp: endOfDayPST, // Calls starting before this time
        // };
        // const contacts = await retellClient.call.list({
        //   filter_criteria: filterCriteria,
        //   limit: 10000,
        // });
        const batches = chunkArray(contacts, 1000); // Split into batches of 1000
        for (const [index, batch] of batches.entries()) {
            console.log(`Processing batch ${index + 1} of ${batches.length}...`);
            const results = await processBatch(batch, retellClient);
            const successCount = results.filter((r) => r.success).length;
            const errorCount = results.filter((r) => !r.success).length;
            console.log(`Batch ${index + 1} completed: ${successCount} successful, ${errorCount} failed.`);
        }
        console.log("Script completed successfully!");
    }
    catch (error) {
        console.error("Script encountered an error:", error);
    }
}
function convertMsToHourMinSec(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
