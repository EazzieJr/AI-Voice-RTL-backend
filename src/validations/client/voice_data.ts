import Joi from "joi";

export const VoiceKPISchema = Joi.object({
    agentIds: Joi.array().items(Joi.string()).required(),
    dateOption: Joi.string().required(),
    data: Joi.string().required(),
    page: Joi.number()
});
