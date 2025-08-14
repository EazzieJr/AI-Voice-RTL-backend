import Joi from "joi";

export const CampaignDetailsAndEmailReachSchema = Joi.object({
    campaignId: Joi.number().required(),
    startDate: Joi.date(),
    endDate: Joi.date(),
});

export const FetchRepliesSchema = Joi.object({
    campaignId: Joi.number(),
    page: Joi.number(),
    category: Joi.array().items(Joi.number())
});