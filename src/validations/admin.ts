import Joi from "joi";

export const SearchClientSchema = Joi.object({
    agentIds: Joi.array().items(Joi.string()).required(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    statusOption: Joi.string(),
    sentimentOption: Joi.string(),
    tag: Joi.string(),
    page: Joi.number(),
    limit: Joi.number()
});