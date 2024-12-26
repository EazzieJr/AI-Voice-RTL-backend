import axios from "axios";
import { reviewTranscript } from "../utils/transcript-review";
import { contactModel, EventModel } from "../models/contact_model";
import callHistoryModel from "../models/historyModel";
import { callSentimentenum } from "../utils/types";
import { recordModel } from "../models/recordModel";

export async function callAnalyzed(payload: any) {
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

    analyzedTranscriptForSentiment = await reviewTranscript(
      payload.data.transcript,
    );
    const isScheduled =
      analyzedTranscriptForSentiment.message.content === "scheduled";
    const isDNC = analyzedTranscriptForSentiment.message.content === "dnc";
    const isCall_Back =
      analyzedTranscriptForSentiment.message.content === "call-back";
    const isNeutral = payload.data.call_analysis.user_sentiment === "Neutral";
    const isUnknown = payload.data.call_analysis.user_sentiment === "Unknown";
    const isPositive = payload.data.call_analysis.user_sentiment === "Positive";
    const isNegative = payload.data.call_analysis.user_sentiment === "Negative";

    let addressStat;
    if (payload.call.agent_id === "" || payload.call.agent_id === "") {
      addressStat = payload.data.call_analysis.address;
    }

    if (isScheduled) {
      sentimentStatus = callSentimentenum.SCHEDULED;
    } else if (isCall_Back) {
      sentimentStatus = callSentimentenum.CALLBACK;
    } else if (isDNC) {
      sentimentStatus = callSentimentenum.DNC;
    } else if (isNeutral) {
      sentimentStatus = callSentimentenum.NEUTRAL;
    } else if (isPositive) {
      sentimentStatus = callSentimentenum.POSITIVE;
    } else if (isNegative) {
      sentimentStatus = callSentimentenum.NEGATIVE;
    } else if (isUnknown) {
      sentimentStatus = callSentimentenum.UNKNOWN;
    }

    const dataForAnalyzed = {
      summary: payload.data.call_analysis.call_summary,
      sentiment: sentimentStatus,
    };
    await recordModel.findOneAndUpdate(
      { callId: payload.call.call_id, agentId: payload.call.agent_id },
      { $set: dataForAnalyzed },
      { upsert: true, returnOriginal: false },
    );

    try {
      const result = await contactModel.findOne({
        callId: payload.call.call_id,
        agentId: payload.call.agent_id,
      });
      if (
        payload.data.call_analysis.call_successful === false &&
        analyzedTranscriptForSentiment.message.content === "interested"
      ) {
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

        const result = await axios.post(process.env.MAKE_URL, {
          firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
          lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
          email: payload.data.retell_llm_dynamic_variables.user_email,
          phone: payload.call.to_number,
          summary: payload.data.call_analysis.call_summary,
          url: payload.data?.recording_url || null,
          transcript: payload.data.transcript,
        });
      }
    } catch (error) {
      console.log("errror recalling", error);
    }
  } catch (error) {
    console.log(error);
  }
}
