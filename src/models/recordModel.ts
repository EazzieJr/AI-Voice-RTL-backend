import { model, Schema } from "mongoose";

interface IRecord extends Document {
  firstname?: string;
  lastname?: string;
  email?: string;
  address?: string;
  jobid?: string;
  callId?: string;
  agentId?: string;
  status?: string;
  starttimestamp?: string;
  endtimestamp?: string;
  transcript?: string;
  duration?: string;
  publiclogurl?: string;
  fromNumber?: string;
  toNumber?: string;
  disconnectionReason?: string;
  summary?: string;
  callType?: string;
  dial_status?: string;
  date?: string;
  recordingUrl?: string;
  sentiment?: string;
  callSuccessful?: string;
}
const recordSchema = new Schema<IRecord>({
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