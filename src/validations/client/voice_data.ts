import Joi from "joi";

export const VoiceKPISchema = Joi.object({
    agentIds: Joi.array().items(Joi.string()).required(),
    dateOption: Joi.string().required(),
    data: Joi.string().required(),
    page: Joi.number()
});

export const DashboardSchema = Joi.object({
    dateOption: Joi.string(),
    jobId: Joi.string(),
});

export const CallHistorySchema = Joi.object({
    page: Joi.number(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    date: Joi.date(),
    sentiment: Joi.string(),
    status: Joi.string(),
    tag: Joi.string(),
    contact: Joi.string(),
    disconnectionReason: Joi.string(),
    callType: Joi.string(),
    callOutcome: Joi.string(),
    direction: Joi.string()
});
