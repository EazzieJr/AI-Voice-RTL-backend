import OpenAI from "openai";
import callHistoryModel from "../models/historyModel";
import { reviewTranscript } from "./transcript-review";
import { callstatusenum } from "./types";
import Retell from "retell-sdk";
import { DailyStatsModel } from "../models/logModel";
import { contactModel } from "../models/contact_model";

// Helper function to split an array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function processBatch(batch: any[], retellClient: Retell) {
  const results = await Promise.all(
    batch.map(async (contact) => {
      try {
        const result = await retellClient.call.retrieve(contact.callId);
        const isCallFailed = result.disconnection_reason === "dial_failed";
        const isCallTransferred =
          result.disconnection_reason === "call_transfer";
        const isDialNoAnswer = result.disconnection_reason === "dial_no_answer";
        const isCallInactivity = result.disconnection_reason === "inactivity";
        const isCallAnswered =
          result.disconnection_reason === "user_hangup" ||
          result.disconnection_reason === "agent_hangup";

        const analyzedTranscriptForStatus = await reviewTranscript(
          result.transcript,
        );
        const isCallScheduled =
          analyzedTranscriptForStatus.message.content === "scheduled";
        const isMachine =
          analyzedTranscriptForStatus.message.content === "voicemail";
        const isIVR = analyzedTranscriptForStatus.message.content === "ivr";

        let callStatus;
        let statsUpdate: any = { $inc: {} };
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
        statsUpdate.$inc.totalCallDuration = (result as any).duration_ms;
        if (isMachine) {
          statsUpdate.$inc.totalAnsweredByVm = 1;
          callStatus = callstatusenum.VOICEMAIL;
        } else if (isIVR) {
          statsUpdate.$inc.totalAnsweredByIVR = 1;
          callStatus = callstatusenum.IVR;
        } else if (isCallScheduled) {
          statsUpdate.$inc.totalAppointment = 1;
          callStatus = callstatusenum.SCHEDULED;
        } else if (isCallFailed) {
          statsUpdate.$inc.totalFailed = 1;
          callStatus = callstatusenum.FAILED;
        } else if (isCallTransferred) {
          statsUpdate.$inc.totalTransffered = 1;
          callStatus = callstatusenum.TRANSFERRED;
        } else if (isDialNoAnswer) {
          statsUpdate.$inc.totalDialNoAnswer = 1;
          callStatus = callstatusenum.NO_ANSWER;
        } else if (isCallInactivity) {
          statsUpdate.$inc.totalCallInactivity = 1;
          callStatus = callstatusenum.INACTIVITY;
        } else if (isCallAnswered) {
          statsUpdate.$inc.totalCallAnswered = 1;
          callStatus = callstatusenum.CALLED;
        }

        await callHistoryModel.findOneAndUpdate(
          { callId: result.call_id, agentId: result.agent_id },
          { dial_status: callStatus },
        );

        
        await contactModel.findOneAndUpdate(
          { callId: result.call_id, agentId: result.agent_id },
          { dial_status: callStatus },
        );
        let statsResults;
       // if(resultforcheck.calledTimes < 0){
        statsResults = await DailyStatsModel.findOneAndUpdate(
          {
            day: "2025-01-03",
            agentId: result.agent_id,
            jobProcessedBy: result.retell_llm_dynamic_variables.job_id,
          },
          statsUpdate,
          { upsert: true, returnOriginal: false },
        )
        return { success: true, contactId: contact.callId };
      } catch (error) {
        console.error(`Error processing contact ${contact.callId}:`, error);
        return { success: false, contactId: contact.callId, error };
      }
    }),
  );

  return results;
}

export async function script() {
  try {
    const retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    const contacts = await contactModel
      .find({ datesCalled:"2025-01-03" })
      .sort({ createdAt: -1 })
      .limit(2176); // Fetch all contacts
    const batches = chunkArray(contacts, 1000); // Split into batches of 1000

    for (const [index, batch] of batches.entries()) {
      console.log(`Processing batch ${index + 1} of ${batches.length}...`);

      const results = await processBatch(batch, retellClient);

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.filter((r) => !r.success).length;

      console.log(
        `Batch ${
          index + 1
        } completed: ${successCount} successful, ${errorCount} failed.`,
      );
    }

    console.log("Script completed successfully!");
  } catch (error) {
    console.error("Script encountered an error:", error);
  }
}

export function convertMsToHourMinSec(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}
