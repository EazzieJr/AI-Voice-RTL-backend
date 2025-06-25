"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callEnded = callEnded;
const transcript_review_1 = require("../utils/transcript-review");
const contact_model_1 = require("../models/contact_model");
const logModel_1 = require("../models/logModel");
const recordModel_1 = require("../models/recordModel");
const script_1 = require("../utils/script");
const types_1 = require("../utils/types");
const graphController_1 = require("./graphController");
async function callEnded(payload, todayString, todaysDateForDatesCalled, time) {
    try {
        const { call_id, agent_id, disconnection_reason, start_timestamp, end_timestamp, transcript, recording_url, public_log_url, cost_metadata, call_cost, call_analysis, retell_llm_dynamic_variables, from_number, to_number, direction, call_status, call_type, } = payload.data;
        let analyzedTranscriptForStatus;
        let callStatus;
        let sentimentStatus;
        let statsUpdate = { $inc: {} };
        if (payload.event === "call_ended") {
            let agentNameEnum;
            if (agent_id === "agent_1852d8aa89c3999f70ecba92b8") {
                agentNameEnum = "ARS";
            }
            else if (agent_id === "agent_6beffabb9adf0ef5bbab8e0bb2") {
                agentNameEnum = "LQR";
            }
            else if (agent_id === "agent_155d747175559aa33eee83a976") {
                agentNameEnum = "SDR";
            }
            else if (agent_id === "214e92da684138edf44368d371da764c") {
                agentNameEnum = "TVAG";
            }
            const isCallFailed = disconnection_reason === "dial_failed";
            const isCallTransferred = disconnection_reason === "call_transfer";
            // const isMachine = disconnection_reason === "voicemail_reached";
            const isDialNoAnswer = disconnection_reason === "dial_no_answer";
            const isCallInactivity = disconnection_reason === "inactivity";
            const isCallAnswered = disconnection_reason === "user_hangup" ||
                disconnection_reason === "agent_hangup";
            analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(transcript);
            const isCallScheduled = analyzedTranscriptForStatus.message.content === "scheduled";
            const isMachine = analyzedTranscriptForStatus.message.content === "voicemail";
            const isIVR = analyzedTranscriptForStatus.message.content === "ivr";
            const callbackdate = await (0, transcript_review_1.reviewCallback)(transcript);
            const newDuration = (0, script_1.convertMsToHourMinSec)(payload.call.duration_ms);
            const callEndedUpdateData = Object.assign({ callId: call_id, agentId: payload.call.agent_id, recordingUrl: recording_url, callDuration: newDuration, disconnectionReason: disconnection_reason, callBackDate: callbackdate, retellCallStatus: payload.data.call_status, agentName: agentNameEnum, duration: (0, script_1.convertMsToHourMinSec)(end_timestamp - start_timestamp) || 0, timestamp: end_timestamp }, (transcript && { transcript }));
            const results = await contact_model_1.EventModel.findOneAndUpdate({ callId: call_id, agentId: payload.call.agent_id }, { $set: callEndedUpdateData }, { upsert: true, returnOriginal: false });
            statsUpdate.$inc.totalCalls = 1;
            statsUpdate.$inc.totalCallDuration = payload.call.duration_ms;
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
            const jobidfromretell = retell_llm_dynamic_variables.job_id
                ? retell_llm_dynamic_variables.job_id
                : null;
            // const resultforcheck = await contactModel.findOne({callId: payload.call.call_id, agentId: payload.call.agent_id})
            let statsResults;
            // if(resultforcheck.calledTimes < 0){
            statsResults = await logModel_1.DailyStatsModel.findOneAndUpdate({
                day: todayString,
                agentId: agent_id,
                jobProcessedBy: jobidfromretell,
            }, statsUpdate, { upsert: true, returnOriginal: false });
            const timestamp = new Date();
            await (0, graphController_1.updateStatsByHour)(agent_id, todayString, timestamp);
            // }
            //const linkToCallLogModelId = statsResults ? statsResults._id : null;
            const updateData = {
                dial_status: callStatus,
                $push: { datesCalled: todaysDateForDatesCalled },
                referenceToCallId: results._id,
                timesCalled: time,
                $inc: { calledTimes: 1 },
            };
            // Conditionally include linkToCallLogModel if it exists
            if (statsResults) {
                updateData.linktocallLogModel = statsResults._id;
            }
            const resultForUserUpdate = await contact_model_1.contactModel.findOneAndUpdate({ callId: call_id, agentId: payload.call.agent_id }, updateData);
            const dataEnded = {
                firstname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_firstname) || null,
                lastname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_lastname) || null,
                email: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.email) || null,
                address: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_address) || null,
                jobid: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.jobId) || null,
                callId: call_id,
                agentId: agent_id,
                status: call_status,
                starttimestamp: start_timestamp,
                endtimestamp: end_timestamp,
                transcript: transcript,
                duration: (0, script_1.convertMsToHourMinSec)(end_timestamp - start_timestamp) || 0,
                publiclogurl: public_log_url,
                fromNumber: from_number,
                toNumber: to_number,
                disconnectionReason: disconnection_reason,
                callType: call_type,
                dial_status: callStatus,
                date: todayString,
                recordingUrl: recording_url,
            };
            await recordModel_1.recordModel.findOneAndUpdate({ callId: call_id, agentId: agent_id }, { $set: dataEnded }, { upsert: true, returnOriginal: false });
            // if (analyzedTranscript.message.content === "Scheduled") {
            //   const data = {
            //     firstname: resultForUserUpdate.firstname,
            //     lastname: resultForUserUpdate.lastname
            //       ? resultForUserUpdate.lastname
            //       : "None",
            //     email: resultForUserUpdate.email,
            //     phone: resultForUserUpdate.phone,
            //   };
            //   axios.post(process.env.ZAP_URL, data);
            // }
            // try {
            //   if (analyzedTranscript.message.content === "call-back") {
            //     const callbackdate =await reviewCallback(transcript)
            //     const data = {
            //       firstname: resultForUserUpdate.firstname,
            //       email: resultForUserUpdate.email,
            //       phone: resultForUserUpdate.phone,
            //       summary: callbackdate ,
            //       url:recording_url,
            //     };
            //     axios.post(process.env.MAKE_URL, data);
            //   }
            // } catch (error) {
            //  console.log(error)
            // }
        }
    }
    catch (error) {
        console.error("Error in handleCallAnalyyzedOrEnded:", error);
    }
}
