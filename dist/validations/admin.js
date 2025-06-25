"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchClientSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.SearchClientSchema = joi_1.default.object({
    agentIds: joi_1.default.array().items(joi_1.default.string()).required(),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
    statusOption: joi_1.default.string(),
    sentimentOption: joi_1.default.string(),
    tag: joi_1.default.string(),
    page: joi_1.default.number(),
    limit: joi_1.default.number()
});
