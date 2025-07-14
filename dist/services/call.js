"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.call_service = void 0;
const contact_model_1 = require("../models/contact_model");
const _root_1 = __importDefault(require("./_root"));
const types_1 = require("../utils/types");
const transcript_review_1 = require("../utils/transcript-review");
const historyModel_1 = __importDefault(require("../models/historyModel"));
const logModel_1 = require("../models/logModel");
const graphController_1 = require("../controllers/graphController");
const axios_1 = __importDefault(require("axios"));
const call_1 = require("../validations/call");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const scheduleJob_1 = require("../utils/scheduleJob");
const node_schedule_1 = __importDefault(require("node-schedule"));
const luxon_1 = require("luxon");
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const userModel_1 = require("../models/userModel");
class CallService extends _root_1.default {
    async fetch_minutes(agentId, next) {
        var _a;
        try {
            const now = luxon_1.DateTime.now().setZone("America/Los_Angeles");
            const startOfMonth = now.startOf("month");
            const todayDate = now.startOf("day");
            const monthDates = [];
            let currentDate = startOfMonth;
            while (currentDate <= todayDate) {
                monthDates.push(currentDate.toFormat("yyyy-MM-dd"));
                currentDate = currentDate.plus({ days: 1 });
            }
            ;
            console.log("month dates: ", monthDates);
            const duration = await logModel_1.DailyStatsModel.aggregate([
                {
                    $match: {
                        agentId,
                        day: {
                            $in: monthDates
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_duration: { $sum: "$totalCallDuration" }
                    }
                }
            ]);
            console.log("dura: ", duration);
            const milliseconds = ((_a = duration[0]) === null || _a === void 0 ? void 0 : _a.total_duration) || 0;
            const minutes = Math.floor(milliseconds / 60000);
            console.log("minutes: ", minutes);
            return minutes;
        }
        catch (e) {
            console.error("Error fetching minutes: ", e);
            next(e);
        }
        ;
    }
    ;
    async schedule_call(req, res, next) {
        try {
            const body = req.body;
            const { error } = call_1.ScheduleCallSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const { hour, minute, agentId, limit, fromNumber, tag } = req.body;
            const scheduledTimePST = moment_timezone_1.default
                .tz("America/Los_Angeles")
                .set({
                hour,
                minute,
                second: 0,
                millisecond: 0
            })
                .toDate();
            const formattedDate = (0, moment_timezone_1.default)(scheduledTimePST).format("YYYY-MM-DDTHH:mm:ss");
            const currentDate = luxon_1.DateTime.now().setZone("America/Los_Angeles").toISO();
            if (formattedDate <= currentDate)
                return res.status(400).json({ message: "Date and time has to be in the future" });
            const lowerCaseTag = tag.toLowerCase();
            const minutes = await this.fetch_minutes(agentId, next);
            const client = await userModel_1.userModel.findOne({ 'agents.agentId': agentId });
            if (minutes >= 5000) {
                // if (client?.name === "Executive Strategy Group") {
                //     console.log("Quota exceeded but ignoring for Executive Strategy Group");
                // } else {
                //     return res.status(400).json({ message: "Quota of 5000 minutes reached" });
                // }
                return res.status(400).json({ message: "Quota of 5000 minutes reached" });
            }
            else if (minutes >= 4500) {
                console.log("Minutes quota exceeded 4500");
            }
            ;
            const call_schedule = await (0, scheduleJob_1.scheduleCronJob)(scheduledTimePST, agentId, limit, fromNumber, formattedDate, lowerCaseTag, res, next);
            return res.status(200).json({
                call_schedule
            });
        }
        catch (e) {
            console.error("Error scheduling call: " + e);
            next(e);
        }
        ;
    }
    ;
    async retell_webhook(req, res, next) {
        try {
            const payload = req.body;
            const { event, data } = payload;
            const todays = new Date();
            todays.setHours(0, 0, 0, 0);
            const todayString = todays.toISOString().split("T")[0];
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const hours = String(today.getHours()).padStart(2, "0");
            const minutes = String(today.getMinutes()).padStart(2, "0");
            const todayStringWithTime = `${year}-${month}-${day}`;
            const time = `${hours}: ${minutes}`;
            if (event === "call_started") {
                console.log("call started: ", payload);
                await this.call_started(payload);
            }
            else if (event === "call_ended") {
                console.log("call_ended here");
                // await this.call_ended(payload, todayString, todayStringWithTime, time);
            }
            else if (event === "call_analyzed") {
                // console.log("call analyzed: ", payload);
                await this.call_analyzed(payload, todayString, todayStringWithTime, time);
            }
            else {
                return res.status(500).json({
                    error: "Invalid event detected",
                    event_gotten: event
                });
            }
            ;
            // console.log("pay: ", payload);
            return res.status(200).send("webhook hit");
        }
        catch (e) {
            console.error("Error while accessing webhook from retell: " + e);
            next(e);
        }
        ;
    }
    ;
    async call_started(payload) {
        try {
            const { event, call } = payload;
            // console.log("data: ", payload);
            if (event === "call_started") {
                const { call_id, agent_id } = call;
                await contact_model_1.contactModel.updateOne({ callId: call_id, agentId: agent_id }, { $set: { dial_status: types_1.callstatusenum.IN_PROGRESS } });
                // console.log("call started for: ", call_id);
            }
            else {
                console.error("Event must be call_started: ", event);
            }
            ;
        }
        catch (e) {
            console.error("Unable to get data from started call: " + e);
            // next(e);
        }
        ;
    }
    ;
    async call_ended(payload, todayString, todaysDateForDatesCalled, time) {
        try {
            // console.log("payload: ", payload);
            const { event, call, data } = payload;
            const { call_type, call_id, start_timestamp, end_timestamp, transcript, disconnection_reason, recording_url, public_log_url, retell_llm_dynamic_variables, from_number, to_number, direction, call_status } = data;
            const { agent_id, duration_ms } = call;
            let analyzedTranscriptForStatus;
            let callStatus;
            let statsUpdate = { $inc: {} };
            function convertMsToHourMinSec(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            ;
            if (event === "call_ended") {
                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
                analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(transcript);
                const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
                const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";
                const call_back_date = await (0, transcript_review_1.reviewCallback)(transcript);
                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;
                const call_ended_updated_data = Object.assign({ callId: call_id, agentId: agent_id, recordingUrl: recording_url, callDuration: duration_in_HMS, disconnectionReason: disconnection_reason, callBackDate: call_back_date, retellCallStatus: call_status, duration: total_duration, timestamp: end_timestamp }, (transcript && { transcript }));
                const transcript_data = await contact_model_1.EventModel.create(call_ended_updated_data);
                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;
                if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = types_1.callstatusenum.VOICEMAIL;
                }
                else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = types_1.callstatusenum.IVR;
                }
                else if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = types_1.callstatusenum.SCHEDULED;
                }
                else if (call_failed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = types_1.callstatusenum.FAILED;
                }
                else if (call_transferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = types_1.callstatusenum.TRANSFERRED;
                }
                else if (dial_no_answer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = types_1.callstatusenum.NO_ANSWER;
                }
                else if (call_inactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = types_1.callstatusenum.INACTIVITY;
                }
                else if (call_hangedup) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = types_1.callstatusenum.CALLED;
                }
                ;
                const callData = {
                    callId: call_id,
                    agentId: agent_id,
                    userFirstname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_firstname) || null,
                    userLastname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_lastname) || null,
                    userEmail: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_email) || null,
                    recordingUrl: recording_url || null,
                    disconnectionReason: disconnection_reason || null,
                    callStatus: call_status,
                    startTimestamp: start_timestamp || null,
                    endTimestamp: end_timestamp || null,
                    durationMs: total_duration,
                    transcript: transcript || null,
                    transcriptObject: data.transcript_object || [],
                    transcriptWithToolCalls: payload.data.transcript_with_tool_calls || [],
                    publicLogUrl: public_log_url || null,
                    callType: call_type || null,
                    // customAnalysisData:
                    //     event === "call_analyzed" ? call_analysis : null,
                    fromNumber: from_number || null,
                    toNumber: to_number || null,
                    direction: direction || null,
                    date: todayString,
                    address: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_address) || null,
                    dial_status: callStatus,
                };
                await historyModel_1.default.create(callData);
                const jobId_from_retell = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id : null;
                let statResults;
                statResults = await logModel_1.DailyStatsModel.findOneAndUpdate({ day: todayString, agentId: agent_id, jobProcessedBy: jobId_from_retell }, statsUpdate, { returnOriginal: false });
                const timestamp = new Date();
                await (0, graphController_1.updateStatsByHour)(agent_id, todayString, timestamp);
                const updateData = {
                    dial_status: callStatus,
                    $push: {
                        datesCalled: todaysDateForDatesCalled
                    },
                    referenceToCallId: transcript_data._id,
                    timesCalled: time,
                    $inc: { calledTimes: 1 }
                };
                if (statResults) {
                    updateData.linktocallLogModel = statResults._id;
                }
                else {
                    console.log("stat: ", statResults);
                }
                ;
                await contact_model_1.contactModel.findOneAndUpdate({ callId: call_id, agentId: agent_id }, { $set: updateData });
                // console.log("call ended for: ", call_id);
            }
            else {
                console.error("Event must be call_ended: ", event);
            }
            ;
        }
        catch (e) {
            console.error("Unable to get data from call ended: " + e);
            // next(e);
        }
        ;
    }
    ;
    // async call_analyzed(payload: any, todayString: string, todaysDateForDatesCalled: any, time: any) {
    //     try {
    //         const { event, call } = payload;
    //         const { 
    //             agent_id, 
    //             call_id,
    //             call_type,
    //             call_status,
    //             start_timestamp,
    //             end_timestamp,
    //             disconnection_reason,
    //             from_number, 
    //             to_number,
    //             direction,
    //             transcript,
    //             duration_ms,
    //             recording_url,
    //             public_log_url,
    //             call_analysis, 
    //             retell_llm_dynamic_variables,
    //             transcript_object,
    //             transcript_with_tool_calls 
    //         } = call;
    //         const fetch_client = await userModel.findOne({ 'agents.agentId': agent_id });
    //         let analyzedTranscriptForStatus;
    //         let callStatus;
    //         let sentimentStatus;
    //         let callOutcome;
    //         let statsUpdate: any = { $inc: {} };
    //         function convertMsToHourMinSec(ms: number): string {
    //             const totalSeconds = Math.floor(ms / 1000);
    //             const hours = Math.floor(totalSeconds / 3600);
    //             const minutes = Math.floor((totalSeconds % 3600) / 60);
    //             const seconds = totalSeconds % 60;
    //             return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    //         };
    //         if (event === "call_analyzed") {
    //             console.log("inside analyzed function");
    //             const call_failed = disconnection_reason === "dial_failed";
    //             const call_transferred = disconnection_reason === "call_transfer";
    //             const dial_no_answer = disconnection_reason === "dial_no_answer";
    //             const call_inactivity = disconnection_reason === 'inactivity';
    //             const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
    //             const call_error = disconnection_reason === "error_inbound_webhook" || "error_llm_websocket_open" || "error_llm_websocket_lost_connection" || "error_llm_websocket_runtime" || "error_llm_websocket_corrupt_payload" || "error_frontend_corrupted_payload" || "error_twilio" || "error_no_audio_received" || "error_asr" || "error_retell" || "error_unknown" || "error_user_not_joined";
    //             analyzedTranscriptForStatus = await reviewTranscript(transcript);
    //             const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
    //             const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
    //             const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";
    //             const is_dnc = analyzedTranscriptForStatus.message.content === "dnc";
    //             const is_callback = analyzedTranscriptForStatus.message.content === "call-back";
    //             const is_neutral =  call_analysis.user_sentiment === "Neutral";
    //             const is_unknown =  call_analysis.user_sentiment === "Unknown";
    //             const is_positive = call_analysis.user_sentiment === "Positive";
    //             const is_negative = call_analysis.user_sentiment === "Negative";
    //             const call_back_date = await reviewCallback(transcript);
    //             const duration_in_HMS = convertMsToHourMinSec(duration_ms);
    //             const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;
    //             statsUpdate.$inc.totalCalls = 1;
    //             statsUpdate.$inc.totalCallDuration = duration_ms;
    //             let callError;
    //             if (is_machine) {
    //                 statsUpdate.$inc.totalAnsweredByVm = 1;
    //                 callStatus = callstatusenum.VOICEMAIL;
    //             } else if (is_ivr) {
    //                 statsUpdate.$inc.totalAnsweredByIVR = 1;
    //                 callStatus = callstatusenum.IVR;
    //             } else if (is_call_scheduled) {
    //                 statsUpdate.$inc.totalAppointment = 1;
    //                 callStatus = callstatusenum.SCHEDULED;
    //             } else if (call_failed) {
    //                 statsUpdate.$inc.totalFailed = 1;
    //                 callStatus = callstatusenum.FAILED;
    //                 callOutcome = calloutcome.FAILED;
    //             } else if (call_transferred) {
    //                 statsUpdate.$inc.totalTransffered = 1;
    //                 callStatus = callstatusenum.TRANSFERRED;
    //                 callOutcome = calloutcome.TRANSFERRED
    //             } else if (dial_no_answer) {
    //                 statsUpdate.$inc.totalDialNoAnswer = 1;
    //                 callStatus = callstatusenum.NO_ANSWER;
    //             } else if (call_inactivity) {
    //                 statsUpdate.$inc.totalCallInactivity = 1;
    //                 callStatus = callstatusenum.INACTIVITY;
    //             } else if (call_hangedup) {
    //                 statsUpdate.$inc.totalCallAnswered = 1;
    //                 callStatus = callstatusenum.CALLED;
    //                 callOutcome = calloutcome.SUCCESS;
    //             } else if (call_error) {
    //                 callError = callstatusenum.ERROR;
    //             };
    //             if (is_call_scheduled) {
    //                 sentimentStatus = callSentimentenum.SCHEDULED;
    //                 callOutcome = calloutcome.SCHEDULED;
    //             } else if (is_callback) {
    //                 sentimentStatus = callSentimentenum.CALLBACK;
    //             } else if (is_dnc) {
    //                 sentimentStatus = callSentimentenum.DNC;
    //                 callOutcome = calloutcome.DNC;
    //             } else if (is_neutral) {
    //                 sentimentStatus = callSentimentenum.NEUTRAL;
    //             } else if (is_positive) {
    //                 sentimentStatus = callSentimentenum.POSITIVE;
    //             } else if (is_negative) {
    //                 sentimentStatus = callSentimentenum.NEGATIVE;
    //             } else if (is_unknown) {
    //                 sentimentStatus = callSentimentenum.UNKNOWN;
    //             };
    //             const new_transcript = await EventModel.create({
    //                 callId: call_id,
    //                 agentId: agent_id,
    //                 recordingUrl: recording_url,
    //                 callDuration: duration_in_HMS,
    //                 disconnectionReason: disconnection_reason,
    //                 callBackDate: call_back_date,
    //                 retellCallStatus: call_status,
    //                 duration: total_duration,
    //                 timestamp: end_timestamp,
    //                 ...(transcript && { transcript }),
    //                 retellCallSummary: call_analysis.call_summary,
    //                 analyzedTranscript: sentimentStatus,
    //                 userSentiment: sentimentStatus
    //             });
    //             const callData = {
    //                 callId: call_id,
    //                 agentId: agent_id,
    //                 userFirstname: retell_llm_dynamic_variables?.user_firstname || null,
    //                 userLastname: retell_llm_dynamic_variables?.user_lastname || null,
    //                 userEmail: retell_llm_dynamic_variables?.user_email || null,
    //                 recordingUrl: recording_url || null,
    //                 disconnectionReason: disconnection_reason || callError || null,
    //                 callStatus: call_status,
    //                 startTimestamp: start_timestamp || null,
    //                 endTimestamp: end_timestamp || null,
    //                 durationMs: total_duration,
    //                 transcript: transcript || null,
    //                 transcriptObject: transcript_object || [],
    //                 transcriptWithToolCalls: transcript_with_tool_calls || [],
    //                 publicLogUrl: public_log_url || null,
    //                 callType: call_type || null,
    //                 fromNumber: from_number || null,
    //                 toNumber: to_number || null,
    //                 direction: direction || null,
    //                 date: todayString,
    //                 address: retell_llm_dynamic_variables?.user_address || null,
    //                 dial_status: callStatus,
    //                 callSummary: call_analysis.call_summary || null,
    //                 userSentiment: sentimentStatus,
    //                 call_outcome: callOutcome || null,
    //             };
    //             await callHistoryModel.create(callData);
    //             if (fetch_client.name === "New Funding Solutions") {
    //                 if (call_transferred || is_call_scheduled) {
    //                     await this.call_webhook(call_id);
    //                 };
    //             };
    //             if (fetch_client.name === "Executive Strategy Group") {
    //                 const data = {
    //                     firstName: retell_llm_dynamic_variables.user_firstname || "",
    //                     lastName: retell_llm_dynamic_variables.user_lastname || "",
    //                     email: retell_llm_dynamic_variables.user_email || "",
    //                     phone: to_number,
    //                     transcript,
    //                     dateCalled: todayString,
    //                     outcome: callOutcome,
    //                     recordingUrl: recording_url || null,
    //                 };
    //                 const { custom_analysis_data } = call_analysis;
    //                 if (is_call_scheduled) {
    //                     const data_to_send = {
    //                         ...data,
    //                         contact_details: custom_analysis_data?.contact_details || null,
    //                         appointment_details: custom_analysis_data?.appointment_details || null,
    //                         type: "appointment_booking_successful"
    //                     };
    //                     console.log("data: ", data_to_send);
    //                     const result = await this.booking_trigger(fetch_client, data_to_send);
    //                     console.log("result: ", result);
    //                 };
    //                 if (custom_analysis_data?.appointment_booking_failed) {
    //                     const data_to_send = {
    //                         ...data,
    //                         contact_details: custom_analysis_data?.contact_details || null,
    //                         failure_reason: custom_analysis_data?.failure_reason || null,
    //                         type: "appointment_booking_failed"
    //                     };
    //                     console.log("data: ", data_to_send);
    //                     const result = await this.booking_trigger(fetch_client, data_to_send);
    //                     console.log("result: ", result);
    //                 };
    //                 if (custom_analysis_data?.appointment_booking_attempted) {
    //                     const data_to_send = {
    //                         ...data,
    //                         contact_details: custom_analysis_data?.contact_details || null,
    //                         appointment_details: custom_analysis_data?.appointment_details || null,
    //                         type: "appointment_booking_attempted"
    //                     };
    //                     console.log("data: ", data_to_send);
    //                     const result = await this.booking_trigger(fetch_client, data_to_send);
    //                     console.log("result: ", result);
    //                 };
    //             };
    //             const jobId = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id: null;
    //             const statResults = await DailyStatsModel.findOneAndUpdate(
    //                 { day: todayString, agentId: agent_id, jobProcessedBy: jobId },
    //                 statsUpdate,
    //                 { returnOriginal: false }
    //             );
    //             const timestamp = new Date();
    //             await updateStatsByHour(agent_id, todayString, timestamp);
    //             await contactModel.findOneAndUpdate(
    //                 { callId: call_id, agentId: agent_id },
    //                 {
    //                     dial_status: callStatus,
    //                     $push: {
    //                         datesCalled: todaysDateForDatesCalled
    //                     },
    //                     referenceToCallId: new_transcript._id,
    //                     timesCalled: time,
    //                     $inc: {
    //                         calledTimes: 1
    //                     },
    //                     linktocallLogModel: statResults?._id || null
    //                 }
    //             );
    //             if (call_analysis.call_successful === false && analyzedTranscriptForStatus.message.content === "interested") {
    //                 await axios.post(process.env.MAKE_URL, {
    //                     firstname: retell_llm_dynamic_variables.user_firstname,
    //                     lastname: retell_llm_dynamic_variables.user_lastname,
    //                     email: retell_llm_dynamic_variables.user_email,
    //                     phone: to_number,
    //                     summary: call_analysis.call_summary,
    //                     url: recording_url || null,
    //                     transcript: transcript,
    //                 });
    //             };
    //             console.log("call updated");
    //         } else {
    //             console.error("Event must be call analyzed: " + event);
    //         }
    //     } catch (e) {
    //         console.error("Error fetching data from call analyzed: " + e);
    //     };
    // };
    async call_analyzed(payload, todayString, todaysDateForDatesCalled, time) {
        try {
            const { event, call } = payload;
            const { agent_id, call_id, call_type, call_status, start_timestamp, end_timestamp, disconnection_reason, from_number, to_number, direction, transcript, duration_ms, recording_url, public_log_url, call_analysis, retell_llm_dynamic_variables, transcript_object, transcript_with_tool_calls } = call;
            const fetch_client = await userModel_1.userModel.findOne({ 'agents.agentId': agent_id });
            let analyzedTranscriptForStatus;
            let callStatus;
            let sentimentStatus;
            let callOutcome;
            let statsUpdate = { $inc: {} };
            let callError;
            function convertMsToHourMinSec(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            ;
            if (event === "call_analyzed") {
                console.log("inside analyzed function");
                console.log("call's direction is: ", direction);
                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
                const call_error = disconnection_reason === "error_inbound_webhook" || "error_llm_websocket_open" || "error_llm_websocket_lost_connection" || "error_llm_websocket_runtime" || "error_llm_websocket_corrupt_payload" || "error_frontend_corrupted_payload" || "error_twilio" || "error_no_audio_received" || "error_asr" || "error_retell" || "error_unknown" || "error_user_not_joined";
                analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(transcript);
                const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
                const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";
                const is_dnc = analyzedTranscriptForStatus.message.content === "dnc";
                const is_callback = analyzedTranscriptForStatus.message.content === "call-back";
                const is_neutral = call_analysis.user_sentiment === "Neutral";
                const is_unknown = call_analysis.user_sentiment === "Unknown";
                const is_positive = call_analysis.user_sentiment === "Positive";
                const is_negative = call_analysis.user_sentiment === "Negative";
                const call_back_date = await (0, transcript_review_1.reviewCallback)(transcript);
                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;
                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;
                const was_answered = is_call_scheduled || call_transferred || call_hangedup;
                if (was_answered) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                }
                ;
                if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    sentimentStatus = types_1.callSentimentenum.SCHEDULED;
                    callOutcome = types_1.calloutcome.SCHEDULED;
                    callStatus = types_1.callstatusenum.SCHEDULED;
                }
                else if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = types_1.callstatusenum.VOICEMAIL;
                }
                else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = types_1.callstatusenum.IVR;
                }
                else if (is_dnc) {
                    sentimentStatus = types_1.callSentimentenum.DNC;
                    callOutcome = types_1.calloutcome.DNC;
                }
                else if (is_callback) {
                    sentimentStatus = types_1.callSentimentenum.CALLBACK;
                }
                ;
                if (!callStatus) {
                    if (call_failed) {
                        statsUpdate.$inc.totalFailed = 1;
                        callStatus = types_1.callstatusenum.FAILED;
                        callOutcome = types_1.calloutcome.FAILED;
                    }
                    else if (call_transferred) {
                        statsUpdate.$inc.totalTransffered = 1;
                        callStatus = types_1.callstatusenum.TRANSFERRED;
                        callOutcome = types_1.calloutcome.TRANSFERRED;
                    }
                    else if (dial_no_answer) {
                        statsUpdate.$inc.totalDialNoAnswer = 1;
                        callStatus = types_1.callstatusenum.NO_ANSWER;
                    }
                    else if (call_inactivity) {
                        statsUpdate.$inc.totalCallInactivity = 1;
                        callStatus = types_1.callstatusenum.INACTIVITY;
                    }
                    else if (call_hangedup) {
                        callStatus = types_1.callstatusenum.CALLED;
                        callOutcome = types_1.calloutcome.SUCCESS;
                    }
                    else if (call_error) {
                        callError = types_1.callstatusenum.ERROR;
                    }
                    ;
                }
                ;
                if (!sentimentStatus) {
                    if (is_neutral) {
                        sentimentStatus = types_1.callSentimentenum.NEUTRAL;
                    }
                    else if (is_positive) {
                        sentimentStatus = types_1.callSentimentenum.POSITIVE;
                    }
                    else if (is_negative) {
                        sentimentStatus = types_1.callSentimentenum.NEGATIVE;
                    }
                    else if (is_unknown) {
                        sentimentStatus = types_1.callSentimentenum.UNKNOWN;
                    }
                    ;
                }
                ;
                // let callError;
                // if (is_machine) {
                //     statsUpdate.$inc.totalAnsweredByVm = 1;
                //     callStatus = callstatusenum.VOICEMAIL;
                // } else if (is_ivr) {
                //     statsUpdate.$inc.totalAnsweredByIVR = 1;
                //     callStatus = callstatusenum.IVR;
                // } else if (is_call_scheduled) {
                //     statsUpdate.$inc.totalAppointment = 1;
                //     callStatus = callstatusenum.SCHEDULED;
                // } else if (call_failed) {
                //     statsUpdate.$inc.totalFailed = 1;
                //     callStatus = callstatusenum.FAILED;
                //     callOutcome = calloutcome.FAILED;
                // } else if (call_transferred) {
                //     statsUpdate.$inc.totalTransffered = 1;
                //     callStatus = callstatusenum.TRANSFERRED;
                //     callOutcome = calloutcome.TRANSFERRED
                // } else if (dial_no_answer) {
                //     statsUpdate.$inc.totalDialNoAnswer = 1;
                //     callStatus = callstatusenum.NO_ANSWER;
                // } else if (call_inactivity) {
                //     statsUpdate.$inc.totalCallInactivity = 1;
                //     callStatus = callstatusenum.INACTIVITY;
                // } else if (call_hangedup) {
                //     statsUpdate.$inc.totalCallAnswered = 1;
                //     callStatus = callstatusenum.CALLED;
                //     callOutcome = calloutcome.SUCCESS;
                // } else if (call_error) {
                //     callError = callstatusenum.ERROR;
                // };
                // if (is_call_scheduled) {
                //     sentimentStatus = callSentimentenum.SCHEDULED;
                //     callOutcome = calloutcome.SCHEDULED;
                // } else if (is_callback) {
                //     sentimentStatus = callSentimentenum.CALLBACK;
                // } else if (is_dnc) {
                //     sentimentStatus = callSentimentenum.DNC;
                //     callOutcome = calloutcome.DNC;
                // } else if (is_neutral) {
                //     sentimentStatus = callSentimentenum.NEUTRAL;
                // } else if (is_positive) {
                //     sentimentStatus = callSentimentenum.POSITIVE;
                // } else if (is_negative) {
                //     sentimentStatus = callSentimentenum.NEGATIVE;
                // } else if (is_unknown) {
                //     sentimentStatus = callSentimentenum.UNKNOWN;
                // };
                const new_transcript = await contact_model_1.EventModel.create(Object.assign(Object.assign({ callId: call_id, agentId: agent_id, recordingUrl: recording_url, callDuration: duration_in_HMS, disconnectionReason: disconnection_reason, callBackDate: call_back_date, retellCallStatus: call_status, duration: total_duration, timestamp: end_timestamp }, (transcript && { transcript })), { retellCallSummary: call_analysis.call_summary, analyzedTranscript: sentimentStatus, userSentiment: sentimentStatus }));
                const callData = {
                    callId: call_id,
                    agentId: agent_id,
                    userFirstname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_firstname) || null,
                    userLastname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_lastname) || null,
                    userEmail: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_email) || null,
                    recordingUrl: recording_url || null,
                    disconnectionReason: disconnection_reason || callError || null,
                    callStatus: call_status,
                    startTimestamp: start_timestamp || null,
                    endTimestamp: end_timestamp || null,
                    durationMs: total_duration,
                    transcript: transcript || null,
                    transcriptObject: transcript_object || [],
                    transcriptWithToolCalls: transcript_with_tool_calls || [],
                    publicLogUrl: public_log_url || null,
                    callType: call_type || null,
                    fromNumber: from_number || null,
                    toNumber: to_number || null,
                    direction: direction || null,
                    date: todayString,
                    address: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_address) || null,
                    dial_status: callStatus,
                    callSummary: call_analysis.call_summary || null,
                    userSentiment: sentimentStatus,
                    call_outcome: callOutcome || null,
                };
                await historyModel_1.default.create(callData);
                if (fetch_client.name === "New Funding Solutions") {
                    if (call_transferred || is_call_scheduled) {
                        await this.call_webhook(call_id);
                    }
                    ;
                }
                ;
                if (fetch_client.name === "Executive Strategy Group") {
                    const data = {
                        firstName: retell_llm_dynamic_variables.user_firstname || "",
                        lastName: retell_llm_dynamic_variables.user_lastname || "",
                        email: retell_llm_dynamic_variables.user_email || "",
                        phone: to_number,
                        transcript,
                        dateCalled: todayString,
                        outcome: callOutcome,
                        recordingUrl: recording_url || null,
                    };
                    const { custom_analysis_data } = call_analysis;
                    if (is_call_scheduled) {
                        const data_to_send = Object.assign(Object.assign({}, data), { contact_details: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.contact_details) || null, appointment_details: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.appointment_details) || null, type: "appointment_booking_successful" });
                        console.log("data: ", data_to_send);
                        const result = await this.booking_trigger(fetch_client, data_to_send);
                        console.log("result: ", result);
                    }
                    ;
                    if (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.appointment_booking_failed) {
                        const data_to_send = Object.assign(Object.assign({}, data), { contact_details: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.contact_details) || null, failure_reason: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.failure_reason) || null, type: "appointment_booking_failed" });
                        console.log("data: ", data_to_send);
                        const result = await this.booking_trigger(fetch_client, data_to_send);
                        console.log("result: ", result);
                    }
                    ;
                    if (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.appointment_booking_attempted) {
                        const data_to_send = Object.assign(Object.assign({}, data), { contact_details: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.contact_details) || null, appointment_details: (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.appointment_details) || null, type: "appointment_booking_attempted" });
                        console.log("data: ", data_to_send);
                        const result = await this.booking_trigger(fetch_client, data_to_send);
                        console.log("result: ", result);
                    }
                    ;
                }
                ;
                const jobId = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id : null;
                const statResults = await logModel_1.DailyStatsModel.findOneAndUpdate({ day: todayString, agentId: agent_id, jobProcessedBy: jobId }, statsUpdate, { returnOriginal: false });
                const timestamp = new Date();
                await (0, graphController_1.updateStatsByHour)(agent_id, todayString, timestamp);
                await contact_model_1.contactModel.findOneAndUpdate({ callId: call_id, agentId: agent_id }, {
                    dial_status: callStatus,
                    $push: {
                        datesCalled: todaysDateForDatesCalled
                    },
                    referenceToCallId: new_transcript._id,
                    timesCalled: time,
                    $inc: {
                        calledTimes: 1
                    },
                    linktocallLogModel: (statResults === null || statResults === void 0 ? void 0 : statResults._id) || null
                });
                if (call_analysis.call_successful === false && analyzedTranscriptForStatus.message.content === "interested") {
                    await axios_1.default.post(process.env.MAKE_URL, {
                        firstname: retell_llm_dynamic_variables.user_firstname,
                        lastname: retell_llm_dynamic_variables.user_lastname,
                        email: retell_llm_dynamic_variables.user_email,
                        phone: to_number,
                        summary: call_analysis.call_summary,
                        url: recording_url || null,
                        transcript: transcript,
                    });
                }
                ;
                console.log("call updated");
            }
            else {
                console.error("Event must be call analyzed: " + event);
            }
        }
        catch (e) {
            console.error("Error fetching data from call analyzed: " + e);
        }
        ;
    }
    ;
    async cancel_schedule(req, res, next) {
        try {
            const body = req.body;
            const { error } = call_1.CancelScheduleSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const { jobId } = body;
            const job = await contact_model_1.jobModel.findOne({ jobId });
            if (!job)
                return res.status(400).json({ message: `Job with JobId: ${jobId} not found` });
            const { agentId, tagProcessedFor } = job;
            const update_contacts = await contact_model_1.contactModel.updateMany({
                agentId,
                tag: tagProcessedFor,
                isTaken: true,
                isDeleted: false
            }, { isTaken: false });
            console.log("cont_update: ", update_contacts);
            if (!update_contacts.acknowledged)
                return res.status(400).json({ message: "Failed to update contacts isTaken to false" });
            const scheduledJobs = node_schedule_1.default.scheduledJobs;
            console.log("scheudles: ", scheduledJobs);
            if (!scheduledJobs.hasOwnProperty(jobId)) {
                return res.status(404).json({ message: `Job with ${jobId} not found or has been executed` });
            }
            ;
            const isCancelled = node_schedule_1.default.cancelJob(jobId);
            if (isCancelled) {
                const update_job = await contact_model_1.jobModel.findOneAndUpdate({
                    jobId,
                    callstatus: {
                        $ne: "cancelled"
                    }
                }, {
                    callstatus: types_1.jobstatus.CANCELLED,
                    shouldContinueProcessing: false
                }, { new: true });
                console.log("update: ", update_job);
                if (!update_job)
                    return res.status(400).json({ message: "Error setting call status to cancelled" });
                res.status(200).json({ schedule_cancelled: update_job });
            }
            else {
                res.status(500).json({ message: `Unable to cancel job with JobId: ${jobId}` });
            }
            ;
        }
        catch (e) {
            console.error("Error cancelling schedule" + e);
            next(e);
        }
        ;
    }
    ;
    async getAffectedContacts(tags, page) {
        const callIds = await contact_model_1.contactModel.find({
            dial_status: "not-called",
            callId: {
                $exists: true
            },
            tag: {
                $in: tags
            },
            isDeleted: false
        }, { callId: 1 }).lean();
        const limit = 1000;
        const totalRecords = callIds.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const startIndex = (page - 1) * limit;
        console.log("records: ", totalRecords);
        console.log("pages: ", totalPages);
        const result = callIds.slice(startIndex, startIndex + limit);
        return result;
    }
    ;
    async fetchCallDetails(callId) {
        try {
            const retell_client = new retell_sdk_1.default({
                apiKey: process.env.RETELL_API_KEY
            });
            const get_call = await retell_client.call.retrieve(callId);
            return get_call;
        }
        catch (e) {
            console.error("Error fetching details for id: ", e);
        }
        ;
    }
    ;
    async resetJobStats(jobIds) {
        await logModel_1.DailyStatsModel.updateMany({ jobProcessedBy: { $in: jobIds } }, {
            $set: {
                totalCalls: 0,
                totalCallAnswered: 0,
                totalCallDuration: 0,
                totalCallInactivity: 0,
                totalTransffered: 0,
                totalFailed: 0,
                totalAppointment: 0,
                totalAnsweredByIVR: 0,
                totalAnsweredByVm: 0,
                totalDialNoAnswer: 0
            }
        });
        console.log(`reset stats for ${jobIds.length} jobIds`);
    }
    ;
    async correct_contacts(req, res, next) {
        try {
            const clientId = req.query.clientId;
            const check_client = await userModel_1.userModel.findById(clientId);
            if (!check_client)
                return res.status(500).json({ message: "clientId not found" });
            const { agents } = check_client;
            const agent = agents[0];
            // const tags = agent.tag;
            // tags.pop();
            const tags = [
                "insider-test-calls-7",
                "dme-first-200",
                "dme-second-200",
                "dme-reengagement-7138"
            ];
            const fetch_contacts = await this.getAffectedContacts(tags, 1);
            console.log("fetch: ", fetch_contacts.length);
            function convertMsToHourMinSec(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            ;
            // const jobIdsToReset = new Set();
            // const bulkUpdates = [];
            const calls = [];
            for (const contact of fetch_contacts) {
                const callData = await this.fetchCallDetails(contact.callId);
                if (!callData)
                    continue;
                const { call_id, disconnection_reason, transcript, retell_llm_dynamic_variables, recording_url, call_status, start_timestamp, end_timestamp, transcript_object, transcript_with_tool_calls, public_log_url, call_type, call_analysis } = callData;
                const duration_ms = callData.duration_ms;
                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
                const is_machine = disconnection_reason === "voicemail_reached";
                const analyzedTranscript = await (0, transcript_review_1.reviewTranscript)(transcript);
                const is_call_scheduled = analyzedTranscript.message.content === "scheduled";
                // const is_machine = analyzedTranscript.message.content === "voicemail";
                const is_ivr = analyzedTranscript.message.content === "ivr";
                calls.push(callData);
                console.log("call: ", callData);
                let callStatus;
                let statsUpdate = { $inc: {} };
                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;
                if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = types_1.callstatusenum.VOICEMAIL;
                }
                else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = types_1.callstatusenum.IVR;
                }
                else if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = types_1.callstatusenum.SCHEDULED;
                }
                else if (call_failed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = types_1.callstatusenum.FAILED;
                }
                else if (call_transferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = types_1.callstatusenum.TRANSFERRED;
                }
                else if (dial_no_answer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = types_1.callstatusenum.NO_ANSWER;
                }
                else if (call_inactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = types_1.callstatusenum.INACTIVITY;
                }
                else if (call_hangedup) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = types_1.callstatusenum.CALLED;
                }
                ;
                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp || 0);
                await contact_model_1.EventModel.findOneAndUpdate({ callId: call_id }, {
                    transcript,
                    recordingUrl: recording_url,
                    retellCallSummary: call_analysis.call_summary,
                    userSentiment: callStatus,
                    disconnectionReason: disconnection_reason,
                    analyzedTranscript: callStatus,
                    callDuration: duration_in_HMS,
                    retellCallStatus: call_status,
                    // duration: to
                });
                // jobIdsToReset.add(retell_llm_dynamic_variables.job_id);
            }
            ;
            // console.log("joIds: ", jobIdsToReset);
            console.log("finished batch: ", calls.length);
        }
        catch (e) {
            console.error("Error correcting contacts: " + e);
            next(e);
        }
        ;
    }
    ;
    async call_webhook(callId) {
        try {
            console.log("in here with callId: ", callId);
            const fetch_details = await contact_model_1.contactModel.findOne({ callId });
            if (!fetch_details)
                return console.error("No details found for callId: ", callId);
            console.log("retell details: ", fetch_details);
            const { firstname, lastname, address, city, state, zipCode, phone, sid, oid, employmentStatus, creditEstimate, email } = fetch_details;
            const fetch_transcript = await contact_model_1.EventModel.findOne({ callId });
            console.log("transcript details: ", fetch_transcript);
            const RETELL_KEY = process.env.RETELL_API_KEY;
            const options = {
                method: "GET",
                url: `https://api.retellai.com/v2/get-call/${callId}`,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RETELL_KEY}`
                }
            };
            const call_response = await (0, axios_1.default)(options);
            const call_deets = call_response.data;
            const { custom_analysis_data } = call_deets.call_analysis;
            const debtAmount = (custom_analysis_data === null || custom_analysis_data === void 0 ? void 0 : custom_analysis_data.user_total_unsecured_debt) || null;
            const recordingUrl = (fetch_transcript === null || fetch_transcript === void 0 ? void 0 : fetch_transcript.recordingUrl) || "";
            const body_to_send = {
                pFname: firstname,
                pLname: lastname,
                pAddress: address,
                pCity: city,
                pState: state,
                pZipCode: zipCode,
                pHomePhone: phone,
                pSID: sid,
                pOID: oid,
                pRecordingUrl: recordingUrl,
                pEmploymentStatus: employmentStatus,
                pEmail: email,
                pDebtAmount: debtAmount
            };
            console.log("body_to_send: ", body_to_send);
            const response = await axios_1.default.post(`https://hook.us1.make.com/ctp3cls3ctgbx1p252wfmmojcsxhpeso`, body_to_send);
            const result = response.data;
            console.log("make result: ", result);
            return result;
        }
        catch (e) {
            console.error("Error with call webhook: " + e);
        }
        ;
    }
    ;
    async inbound_call_webhook(req, res, next) {
        try {
            const payload = req.body;
            const { event, call_inbound } = payload;
            console.log("Inside inbound webhook data: ", event);
            const todays = new Date();
            todays.setHours(0, 0, 0, 0);
            const todayString = todays.toISOString().split("T")[0];
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const hours = String(today.getHours()).padStart(2, "0");
            const minutes = String(today.getMinutes()).padStart(2, "0");
            const todayStringWithTime = `${year}-${month}-${day}`;
            const time = `${hours}: ${minutes}`;
            if (event === "call_inbound") {
                console.log("inside the call_inbound event: ", call_inbound);
                return res.status(200).json({
                    call_inbound: {}
                });
            }
            else if (event === "call_started") {
                console.log("inbound call started event: ", call_inbound);
                await this.call_started(payload);
            }
            else if (event === "call_ended") {
                console.log("inbound call ended event: ", call_inbound);
            }
            else if (event === "call_analyzed") {
                console.log("inbound call analyzed event: ", call_inbound);
                await this.call_analyzed(payload, todayString, todayStringWithTime, time);
            }
            else {
                return res.status(500).json({
                    error: "Invalid event detected",
                    event_gotten: event
                });
            }
            ;
        }
        catch (e) {
            console.error("Error with incoming call webhook: " + e);
            next(e);
        }
        ;
    }
    ;
    async call_outcome_script(req, res, next) {
        try {
            const agentId = req.query.agentId;
            const outcome = req.query.outcome;
            let callOutcome;
            let query = {
                agentId,
                call_outcome: { $exists: false }
            };
            switch (outcome) {
                case (types_1.calloutcome.SCHEDULED):
                    query.userSentiment = types_1.callSentimentenum.SCHEDULED;
                    callOutcome = types_1.calloutcome.SCHEDULED;
                    break;
                case (types_1.calloutcome.SUCCESS):
                    query.disconnectionReason = { $in: ["user_hangup", "agent_hangup"] };
                    query.userSentiment = { $ne: types_1.callSentimentenum.DNC };
                    callOutcome = types_1.calloutcome.SUCCESS;
                    break;
                case (types_1.calloutcome.FAILED):
                    query.disconnectionReason = "dial_failed";
                    callOutcome = types_1.calloutcome.FAILED;
                    break;
                case (types_1.calloutcome.TRANSFERRED):
                    query.disconnectionReason = "call_transfer";
                    callOutcome = types_1.calloutcome.TRANSFERRED;
                    break;
                case (types_1.calloutcome.DNC):
                    query.userSentiment = types_1.callSentimentenum.DNC;
                    callOutcome = types_1.calloutcome.DNC;
                    break;
                // case (calloutcome.WRONG_NUMBER):
            }
            ;
            if (!callOutcome)
                return res.status(400).json({ message: "Invalid outcome" });
            console.log("query: ", query);
            console.log("outcome: ", outcome);
            console.log("callOutcome: ", callOutcome);
            const updateOutcome = await historyModel_1.default.updateMany(query, {
                $set: {
                    call_outcome: callOutcome
                }
            });
            console.log("updateOutcome: ", updateOutcome);
            if (!updateOutcome.acknowledged)
                return res.status(500).json({ message: "Unable to update call outcome" });
            return res.status(200).json({
                success: true,
                message: `Call histories updated to ${outcome}`,
                result: updateOutcome
            });
        }
        catch (e) {
            console.error("Error with call outcome script: " + e);
            next(e);
        }
        ;
    }
    ;
    async booking_trigger(client, data) {
        try {
            const { name, autoEmail, email } = client;
            const cmail = autoEmail ? autoEmail : email;
            const body_to_send = Object.assign(Object.assign({}, data), { cName: name, cMail: [cmail] });
            console.log("body_to_send: ", body_to_send);
            const response = await axios_1.default.post("https://hook.us1.make.com/f7ehb6rgll8ofebqn8h3vx4p7bowhp27", body_to_send);
            const result = response.data;
            return result;
        }
        catch (e) {
            console.error("Error triggering make for a booking attempt: " + e);
        }
        ;
    }
    ;
    async update_history(req, res, next) {
        var _a, _b, _c, _d;
        try {
            const { jobId, todayString, time } = req.body;
            // const retellClient = new Retell({
            //     apiKey: process.env.RETELL_API_KEY
            // });
            const contacts = await contact_model_1.contactModel.find({
                jobProcessedWithId: jobId
            }).limit(1000);
            function convertMsToHourMinSec(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            ;
            for (const contact of contacts) {
                const RETELL_KEY = process.env.RETELL_API_KEY;
                const options = {
                    method: "GET",
                    url: `https://api.retellai.com/v2/get-call/${contact.callId}`,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${RETELL_KEY}`
                    }
                };
                const call_response = await (0, axios_1.default)(options);
                const result = call_response.data;
                // const result = await retellClient.call.retrieve(contact.callId as string);
                const call_failed = result.disconnection_reason === "dial_failed";
                const call_transferred = result.disconnection_reason === "call_transfer";
                const dial_no_answer = result.disconnection_reason === "dial_no_answer";
                const call_inactivity = result.disconnection_reason === 'inactivity';
                const call_hangedup = result.disconnection_reason === "user_hangup" || result.disconnection_reason === "agent_hangup";
                const call_error = result.disconnection_reason === "error_inbound_webhook" || "error_llm_websocket_open" || "error_llm_websocket_lost_connection" || "error_llm_websocket_runtime" || "error_llm_websocket_corrupt_payload" || "error_frontend_corrupted_payload" || "error_twilio" || "error_no_audio_received" || "error_asr" || "error_retell" || "error_unknown" || "error_user_not_joined";
                const analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(result.transcript);
                const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
                const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";
                const is_dnc = analyzedTranscriptForStatus.message.content === "dnc";
                const is_callback = analyzedTranscriptForStatus.message.content === "call-back";
                const is_neutral = result.call_analysis.user_sentiment === "Neutral";
                const is_unknown = result.call_analysis.user_sentiment === "Unknown";
                const is_positive = result.call_analysis.user_sentiment === "Positive";
                const is_negative = result.call_analysis.user_sentiment === "Negative";
                const call_back_date = await (0, transcript_review_1.reviewCallback)(result.transcript);
                const duration_in_HMS = convertMsToHourMinSec(result.duration_ms);
                const total_duration = convertMsToHourMinSec(result.end_timestamp - result.start_timestamp) || 0;
                let callStatus;
                let callOutcome;
                let sentimentStatus;
                let statsUpdate = { $inc: {} };
                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = result.duration_ms;
                let callError;
                if (is_machine) {
                    callStatus = types_1.callstatusenum.VOICEMAIL;
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                }
                else if (is_ivr) {
                    callStatus = types_1.callstatusenum.IVR;
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                }
                else if (is_call_scheduled) {
                    callStatus = types_1.callstatusenum.SCHEDULED;
                    statsUpdate.$inc.totalAppointment = 1;
                }
                else if (call_failed) {
                    callStatus = types_1.callstatusenum.FAILED;
                    callOutcome = types_1.calloutcome.FAILED;
                    statsUpdate.$inc.totalFailed = 1;
                }
                else if (call_transferred) {
                    callStatus = types_1.callstatusenum.TRANSFERRED;
                    callOutcome = types_1.calloutcome.TRANSFERRED;
                    statsUpdate.$inc.totalTransffered = 1;
                }
                else if (dial_no_answer) {
                    callStatus = types_1.callstatusenum.NO_ANSWER;
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                }
                else if (call_inactivity) {
                    callStatus = types_1.callstatusenum.INACTIVITY;
                    statsUpdate.$inc.totalCallInactivity = 1;
                }
                else if (call_hangedup) {
                    callStatus = types_1.callstatusenum.CALLED;
                    callOutcome = types_1.calloutcome.SUCCESS;
                    statsUpdate.$inc.totalCallAnswered = 1;
                }
                else if (call_error) {
                    callError = types_1.callstatusenum.ERROR;
                }
                ;
                if (is_call_scheduled) {
                    sentimentStatus = types_1.callSentimentenum.SCHEDULED;
                    callOutcome = types_1.calloutcome.SCHEDULED;
                }
                else if (is_callback) {
                    sentimentStatus = types_1.callSentimentenum.CALLBACK;
                }
                else if (is_dnc) {
                    sentimentStatus = types_1.callSentimentenum.DNC;
                    callOutcome = types_1.calloutcome.DNC;
                }
                else if (is_neutral) {
                    sentimentStatus = types_1.callSentimentenum.NEUTRAL;
                }
                else if (is_positive) {
                    sentimentStatus = types_1.callSentimentenum.POSITIVE;
                }
                else if (is_negative) {
                    sentimentStatus = types_1.callSentimentenum.NEGATIVE;
                }
                else if (is_unknown) {
                    sentimentStatus = types_1.callSentimentenum.UNKNOWN;
                }
                ;
                const new_transcript = await contact_model_1.EventModel.create(Object.assign(Object.assign({ callId: result.call_id, agentId: result.agent_id, recordingUrl: result.recording_url, callDuration: duration_in_HMS, disconnectionReason: result.disconnection_reason, callBackDate: call_back_date, retellCallStatus: result.call_status, duration: total_duration, timestamp: result.end_timestamp }, (result.transcript && { transcript: result.transcript })), { retellCallSummary: result.call_analysis.call_summary, analyzedTranscript: sentimentStatus, userSentiment: sentimentStatus }));
                const callData = {
                    callId: result.call_id,
                    agentId: result.agent_id,
                    userFirstname: ((_a = result.retell_llm_dynamic_variables) === null || _a === void 0 ? void 0 : _a.user_firstname) || null,
                    userLastname: ((_b = result.retell_llm_dynamic_variables) === null || _b === void 0 ? void 0 : _b.user_lastname) || null,
                    userEmail: ((_c = result.retell_llm_dynamic_variables) === null || _c === void 0 ? void 0 : _c.user_email) || null,
                    recordingUrl: result.recording_url || null,
                    disconnectionReason: result.disconnection_reason || call_error || null,
                    callStatus: result.call_status,
                    startTimestamp: result.start_timestamp || null,
                    endTimestamp: result.end_timestamp || null,
                    durationMs: total_duration,
                    transcript: result.transcript || null,
                    transcriptObject: result.transcript_object || [],
                    transcriptWithToolCalls: result.transcript_with_tool_calls || [],
                    publicLogUrl: result.public_log_url || null,
                    callType: result.call_type || null,
                    fromNumber: result.from_number || null,
                    toNumber: result.to_number || null,
                    direction: result.direction || null,
                    date: todayString,
                    address: ((_d = result.retell_llm_dynamic_variables) === null || _d === void 0 ? void 0 : _d.user_address) || null,
                    dial_status: callStatus,
                    callSummary: result.call_analysis.call_summary || null,
                    userSentiment: sentimentStatus,
                    call_outcome: callOutcome || null
                };
                await historyModel_1.default.create(callData);
                const statResults = await logModel_1.DailyStatsModel.findOneAndUpdate({ day: todayString, agentId: result.agent_id, jobProcessedBy: jobId }, statsUpdate, { returnOriginal: false });
                const timestamp = new Date();
                await (0, graphController_1.updateStatsByHour)(result.agent_id, todayString, timestamp);
                await contact_model_1.contactModel.findOneAndUpdate({ callId: result.call_id, agentId: result.agent_id }, {
                    dial_status: callStatus,
                    $push: {
                        datesCalled: todayString
                    },
                    referenceToCallId: new_transcript._id,
                    timesCalled: time,
                    $inc: {
                        calledTimes: 1
                    },
                    linktocallLogModel: (statResults === null || statResults === void 0 ? void 0 : statResults._id) || null
                });
                if (result.call_analysis.call_successful === false && analyzedTranscriptForStatus.message.content === "interested") {
                    await axios_1.default.post(process.env.MAKE_URL, {
                        firstname: result.retell_llm_dynamic_variables.user_firstname,
                        lastname: result.retell_llm_dynamic_variables.user_lastname,
                        email: result.retell_llm_dynamic_variables.user_email,
                        phone: result.to_number,
                        summary: result.call_analysis.call_summary,
                        url: result.recording_url || null,
                        transcript: result.transcript,
                    });
                }
                ;
                console.log("call updated for callId: ", result.call_id);
            }
            ;
            res.status(200).json({
                success: true,
                message: "Call history updated successfully",
                updatedCount: contacts.length
            });
        }
        catch (e) {
            console.error("Error updating call history: " + e);
            next(e);
        }
        ;
    }
}
;
exports.call_service = new CallService();
