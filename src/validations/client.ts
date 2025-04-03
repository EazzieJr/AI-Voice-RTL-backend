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

export const AddWebhookSchema = Joi.object({
    campaignId: Joi.string().required(),
    name: Joi.string().required(),
    webhook_url: Joi.string().required(),
    event_types: Joi.array().items(Joi.string()).required(),
    categories: Joi.array().items(Joi.string()).required()
});

export const AgentDataSchema = Joi.object({
    agentId: Joi.string().required(),
    dateOption: Joi.string().required()
});

export const UpdateAgentIdSchema = Joi.object({
    agentId: Joi.string().required(),
    newAgentId: Joi.string().required()
});

export const ContactsSchema = Joi.object({
    contacts: Joi.array().items(Joi.string().hex().length(24))
});

export const EditProfileSchema = Joi.object({
    username: Joi.string(),
    password: Joi.string(),
    email: Joi.string(),
    group: Joi.string(),
    name: Joi.string(),
    agent: Joi.string()
});