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