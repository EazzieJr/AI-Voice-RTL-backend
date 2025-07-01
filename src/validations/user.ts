import Joi from "joi";

export const RequiredEmail = {
    email: Joi.string()
        .email()
        .required()
        .messages({
            "string.email": "Invalid email address",
            "any.required": "Email is required"
        })
};

export const RequiredPassword = {
    password: Joi.string().required()
};

export const SignUpSchema = Joi.object({
    ...RequiredEmail,
    ...RequiredPassword,
    username: Joi.string().required(),
    group: Joi.string().required(),
    name: Joi.string().required(),
    clientType: Joi.string().valid("mixed", "voice", "email", "inbound").default("mixed")
});