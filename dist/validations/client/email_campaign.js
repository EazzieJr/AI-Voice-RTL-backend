"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchRepliesSchema = exports.CampaignDetailsAndEmailReachSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.CampaignDetailsAndEmailReachSchema = joi_1.default.object({
    campaignId: joi_1.default.number().required(),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
});
exports.FetchRepliesSchema = joi_1.default.object({
    campaignId: joi_1.default.number(),
    page: joi_1.default.number(),
    category: joi_1.default.array().items(joi_1.default.number())
});
