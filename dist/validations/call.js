"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrectContacts = exports.CancelScheduleSchema = exports.ScheduleCallSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.ScheduleCallSchema = joi_1.default.object({
    hour: joi_1.default.number().required(),
    minute: joi_1.default.number().required(),
    agentId: joi_1.default.string().required(),
    limit: joi_1.default.number(),
    fromNumber: joi_1.default.string().required(),
    tag: joi_1.default.string().required()
});
exports.CancelScheduleSchema = joi_1.default.object({
    jobId: joi_1.default.string().required()
});
exports.CorrectContacts = joi_1.default.object({
    clientId: joi_1.default.string().hex().length(24)
});
