import { model, Schema } from "mongoose";
const recordSchema = new Schema({
  firstname: { type: String },
  lastname: { type: String },
  email: { type: String },
  address: { type: String },
  jobid: { type: String },
  callId: { type: String },
  agentId: { type: String },
  status: { type: String },
  starttimestamp: { type: String },
  endtimestamp: { type: String },
  transcript: { type: String },
  duration: { type: String },
  publiclogurl: { type: String },
  fromNumber: { type: String },
  toNumber: { type: String },
  disconnectionReason: { type: String,
  summary: { type: String },
  callType: { type: String },
  dial_status: { type: String },
  date: { type: String },
  recordingUrl:{type:String},
  sentiment: { type: String },
  callSuccessful: { type: String },
},
});


export const recordModel = model("record", recordSchema)