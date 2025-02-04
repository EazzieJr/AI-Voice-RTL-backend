import Joi from "joi";

export const ScheduleCallSchema = Joi.object({
    hour: Joi.number().required(),
    minute: Joi.number().required(),
    agentId: Joi.string().required(),
    limit: Joi.number(),
    fromNumber: Joi.string().required(),
    tag: Joi.string().required()
});

export const CancelScheduleSchema = Joi.object({
    jobId: Joi.string().required()
});