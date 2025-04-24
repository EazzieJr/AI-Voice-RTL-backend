import { contactModel, EventModel, jobModel } from "../models/contact_model";
import RootService from "./_root";
import { Request, Response, NextFunction } from "express";
import { callSentimentenum, callstatusenum, jobstatus } from "../utils/types";
import { reviewCallback, reviewTranscript } from "../utils/transcript-review";
import callHistoryModel from "../models/historyModel";
import { DailyStatsModel } from "../models/logModel";
import { updateStatsByHour } from "../controllers/graphController";
import axios from "axios";
import { AuthRequest } from "../middleware/authRequest";
import { CancelScheduleSchema, ScheduleCallSchema } from "../validations/call";
import moment from "moment-timezone";
import { scheduleCronJob } from "../utils/scheduleJob";
import schedule from "node-schedule";
import { DateTime } from "luxon";
import Retell from "retell-sdk";
import { userModel } from "../models/userModel";
import { limits } from "argon2";
import { url } from "inspector";

class CallService extends RootService {

    async fetch_minutes(agentId: string, next: NextFunction) {
        try {
            const now = DateTime.now().setZone("America/Los_Angeles");
            const startOfMonth = now.startOf("month");
            const todayDate = now.startOf("day");

            const monthDates: string[] = [];
            let currentDate = startOfMonth;

            while (currentDate <= todayDate) {
                monthDates.push(currentDate.toFormat("yyyy-MM-dd"));

                currentDate = currentDate.plus({ days: 1 });
            };

            console.log("month dates: ", monthDates);
            const duration = await DailyStatsModel.aggregate([
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

            const milliseconds = duration[0]?.total_duration || 0;

            const minutes = Math.floor(milliseconds / 60000);
            console.log("minutes: ", minutes);

            return minutes;

        } catch (e) {
            console.error("Error fetching minutes: ", e);
            next(e);
        };
    };

    async schedule_call(req: Request, res: Response, next: NextFunction): Promise<Response>{
        try {
            const body = req.body;

            const { error } = ScheduleCallSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const { hour, minute, agentId, limit, fromNumber, tag } = req.body

            const scheduledTimePST = moment
                .tz("America/Los_Angeles")
                .set({
                    hour,
                    minute,
                    second: 0,
                    millisecond: 0
                })
                .toDate();

            const formattedDate = moment(scheduledTimePST).format("YYYY-MM-DDTHH:mm:ss");

            const currentDate = DateTime.now().setZone("America/Los_Angeles").toISO();

            if (formattedDate <= currentDate) return res.status(400).json({ message: "Date and time has to be in the future" });

            const lowerCaseTag = tag.toLowerCase();

            const minutes = await this.fetch_minutes(agentId, next) as number;
            
            if (minutes >= 5000) {
                return res.status(400).json({ message: "Quota of 5000 minutes has been reached" });
            } else if (minutes >= 4500) {
                // trigger notification
                console.log("Minutes quota has exceeded 4500 minutes");
            };

            const call_schedule = await scheduleCronJob(
                scheduledTimePST,
                agentId,
                limit,
                fromNumber,
                formattedDate,
                lowerCaseTag,
                res,
                next
            );

            return res.status(200).json({
                call_schedule
            });

        } catch (e) {
            console.error("Error scheduling call: " + e);
            next(e);
        };
    };

    async retell_webhook(req: Request, res: Response, next: NextFunction): Promise<Response>{
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
            } else if (event === "call_ended") {
                console.log("call_ended here");
                // await this.call_ended(payload, todayString, todayStringWithTime, time);
            } else if (event === "call_analyzed") {
                // console.log("call analyzed: ", payload);
                await this.call_analyzed(payload, todayString, todayStringWithTime, time);
            } else {
                return res.status(500).json({ 
                    error: "Invalid event detected",
                    event_gotten: event
                });
            };

            // console.log("pay: ", payload);
            return res.status(200).send("webhook hit");

        } catch (e) {
            console.error("Error while accessing webhook from retell: " + e);
            next(e);
        };
    };

