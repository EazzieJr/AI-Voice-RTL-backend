"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallHistorySchema = exports.DashboardSchema = exports.VoiceKPISchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.VoiceKPISchema = joi_1.default.object({
    agentIds: joi_1.default.array().items(joi_1.default.string()).required(),
    dateOption: joi_1.default.string().required(),
    data: joi_1.default.string().required(),
    page: joi_1.default.number()
});
exports.DashboardSchema = joi_1.default.object({
    dateOption: joi_1.default.string(),
    jobId: joi_1.default.string(),
});
exports.CallHistorySchema = joi_1.default.object({
    page: joi_1.default.number(),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
    date: joi_1.default.date(),
    sentiment: joi_1.default.string(),
    status: joi_1.default.string(),
    tag: joi_1.default.string(),
    contact: joi_1.default.string(),
    disconnectionReason: joi_1.default.string(),
    callType: joi_1.default.string(),
    callOutcome: joi_1.default.string(),
    direction: joi_1.default.string()
});
