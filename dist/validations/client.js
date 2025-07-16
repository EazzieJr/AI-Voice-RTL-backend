"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignDashboardSchema = exports.FetchRepliesSchema = exports.ExportKPISchema = exports.VoiceKPISchema = exports.AddNoteSchema = exports.ContactsSchema = exports.UpdateAgentIdSchema = exports.AgentDataSchema = exports.AddWebhookSchema = exports.ReplyLeadSchema = exports.ForwardReplySchema = exports.CampaignStatisticsSchema = exports.UploadCSVSchema = exports.CallHistorySchema = exports.DashboardSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.DashboardSchema = joi_1.default.object({
    // agentIds: Joi.array().items(Joi.string()).required(),
    dateOption: joi_1.default.string().required()
});
exports.CallHistorySchema = joi_1.default.object({
    // agentIds: Joi.array().items(Joi.string()).required(),
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
exports.UploadCSVSchema = joi_1.default.object({
    tag: joi_1.default.string().required(),
    agentId: joi_1.default.string().required()
});
exports.CampaignStatisticsSchema = joi_1.default.object({
    campaignId: joi_1.default.string().required(),
    limit: joi_1.default.number(),
    email_status: joi_1.default.string(),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date()
});
exports.ForwardReplySchema = joi_1.default.object({
    campaignId: joi_1.default.string().required(),
    message_id: joi_1.default.string().required(),
    stats_id: joi_1.default.string().required(),
    to_emails: joi_1.default.string().required()
});
exports.ReplyLeadSchema = joi_1.default.object({
    campaignId: joi_1.default.string().required(),
    email_body: joi_1.default.string(),
    reply_message_id: joi_1.default.string(),
    reply_email_time: joi_1.default.string(),
    reply_email_body: joi_1.default.string(),
    cc: joi_1.default.string(),
    bcc: joi_1.default.string(),
    add_signature: joi_1.default.boolean(),
    to_first_name: joi_1.default.string(),
    to_last_name: joi_1.default.string(),
    to_email: joi_1.default.string()
});
exports.AddWebhookSchema = joi_1.default.object({
    campaignId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    webhook_url: joi_1.default.string().required(),
    event_types: joi_1.default.array().items(joi_1.default.string()).required(),
    categories: joi_1.default.array().items(joi_1.default.string()).required()
});
exports.AgentDataSchema = joi_1.default.object({
    agentId: joi_1.default.string().required(),
    dateOption: joi_1.default.string().required()
});
exports.UpdateAgentIdSchema = joi_1.default.object({
    agentId: joi_1.default.string().required(),
    newAgentId: joi_1.default.string().required()
});
exports.ContactsSchema = joi_1.default.object({
    contacts: joi_1.default.array().items(joi_1.default.string().hex().length(24))
});
// export const EditProfileSchema = Joi.object({
//     username: Joi.string(),
//     password: Joi.string(),
//     email: Joi.string(),
//     group: Joi.string(),
//     name: Joi.string(),
//     agent: Joi.string(),
//     clientType: Joi.string(),
// });
exports.AddNoteSchema = joi_1.default.object({
    callId: joi_1.default.string().required(),
    notes: joi_1.default.string().required(),
});
exports.VoiceKPISchema = joi_1.default.object({
    agentIds: joi_1.default.array().items(joi_1.default.string()).required(),
    dateOption: joi_1.default.string().required(),
    data: joi_1.default.string().required(),
    page: joi_1.default.number()
});
exports.ExportKPISchema = joi_1.default.object({
    dateOption: joi_1.default.string().required(),
    data: joi_1.default.string().required()
});
exports.FetchRepliesSchema = joi_1.default.object({
    campaignId: joi_1.default.number(),
    page: joi_1.default.number(),
    category: joi_1.default.array().items(joi_1.default.number())
});
exports.CampaignDashboardSchema = joi_1.default.object({
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
    total: joi_1.default.boolean(),
    date: joi_1.default.date()
});