    async call_started(payload: any) {
        try {
            const { event, call } = payload;
            // console.log("data: ", payload);

            if (event === "call_started") {
                const { call_id, agent_id } = call;
                
                await contactModel.updateOne(
                    { callId: call_id, agentId: agent_id },
                    { $set: { dial_status: callstatusenum.IN_PROGRESS } }
                );

                // console.log("call started for: ", call_id);

            } else {
                console.error("Event must be call_started: ", event);
            };    

        } catch (e) {
            console.error("Unable to get data from started call: " + e);
            // next(e);
        };
    };

    async call_ended(payload: any, todayString: string, todaysDateForDatesCalled: any, time: any) {
        try {
            // console.log("payload: ", payload);
            const { event, call, data } = payload;
            const {
                call_type,
                call_id,
                start_timestamp,
                end_timestamp,
                transcript,
                disconnection_reason,
                recording_url,
                public_log_url,
                retell_llm_dynamic_variables,
                from_number,
                to_number,
                direction,
                call_status
            } = data;

            const { agent_id, duration_ms } = call;

            let analyzedTranscriptForStatus;
            let callStatus;
            let statsUpdate: any = { $inc: {} };

            function convertMsToHourMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;

                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            };

            if (event === "call_ended") {

                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
                analyzedTranscriptForStatus = await reviewTranscript(transcript);
                const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
                const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";

                const call_back_date = await reviewCallback(transcript);

                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;

                const call_ended_updated_data = {
                    callId: call_id,
                    agentId: agent_id,
                    recordingUrl: recording_url,
                    callDuration: duration_in_HMS,
                    disconnectionReason: disconnection_reason,
                    callBackDate: call_back_date,
                    retellCallStatus: call_status,
                    duration: total_duration,
                    timestamp: end_timestamp,
                    ...(transcript && { transcript }),
                };

                const transcript_data = await EventModel.create(call_ended_updated_data);

                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;
        
                if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = callstatusenum.VOICEMAIL;
                } else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = callstatusenum.IVR;
                } else if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = callstatusenum.SCHEDULED;
                } else if (call_failed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = callstatusenum.FAILED;
                } else if (call_transferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = callstatusenum.TRANSFERRED;
                } else if (dial_no_answer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = callstatusenum.NO_ANSWER;
                } else if (call_inactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = callstatusenum.INACTIVITY;
                } else if (call_hangedup) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = callstatusenum.CALLED;
                };

                const callData = {
                    callId: call_id,
                    agentId: agent_id,
                    userFirstname: retell_llm_dynamic_variables?.user_firstname || null,
                    userLastname: retell_llm_dynamic_variables?.user_lastname || null,
                    userEmail: retell_llm_dynamic_variables?.user_email || null,
                    recordingUrl: recording_url || null,
                    disconnectionReason: disconnection_reason || null,
                    callStatus: call_status,
                    startTimestamp: start_timestamp || null,
                    endTimestamp: end_timestamp || null,
                    durationMs: total_duration,
                    transcript: transcript || null,
                    transcriptObject: data.transcript_object || [],
                    transcriptWithToolCalls:
                        payload.data.transcript_with_tool_calls || [],
                    publicLogUrl: public_log_url || null,
                    callType: call_type || null,
                    // customAnalysisData:
                    //     event === "call_analyzed" ? call_analysis : null,
                    fromNumber: from_number || null,
                    toNumber: to_number || null,
                    direction: direction || null,
                    date: todayString,
                    address: retell_llm_dynamic_variables?.user_address || null,
                    dial_status: callStatus,
                };

                await callHistoryModel.create(callData);

                const jobId_from_retell = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id : null;

                let statResults;

                statResults = await DailyStatsModel.findOneAndUpdate(
                    { day: todayString, agentId: agent_id, jobProcessedBy: jobId_from_retell },
                    statsUpdate,
                    { returnOriginal: false }
                );

                const timestamp = new Date();

                await updateStatsByHour(agent_id, todayString, timestamp);

                const updateData: any = {
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
                } else {
                    console.log("stat: ", statResults);
                };

                await contactModel.findOneAndUpdate(
                    { callId: call_id, agentId: agent_id },
                    { $set: updateData }
                );

                // console.log("call ended for: ", call_id);
                
            } else {
                console.error("Event must be call_ended: ", event);
            };

        } catch (e) {
            console.error("Unable to get data from call ended: " + e);
            // next(e);
        };
    };

    // async call_analyzed(payload: any) {
    //     try {
    //         console.log("call_analyzed: ", payload);
    //         const { event, data, call } = payload;
    //         // console.log("pay: ", payload);

    //         const { transcript, call_analysis, retell_llm_dynamic_variables, recording_url } = data;
    //         const { agent_id, call_id, to_number } = call;

    //         if (event === "call_analyzed") {
    //             let analyzedTranscriptForSentiment;
    //             let sentimentStatus;

    //             analyzedTranscriptForSentiment = await reviewTranscript(transcript);

    //             const is_scheduled = analyzedTranscriptForSentiment.message.content === "scheduled";
    //             const is_dnc = analyzedTranscriptForSentiment.message.content === "dnc";
    //             const is_callback = analyzedTranscriptForSentiment.message.content === "call-back";
    //             const is_neutral = data.call_analysis.user_sentiment === "Neutral";
    //             const is_unknown = data.call_analysis.user_sentiment === "Unknown";
    //             const is_positive = data.call_analysis.user_sentiment === "Positive";
    //             const is_negative = data.call_analysis.user_sentiment === "Negative";

    //             let addressStat;
    //             if (agent_id === "") {
    //                 addressStat = call_analysis.address;
    //             };
                
    //             if (is_scheduled) {
    //                 sentimentStatus = callSentimentenum.SCHEDULED;
    //             } else if (is_callback) {
    //                 sentimentStatus = callSentimentenum.CALLBACK;
    //             } else if (is_dnc) {
    //                 sentimentStatus = callSentimentenum.DNC;
    //             } else if (is_neutral) {
    //                 sentimentStatus = callSentimentenum.NEUTRAL;
    //             } else if (is_positive) {
    //                 sentimentStatus = callSentimentenum.POSITIVE;
    //             } else if (is_negative) {
    //                 sentimentStatus = callSentimentenum.NEGATIVE;
    //             } else if (is_unknown) {
    //                 sentimentStatus = callSentimentenum.UNKNOWN;
    //             };
    //             // console.log("senti: ", sentimentStatus);

    //             const event_data_to_update = {
    //                 retellCallSummary: call_analysis.call_summary,
    //                 analyzedTranscript: sentimentStatus,
    //                 userSentiment: sentimentStatus
    //             };

    //             const results = await EventModel.findOneAndUpdate(
    //                 { callId: call_id, agentId: agent_id },
    //                 { $set: event_data_to_update },
    //                 { returnOriginal: false }
    //             );

    //             // console.log("res: ", results);

    //             const data2 = {
    //                 callSummary: call_analysis.call_summary,
    //                 userSentiment: sentimentStatus,
    //             };

    //             await callHistoryModel.findOneAndUpdate(
    //                 { callId: call_id, agentId: agent_id },
    //                 { $set: data2 },
    //                 { returnOriginal: false },
    //             );

    //             try {
    //                 // const result = await contactModel.findOne({
    //                 //     callId: call.call_id,
    //                 //     agent: call.agent_id
    //                 // });

    //                 if (call_analysis.call_successful === false && analyzedTranscriptForSentiment.message.content === "interested") {

    //                     const result = await axios.post(process.env.MAKE_URL, {
    //                         firstname: retell_llm_dynamic_variables.user_firstname,
    //                         lastname: retell_llm_dynamic_variables.user_lastname,
    //                         email: retell_llm_dynamic_variables.user_email,
    //                         phone: to_number,
    //                         summary: call_analysis.call_summary,
    //                         url: recording_url || null,
    //                         transcript: transcript,
    //                     });

    //                     // console.log("result: ", result);
    //                 };
    //             } catch (e) {
    //                 console.error("error with axios result: ", + e);
    //             };
                
    //         } else {
    //             console.error("Event must be call_ended", event);
    //         };

    //     } catch (e) {
    //         console.error("Error fetching data after call analyzed: " + e);
    //         // next(e);
    //     };
    // };

    async call_analyzed(payload: any, todayString: string, todaysDateForDatesCalled: any, time: any) {
        try {
            const { event, call } = payload;

            const { 
                agent_id, 
                call_id,
                call_type,
                call_status,
                start_timestamp,
                end_timestamp,
                disconnection_reason,
                from_number, 
                to_number,
                direction,
                transcript,
                duration_ms,
                recording_url,
                public_log_url,
                call_analysis, 
                retell_llm_dynamic_variables,
                transcript_object,
                transcript_with_tool_calls 
            } = call;

            const fetch_client = await userModel.findOne({ 'agents.agentId': agent_id });

            let analyzedTranscriptForStatus;
            let callStatus;
            let sentimentStatus;
            let statsUpdate: any = { $inc: {} };

            function convertMsToHourMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;

                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            };

            if (event === "call_analyzed") {
                console.log("inside analyzed function");

                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";

                analyzedTranscriptForStatus = await reviewTranscript(transcript);

                const is_call_scheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const is_machine = analyzedTranscriptForStatus.message.content === "voicemail";
                const is_ivr = analyzedTranscriptForStatus.message.content === "ivr";
                const is_dnc = analyzedTranscriptForStatus.message.content === "dnc";
                const is_callback = analyzedTranscriptForStatus.message.content === "call-back";

                const is_neutral =  call_analysis.user_sentiment === "Neutral";
                const is_unknown =  call_analysis.user_sentiment === "Unknown";
                const is_positive = call_analysis.user_sentiment === "Positive";
                const is_negative = call_analysis.user_sentiment === "Negative";

                const call_back_date = await reviewCallback(transcript);

                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;

                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;

                if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = callstatusenum.VOICEMAIL;
                } else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = callstatusenum.IVR;
                } else if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = callstatusenum.SCHEDULED;
                } else if (call_failed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = callstatusenum.FAILED;
                } else if (call_transferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = callstatusenum.TRANSFERRED;
                    // if (fetch_client.name === "New Funding Solutions") {
                    //     await this.call_webhook(call_id);
                    // }
                } else if (dial_no_answer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = callstatusenum.NO_ANSWER;
                } else if (call_inactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = callstatusenum.INACTIVITY;
                } else if (call_hangedup) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = callstatusenum.CALLED;
                };

                if (is_call_scheduled) {
                    sentimentStatus = callSentimentenum.SCHEDULED;
                    // if (fetch_client.name === "New Funding Solutions") {
                    //     await this.call_webhook(call_id);
                    // };
                } else if (is_callback) {
                    sentimentStatus = callSentimentenum.CALLBACK;
                } else if (is_dnc) {
                    sentimentStatus = callSentimentenum.DNC;
                } else if (is_neutral) {
                    sentimentStatus = callSentimentenum.NEUTRAL;
                } else if (is_positive) {
                    sentimentStatus = callSentimentenum.POSITIVE;
                } else if (is_negative) {
                    sentimentStatus = callSentimentenum.NEGATIVE;
                } else if (is_unknown) {
                    sentimentStatus = callSentimentenum.UNKNOWN;
                };

                const new_transcript = await EventModel.create({
                    callId: call_id,
                    agentId: agent_id,
                    recordingUrl: recording_url,
                    callDuration: duration_in_HMS,
                    disconnectionReason: disconnection_reason,
                    callBackDate: call_back_date,
                    retellCallStatus: call_status,
                    duration: total_duration,
                    timestamp: end_timestamp,
                    ...(transcript && { transcript }),
                    retellCallSummary: call_analysis.call_summary,
                    analyzedTranscript: sentimentStatus,
                    userSentiment: sentimentStatus
                });

                const callData = {
                    callId: call_id,
                    agentId: agent_id,
                    userFirstname: retell_llm_dynamic_variables?.user_firstname || null,
                    userLastname: retell_llm_dynamic_variables?.user_lastname || null,
                    userEmail: retell_llm_dynamic_variables?.user_email || null,
                    recordingUrl: recording_url || null,
                    disconnectionReason: disconnection_reason || null,
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
                    address: retell_llm_dynamic_variables?.user_address || null,
                    dial_status: callStatus,
                    callSummary: call_analysis.call_summary || null,
                    userSentiment: sentimentStatus
                };

                await callHistoryModel.create(callData);

                if (fetch_client.name === "New Funding Solutions") {
                    if (call_transferred || is_call_scheduled) {
                        await this.call_webhook(call_id);
                    };
                };

                const jobId = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id: null;

                const statResults = await DailyStatsModel.findOneAndUpdate(
                    { day: todayString, agentId: agent_id, jobProcessedBy: jobId },
                    statsUpdate,
                    { returnOriginal: false }
                );

                const timestamp = new Date();

                await updateStatsByHour(agent_id, todayString, timestamp);

                await contactModel.findOneAndUpdate(
                    { callId: call_id, agentId: agent_id },
                    {
                        dial_status: callStatus,
                        $push: {
                            datesCalled: todaysDateForDatesCalled
                        },
                        referenceToCallId: new_transcript._id,
                        timesCalled: time,
                        $inc: {
                            calledTimes: 1
                        },
                        linktocallLogModel: statResults?._id || null
                    }
                );

                if (call_analysis.call_successful === false && analyzedTranscriptForStatus.message.content === "interested") {
                    await axios.post(process.env.MAKE_URL, {
                        firstname: retell_llm_dynamic_variables.user_firstname,
                        lastname: retell_llm_dynamic_variables.user_lastname,
                        email: retell_llm_dynamic_variables.user_email,
                        phone: to_number,
                        summary: call_analysis.call_summary,
                        url: recording_url || null,
                        transcript: transcript,
                    });
                };

                console.log("call updated");

            } else {
                console.error("Event must be call analyzed: " + event);
            }
        } catch (e) {
            console.error("Error fetching data from call analyzed: " + e);
        };
    };

    async cancel_schedule(req: AuthRequest, res: Response, next: NextFunction): Promise<Response>{
        try {
            const body = req.body;

            const { error } = CancelScheduleSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const { jobId } = body;

            const job = await jobModel.findOne({ jobId });
            if (!job) return res.status(400).json({ message: `Job with JobId: ${jobId} not found`});

            const { agentId, tagProcessedFor } = job;

            const update_contacts = await contactModel.updateMany(
                { 
                    agentId, 
                    tag: tagProcessedFor, 
                    isTaken: true,
                    isDeleted: false
                },
                { isTaken: false }
            );

            console.log("cont_update: ", update_contacts);

            if (!update_contacts.acknowledged) return res.status(400).json({ message: "Failed to update contacts isTaken to false"});


            const scheduledJobs = schedule.scheduledJobs;

            console.log("scheudles: ", scheduledJobs);
            if (!scheduledJobs.hasOwnProperty(jobId)) {
                return res.status(404).json({ message: `Job with ${jobId} not found or has been executed`});
            };

            const isCancelled = schedule.cancelJob(jobId);
            if (isCancelled) {
                const update_job = await jobModel.findOneAndUpdate(
                    { 
                        jobId,
                        callstatus: {
                            $ne: "cancelled"
                        }
                    },
                    {
                        callstatus: jobstatus.CANCELLED,
                        shouldContinueProcessing: false
                    },
                    { new: true }
                );

                console.log("update: ", update_job);
                if (!update_job) return res.status(400).json({ message: "Error setting call status to cancelled"});

                res.status(200).json({ schedule_cancelled: update_job });

            } else {
                res.status(500).json({ message: `Unable to cancel job with JobId: ${jobId}` });
            };

        } catch(e) {
            console.error("Error cancelling schedule" + e);
            next(e);
        };
    };

    // async getAffectedContacts(tags: string[]) {
    //     return contactModel.find({
    //         dial_status: "not-called",
    //         callId: {
    //             $exists: true
    //         },
    //         tag: {
    //             $in: tags
    //         },
    //         isDeleted: false
    //     }, { callId: 1 }).lean().limit(1000);
    // };

    async getAffectedContacts(tags: string[], page: number) {
        const callIds = await contactModel.find({
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
    };

    async fetchCallDetails(callId: string) {
        try {
            const retell_client = new Retell({
                apiKey: process.env.RETELL_API_KEY
            });

            const get_call = await retell_client.call.retrieve(callId);
            return get_call;
        } catch (e) {
            console.error("Error fetching details for id: ", e);
        };
    };

    async resetJobStats(jobIds: string[]) {
        await DailyStatsModel.updateMany(
            { jobProcessedBy: { $in: jobIds } },
            {
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
            }
        );

        console.log(`reset stats for ${jobIds.length} jobIds`);
    };

    async correct_contacts(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.query.clientId as string;

            const check_client = await userModel.findById(clientId);

            if (!check_client) return res.status(500).json({ message: "clientId not found" });

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

            function convertMsToHourMinSec(ms: number): string {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;

                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            };

            // const jobIdsToReset = new Set();
            // const bulkUpdates = [];
            const calls = [];

            for (const contact of fetch_contacts) {
                const callData = await this.fetchCallDetails(contact.callId as string);

                if (!callData) continue;

                const { call_id, disconnection_reason, transcript, retell_llm_dynamic_variables, recording_url, call_status, start_timestamp, end_timestamp, transcript_object, transcript_with_tool_calls, public_log_url, call_type, call_analysis } = callData;

                const duration_ms = (callData as any).duration_ms;

                const call_failed = disconnection_reason === "dial_failed";
                const call_transferred = disconnection_reason === "call_transfer";
                const dial_no_answer = disconnection_reason === "dial_no_answer";
                const call_inactivity = disconnection_reason === 'inactivity';
                const call_hangedup = disconnection_reason === "user_hangup" || disconnection_reason === "agent_hangup";
                const is_machine = disconnection_reason === "voicemail_reached";

                const analyzedTranscript = await reviewTranscript(transcript);

                const is_call_scheduled = analyzedTranscript.message.content === "scheduled";
                // const is_machine = analyzedTranscript.message.content === "voicemail";
                const is_ivr = analyzedTranscript.message.content === "ivr";

                calls.push(callData);

                console.log("call: ", callData);

                let callStatus;
                let statsUpdate: any = { $inc: {} };

                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = duration_ms;

                if (is_machine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = callstatusenum.VOICEMAIL;
                } else if (is_ivr) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = callstatusenum.IVR;
                } else if (is_call_scheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = callstatusenum.SCHEDULED;
                } else if (call_failed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = callstatusenum.FAILED;
                } else if (call_transferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = callstatusenum.TRANSFERRED;
                } else if (dial_no_answer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = callstatusenum.NO_ANSWER;
                } else if (call_inactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = callstatusenum.INACTIVITY;
                } else if (call_hangedup) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = callstatusenum.CALLED;
                };

                const duration_in_HMS = convertMsToHourMinSec(duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp || 0);

                await EventModel.findOneAndUpdate(
                    { callId: call_id },
                    {
                        transcript,
                        recordingUrl: recording_url,
                        retellCallSummary: call_analysis.call_summary,
                        userSentiment: callStatus,
                        disconnectionReason: disconnection_reason,
                        analyzedTranscript: callStatus,
                        callDuration: duration_in_HMS,
                        retellCallStatus: call_status,
                        // duration: to
                    }
                )

                // jobIdsToReset.add(retell_llm_dynamic_variables.job_id);
            };

            // console.log("joIds: ", jobIdsToReset);
            console.log("finished batch: ", calls.length);

        } catch (e) {
            console.error("Error correcting contacts: " + e);
            next(e);
        };
    };

    async call_webhook(callId: string) {
        try {
            console.log("in here with callId: ", callId);
            const fetch_details = await contactModel.findOne({ callId });
            if (!fetch_details) return console.error("No details found for callId: ", callId);
            console.log("retell details: ", fetch_details);
            const { firstname, lastname, address, city, state, zipCode, phone, sid, oid, employmentStatus, creditEstimate, email } = fetch_details;

            const fetch_transcript = await EventModel.findOne({ callId });
            console.log("transcript details: ", fetch_transcript);

            const RETELL_KEY = process.env.RETELL_API_KEY;

            const options = {
                method: "GET",
                url: `https://api.retell.ai/v2/get-call/${callId}`,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RETELL_KEY}`
                }
            };

            const call_response = await axios(options);
            const call_deets = call_response.data;

            const { custom_analysis_data } = call_deets.call_analysis;
            const debtAmount = custom_analysis_data?.user_total_unsecured_debt || null;

            const recordingUrl = fetch_transcript?.recordingUrl || "";

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

            const response = await axios.post(`https://hook.us1.make.com/ctp3cls3ctgbx1p252wfmmojcsxhpeso`, body_to_send);
            const result = response.data;

            console.log("make result: ", result);

            return result;

        } catch (e) {
            console.error("Error with call webhook: " + e);
        };
    };
};

export const call_service = new CallService();