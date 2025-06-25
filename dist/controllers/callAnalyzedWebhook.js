"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAnalyzed = callAnalyzed;
const axios_1 = __importDefault(require("axios"));
const transcript_review_1 = require("../utils/transcript-review");
const contact_model_1 = require("../models/contact_model");
const types_1 = require("../utils/types");
const recordModel_1 = require("../models/recordModel");
async function callAnalyzed(payload) {
    var _a;
    try {
        const url = process.env.CAN_URL;
        const apiKey = process.env.CAN_KEY;
        const eventBody = { payload };
        let analyzedTranscriptForSentiment;
        let sentimentStatus;
        // axios
        //   .post(url, eventBody, {
        //     headers: {
        //       "Content-Type": "application/json",
        //       "X-Canonical-Api-Key": apiKey,
        //     },
        //   })
        //   .then((response) => {
        //     console.log("Response:", response.data);
        //   })
        //   .catch((error) => {
        //     console.error(
        //       "Error:",
        //       error.response ? error.response.data : error.message,
        //     );
        //   });
        analyzedTranscriptForSentiment = await (0, transcript_review_1.reviewTranscript)(payload.data.transcript);
        const isScheduled = analyzedTranscriptForSentiment.message.content === "scheduled";
        const isDNC = analyzedTranscriptForSentiment.message.content === "dnc";
        const isCall_Back = analyzedTranscriptForSentiment.message.content === "call-back";
        const isNeutral = payload.data.call_analysis.user_sentiment === "Neutral";
        const isUnknown = payload.data.call_analysis.user_sentiment === "Unknown";
        const isPositive = payload.data.call_analysis.user_sentiment === "Positive";
        const isNegative = payload.data.call_analysis.user_sentiment === "Negative";
        let addressStat;
        if (payload.call.agent_id === "" || payload.call.agent_id === "") {
            addressStat = payload.data.call_analysis.address;
        }
        if (isScheduled) {
            sentimentStatus = types_1.callSentimentenum.SCHEDULED;
        }
        else if (isCall_Back) {
            sentimentStatus = types_1.callSentimentenum.CALLBACK;
        }
        else if (isDNC) {
            sentimentStatus = types_1.callSentimentenum.DNC;
        }
        else if (isNeutral) {
            sentimentStatus = types_1.callSentimentenum.NEUTRAL;
        }
        else if (isPositive) {
            sentimentStatus = types_1.callSentimentenum.POSITIVE;
        }
        else if (isNegative) {
            sentimentStatus = types_1.callSentimentenum.NEGATIVE;
        }
        else if (isUnknown) {
            sentimentStatus = types_1.callSentimentenum.UNKNOWN;
        }
        const dataForAnalyzed = {
            summary: payload.data.call_analysis.call_summary,
            sentiment: sentimentStatus,
        };
        await recordModel_1.recordModel.findOneAndUpdate({ callId: payload.call.call_id, agentId: payload.call.agent_id }, { $set: dataForAnalyzed }, { upsert: true, returnOriginal: false });
        try {
            const result = await contact_model_1.contactModel.findOne({
                callId: payload.call.call_id,
                agentId: payload.call.agent_id,
            });
            if (payload.data.call_analysis.call_successful === false &&
                analyzedTranscriptForSentiment.message.content === "interested") {
                // await this.retellClient.call.registerPhoneCall({
                //   agent_id: payload.data.agent_id,
                //   from_number: payload.call.from_number,
                //   to_number: payload.call.to_number,
                //   retell_llm_dynamic_variables: {
                //     user_firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
                //     user_email: payload.data.retell_llm_dynamic_variables.user_email,
                //     user_lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
                //     job_id: payload.data.retell_llm_dynamic_variables.job_id,
                //     user_address: payload.data.retell_llm_dynamic_variables.user_address,
                //   },
                // });
                // const registerCallResponse = await this.retellClient.call.createPhoneCall({
                //   from_number: payload.call.from_number,
                //   to_number: payload.call.to_number,
                //   override_agent_id:payload.data.agent_id ,
                //   retell_llm_dynamic_variables: {
                //     user_firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
                //     user_email: payload.data.retell_llm_dynamic_variables.user_email,
                //     user_lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
                //     job_id: payload.data.retell_llm_dynamic_variables.job_id,
                //     user_address: payload.data.retell_llm_dynamic_variables.user_address,
                //   },
                // });
                // await contactModel.findOne({callId: payload.data.call_id, agentId:payload.data.agent_id}, {callId:payload.data.call_id
                // })
                const result = await axios_1.default.post(process.env.MAKE_URL, {
                    firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
                    lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
                    email: payload.data.retell_llm_dynamic_variables.user_email,
                    phone: payload.call.to_number,
                    summary: payload.data.call_analysis.call_summary,
                    url: ((_a = payload.data) === null || _a === void 0 ? void 0 : _a.recording_url) || null,
                    transcript: payload.data.transcript,
                });
            }
        }
        catch (error) {
            console.log("errror recalling", error);
        }
    }
    catch (error) {
        console.log(error);
    }
}
