import { contactModel, EventModel, jobModel } from "../models/contact_model";
import RootService from "./_root";
import { Request, Response, NextFunction } from "express";
import { callSentimentenum, callstatusenum, jobstatus } from "../utils/types";
import { reviewCallback, reviewTranscript } from "../utils/transcript-review";
import callHistoryModel from "../models/historyModel";
import { DailyStatsModel } from "../models/logModel";
import { updateStatsByHour } from "../controllers/graphController";
import { time } from "console";
import { nextDay } from "date-fns";
import axios from "axios";
import { AuthRequest } from "../middleware/authRequest";
import { CancelScheduleSchema, ScheduleCallSchema } from "../validations/call";
import moment from "moment-timezone";
import { scheduleCronJob } from "../utils/scheduleJob";
import schedule from "node-schedule";

class CallService extends RootService {

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

            const lowerCaseTag = tag.toLowerCase();

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

            console.log("call sched: ", call_schedule);

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
            try {
                if (event === "call_started") {
                    console.log(`call started for: ${data.call_id}`);
                    await this.call_started(payload, next);
                } else if (event === "call_ended") {
                    console.log(`call ended: ${data.call_id}`);
                    await this.call_ended(payload, todayString, todayStringWithTime, time, next);
                } else if (event === "call_analyzed") {
                    console.log(`call analyzed for: ${data.call_id}`);
                    await this.call_analyzed(payload, next);
                } else {
                    return res.status(500).json({ 
                        error: "Invalid event detected",
                        event_gotten: event
                    });
                };
            } catch (e) {
                console.error("Error reading event and data: " + e);
                next(e);
            };

