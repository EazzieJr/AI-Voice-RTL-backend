"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = exports.jobModel = exports.contactModel = exports.EventModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const types_1 = require("../utils/types");
// Define your DNC list
const dncList = [];
const ContactSchema = new mongoose_1.Schema({
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
        enum: Object.values(types_1.callstatusenum),
        default: types_1.callstatusenum.NOT_CALLED,
    },
    referenceToCallId: {
        type: mongoose_2.default.Schema.Types.ObjectId,
        ref: "transcript",
    },
    linktocallLogModel: {
        type: mongoose_2.default.Schema.Types.ObjectId,
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
        enum: Object.values(types_1.DaysToBeProcessedEnum),
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
    calledTimes: {
        default: 0,
        type: Number
    },
    address: { type: String },
    isTaken: { type: Boolean, default: false },
    city: {
        type: String
    },
    state: {
        type: String
    },
    zipCode: {
        type: String
    },
    sid: {
        type: String
    },
    oid: {
        type: String
    },
    employmentStatus: {
        type: String
    },
    creditEstimate: {
        type: String
    },
    companyname: {
        type: String
    }
}, { timestamps: true });
const jobschema = new mongoose_1.Schema({
    callstatus: {
        type: String,
        enum: Object.values(types_1.jobstatus),
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
    limit: { type: Number },
    fromNumber: { type: String },
}, { timestamps: true });
const transcriptSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.EventModel = (0, mongoose_1.model)("transcript", transcriptSchema);
exports.contactModel = (0, mongoose_1.model)("Retell", ContactSchema);
exports.jobModel = (0, mongoose_1.model)("RetellJOb", jobschema);
const db = process.env.URL;
const connectDb = async () => {
    try {
        const conn = await mongoose_2.default.connect(db);
        console.log("MongoDB Connected to " + conn.connection.name);
    }
    catch (error) {
        console.log("Error: " + error.message);
        process.exit(1);
    }
};
exports.connectDb = connectDb;
