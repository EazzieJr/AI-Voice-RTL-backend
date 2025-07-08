import Joi from "joi";
import { start } from "repl";

export const EmailReachSchema = Joi.object({
    campaignId: Joi.number().required(),
    timePeriod: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required()
});

export const CampaignDetailsAndEmailReachSchema = Joi.object({
    campaignId: Joi.number().required(),
    startDate: Joi.date(),
    endDate: Joi.date(),
});