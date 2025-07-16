import Joi from "joi";

export const EditProfileSchema = Joi.object({
    username: Joi.string(),
    password: Joi.string(),
    email: Joi.string(),
    group: Joi.string(),
    name: Joi.string(),
    agent: Joi.string(),
    clientType: Joi.string(),
});
