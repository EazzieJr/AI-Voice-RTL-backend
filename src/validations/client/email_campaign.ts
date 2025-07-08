import Joi from "joi";

export const CampaignDetailsAndEmailReachSchema = Joi.object({
    campaignId: Joi.number().required(),
    startDate: Joi.date(),
    endDate: Joi.date(),
});