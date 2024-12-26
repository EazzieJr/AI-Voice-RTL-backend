import { Schema, model } from "mongoose";
import mongoose from "mongoose";
import {
  DaysToBeProcessedEnum,
  IContact,
  Ijob,
  callstatusenum,
  jobstatus,
} from "../utils/types";
// Define your DNC list
const dncList: string[] = [];
const ContactSchema = new Schema<IContact>(
  {
    firstname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    lastname: {
      type: String,
    },
    phone: {
      type: String,
      required: true,
    },
    isusercalled: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    callId: {
      type: String,
    },
    agentId: {
      type: String,
      required: true,
    },
    dial_status: {
      type: String,
      enum: Object.values(callstatusenum),
      default: callstatusenum.NOT_CALLED,
    },
    referenceToCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "transcript",
    },
    linktocallLogModel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyStats",
    },
    datesCalled: {
      type: [String],
      default: [],
    },
    answeredByVM: {
      type: Boolean,
      default: false,
    },
    dayToBeProcessed: {
      type: String,
      enum: Object.values(DaysToBeProcessedEnum),
    },
    tag: {
      type: String,
    },
    jobProcessedWithId: {
      type: [String],
      default: [],
    },
    isOnDNCList: {
      type: Boolean,
      default: false,
    },
    timesCalled: {
      type: String,
    },
    calledTimes:{
      default: 0,
      type:Number
    },
    address: { type: String },
  },
  { timestamps: true },
);

const jobschema = new Schema<Ijob>(
  {
    callstatus: {
      type: String,
      enum: Object.values(jobstatus),
    },
    jobId: {
      type: String,
      required: true,
    },
    processedContacts: {
      type: Number,
      default: 0,
    },
    processedContactsForRedial: {
      type: Number,
      default: 0,
    },
    agentId: {
      type: String,
    },
    scheduledTime: { type: String },
    shouldContinueProcessing: { type: Boolean, default: true },
    tagProcessedFor: { type: String },
    completedPercent: { type: String },
    totalContactToProcess: { type: Number },
  },
  { timestamps: true },
);

const transcriptSchema = new Schema(
  {
    callId: {
      type: String,
    },
    transcript: { type: String },
    recordingUrl: { type: String },
    retellCallSummary: { type: String },
    userSentiment: { type: String },
    agentSemtiment: { type: String },
    disconnectionReason: { type: String },
    analyzedTranscript: { type: String },
    agentId: { type: String },
    callBackDate: { type: String },
    callDuration: { type: String },
    retellCallStatus: { type: String },
    timestamp: { type: String },
    duration: { type: String },
    agentName: { type: String },
  },
  { timestamps: true },
);


export const EventModel = model("transcript", transcriptSchema);
export const contactModel = model<IContact>("Retell", ContactSchema);
export const jobModel = model<Ijob>("RetellJOb", jobschema);
const db = process.env.URL;

export const connectDb = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(db);
    console.log("MongoDB Connected to " + conn.connection.name);
  } catch (error) {
    console.log("Error: " + (error as Error).message);
    process.exit(1);
  }
};
