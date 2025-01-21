import Joi from "joi";

export const DashboardSchema = Joi.object({
    agentIds: Joi.array().items(Joi.string()).required(),
    dateOption: Joi.string().required()
});

export const CallHistorySchema = Joi.object({
    agentIds: Joi.array().items(Joi.string()).required(),
    page: Joi.number(),
    startDate: Joi.date(),
    endDate: Joi.date()
});

export const UploadCSVSchema = Joi.object({
    tag: Joi.string().required(),
    agentId: Joi.string().required()
});

export const CampaignStatisticsSchema = Joi.object({
    campaignId: Joi.string().required(),
    limit: Joi.number(),
    email_status: Joi.string(),
    startDate: Joi.date(),
    endDate: Joi.date()
});

export const ForwardReplySchema = Joi.object({
    campaignId: Joi.string().required(),
    message_id: Joi.string().required(),
    stats_id: Joi.string().required(),
    to_emails: Joi.string().required()
});

export const ReplyLeadSchema = Joi.object({
    campaignId: Joi.string().required(),
    email_body: Joi.string(),
    reply_message_id: Joi.string(),
    reply_email_time: Joi.string(),
    reply_email_body: Joi.string(),
    cc: Joi.string(),
    bcc: Joi.string(),
    add_signature: Joi.boolean(),
    to_first_name: Joi.string(),
    to_last_name: Joi.string(),
    to_email: Joi.string()
});