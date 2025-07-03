"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailReachSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.EmailReachSchema = joi_1.default.object({
    campaignId: joi_1.default.number().required(),
    dateOption: joi_1.default.string().required(),
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required()
});
