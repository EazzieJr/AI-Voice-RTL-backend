import Joi from "joi";

export const DeleteListSchema = Joi.object({
    tag: Joi.string().required(),
});
