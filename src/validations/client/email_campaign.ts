import Joi from "joi";

export const EmailReachSchema = Joi.object({
    campaignId: Joi.number().required(),
    timePeriod: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required()
});