            console.log("pay: ", payload);
            return res.status(204).send();

        } catch (e) {
            console.error("Error while accessing webhook from retell: " + e);
            next(e);
        };
    };

    async call_started(payload: any, next: NextFunction) {
        try {
            const { event, data } = payload;
            console.log("data: ", payload);

            if (event === "call_started") {
                const { call_id, agent_id } = data;

                await contactModel.findOneAndUpdate(
                    { callId: call_id, agentId: agent_id },
                    { dial_status: callstatusenum.IN_PROGRESS }
                );

                const new_event = await EventModel.create({
                    callId: call_id,
                    agentId: agent_id
                });

                if (!new_event._id) {
                    console.log("Error creating new event model");
                };

                const hist_data = await callHistoryModel.create({
                    callI: call_id,
                    agentId: agent_id
                });

                if (!hist_data._id) {
                    console.log("Error creating new event model");
                };

            } else {
                console.error("Event must be call_started: ", event);
            }            

        } catch (e) {
            console.error("Unable to get data from started call: " + e);
            next(e);
        };
    };

    async call_ended(payload: any, todayString: string, todaysDateForDatesCalled: any, time: any, next: NextFunction) {
        try {
            console.log("payload: ", payload);
            const { event, call, data } = payload;
            const {
                call_id,
                agent_id,
                call_status,
                start_timestamp,
                end_timestamp,
                transcript,
                disconnection_reason,
                recording_url,
                public_log_url,
                call_analysis,
                retell_llm_dynamic_variables,
                from_number,
                to_number,
                direction
            } = data;

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

                const duration_in_HMS = convertMsToHourMinSec(call.duration_ms);
                const total_duration = convertMsToHourMinSec(end_timestamp - start_timestamp) || 0;

                const call_ended_updated_data = {
                    callId: call_id,
                    agentId: call.agent_id,
                    recordingUrl: recording_url,
                    callDuration: duration_in_HMS,
                    disconnectionReason: disconnection_reason,
                    callBackDate: call_back_date,
                    retellCallStatus: call_status,
                    duration: total_duration,
                    timestamp: end_timestamp,
                    ...(transcript && { transcript }),
                };

                const ended_data_update = await EventModel.findOneAndUpdate(
                    { callId: call_id, agentId: call.agent_id },
                    { $set: call_ended_updated_data },
                    { returnOriginal: false }
                );

                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = call.duration_ms;
        
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

                console.log("dial: ", callStatus);

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
                    callType: data.call_type || null,
                    customAnalysisData:
                        event === "call_analyzed" ? call_analysis : null,
                    fromNumber: from_number || null,
                    toNumber: to_number || null,
                    direction: direction || null,
                    date: todayString,
                    address: retell_llm_dynamic_variables?.user_address || null,
                    dial_status: callStatus,
                };

                console.log("callData: ", callData);

                const history_update = await callHistoryModel.findOneAndUpdate(
                    { callId: call_id, agentId: agent_id },
                    { $set: callData },
                    { returnOriginal: false }
                );

                console.log("resu: ", history_update);

                const jobId_from_retell = retell_llm_dynamic_variables.job_id ? retell_llm_dynamic_variables.job_id : null;

                let statResults;

                statResults = await DailyStatsModel.findOneAndUpdate(
                    { day: todayString, agentId: agent_id, jobProcessedBy: jobId_from_retell },
                    { $set: statsUpdate },
                    { returnOriginal: false }
                );

                const timestamp = new Date();

                await updateStatsByHour(agent_id, todayString, timestamp);


                console.log("ended event: ", ended_data_update);
                const updateData: any = {
                    dial_status: callStatus,
                    $push: {
                        datesCalled: todaysDateForDatesCalled
                    },
                    referenceToCallId: ended_data_update._id,
                    timesCalled: time,
                    $inc: { calledTimes: 1 }
                };

                if (statResults) {
                    updateData.linkToCallLogModel = statResults._id;
                } else {
                    console.log("stat: ", statResults);
                };

                const update_contact = await contactModel.findOneAndUpdate(
                    { callId: call_id, agentId: agent_id },
                    { $set: updateData }
                );

                console.log("updat: ", update_contact);
                
            } else {
                console.error("Event must be call_ended: ", event);
            };

        } catch (e) {
            console.error("Unable to get data from call ended: " + e);
            next(e);
        };
    };

    async call_analyzed(payload: any, next: NextFunction) {
        try {
            const { event, data, call } = payload;
            const url = process.env.CAN_URL;
            const apiKey = process.env.CAN_KEY;
            const eventBody = { payload }

            let analyzedTranscriptForSentiment;
            let sentimentStatus;

            analyzedTranscriptForSentiment = await reviewTranscript(data.transcript);

            const is_scheduled = analyzedTranscriptForSentiment.message.content === "scheduled";
            const is_dnc = analyzedTranscriptForSentiment.message.content === "dnc";
            const is_callback = analyzedTranscriptForSentiment.message.content === "call-back";
            const is_neutral = data.call_analysis.user_sentiment === "Neutral";
            const is_unknown = data.call_analysis.user_sentiment === "Unknown";
            const is_positive = data.call_analysis.user_sentiment === "Positive";
            const is_negative = data.call_analysis.user_sentiment === "Negative";

            let addressStat;
            if (call.agent_id === "") {
                addressStat = data.call_analysis.address;
            };
            
            if (is_scheduled) {
                sentimentStatus = callSentimentenum.SCHEDULED;
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

            const event_data_to_update = {
                retellCallSummary: data.call_analysis.call_summary,
                analyzedTranscript: sentimentStatus,
                userSentiment: sentimentStatus
            };

            const results = await EventModel.findOneAndUpdate(
                { callId: call.call_id, agentId: call.agent_id },
                { $set: data },
                { returnOriginal: false }
            );

            const data2 = {
                callSummary: data.call_analysis.call_summary,
                userSentiment: sentimentStatus,
            };

            await callHistoryModel.findOneAndUpdate(
                { callId: call.call_id, agentId: call.agent_id },
                { $set: data2 },
                { returnOriginal: false },
            );

            try {
                // const result = await contactModel.findOne({
                //     callId: call.call_id,
                //     agent: call.agent_id
                // });

                if (data.call_analysis.call_successful === false && analyzedTranscriptForSentiment.message.content === "interested") {
                    const result = await axios.post(process.env.MAKE_URL, {
                        firstname: data.retell_llm_dynamic_variables.user_firstname,
                        lastname: data.retell_llm_dynamic_variables.user_lastname,
                        email: data.retell_llm_dynamic_variables.user_email,
                        phone: call.to_number,
                        summary: data.call_analysis.call_summary,
                        url: data?.recording_url || null,
                        transcript: data.transcript,
                      });
                }
            } catch (e) {
                console.error("error with axios result: ", + e);
                next(e);
            };

        } catch (e) {
            console.error("Error fetching data after call analyzed: ", + e);
            next(e);
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
};

export const call_service = new CallService();