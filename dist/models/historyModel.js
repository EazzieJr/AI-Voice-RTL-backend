"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CallDataSchema = new mongoose_1.Schema({
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
    address: { type: String },
    dial_status: { type: String },
    call_outcome: { type: String },
    notes: { type: String },
}, { timestamps: true });
const callHistoryModel = mongoose_1.default.model("callHistory", CallDataSchema);
exports.default = callHistoryModel;
