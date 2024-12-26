import mongoose, { Schema, Document } from "mongoose";

interface ICallData extends Document {
  callId: string;
  agentId: string;
  userFirstname: string;
  userEmail: string;
  userLastname: string;
  callStatus: string;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: string;
  transcript: string;
  publicLogUrl: string;
  disconnectionReason: string;
  telecommunication: string;
  llmModel: string;
  voiceProvider: string;
  callCost: {
    productCosts: any[];
    totalDurationUnitPrice: number;
    totalDurationSeconds: number;
    totalOneTimePrice: number;
    combinedCost: number;
  };
  callType: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  endReason?: string;
  callSummary: string;
  inVoicemail: boolean;
  userSentiment: string;
  callSuccessful: boolean;
  agentTaskCompletionRating: string;
  callCompletionRating: string;
  customAnalysisData: object;
  recordingUrl: { type: string };
  agentName: { type: string };
  date: { type: string };
  address:{type:string},
  dial_status:{type:string}
}

const CallDataSchema = new Schema<ICallData>(
  {
    callId: { type: String },
    agentId: { type: String },
    userFirstname: { type: String },
    userEmail: { type: String },
    userLastname: { type: String },
    callStatus: { type: String },
    startTimestamp: { type: Number },
    endTimestamp: { type: Number },
    durationMs: { type: String },
    transcript: { type: String },
    publicLogUrl: { type: String },
    disconnectionReason: { type: String },
    telecommunication: { type: String },
    llmModel: { type: String },
    voiceProvider: { type: String },
    callType: { type: String },
    fromNumber: { type: String },
    toNumber: { type: String },
    direction: { type: String },
    endReason: { type: String },
    callSummary: { type: String },
    inVoicemail: { type: Boolean },
    userSentiment: { type: String },
    callSuccessful: { type: Boolean },
    agentTaskCompletionRating: { type: String },
    callCompletionRating: { type: String },
    customAnalysisData: { type: Object },
    recordingUrl: { type: String },
    agentName: { type: String },
    date: { type: String },
    address:{type: String},
    dial_status:{type : String}
  },
  { timestamps: true },
);

const callHistoryModel = mongoose.model<ICallData>(
  "callHistory",
  CallDataSchema,
);

export default callHistoryModel;
