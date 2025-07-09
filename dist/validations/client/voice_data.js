"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceKPISchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.VoiceKPISchema = joi_1.default.object({
    agentIds: joi_1.default.array().items(joi_1.default.string()).required(),
    dateOption: joi_1.default.string().required(),
    data: joi_1.default.string().required(),
    page: joi_1.default.number()
});
