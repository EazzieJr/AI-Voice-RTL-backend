import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import { EditProfileSchema } from "../../validations/client/profile";
import { userModel } from "../../models/userModel";
import argon2 from "argon2";
import { ClientType } from "../../utils/types";
import { cloudinary } from "../../utils/upload";
import streamifier from "streamifier";

class ProfileManagementService extends RootService {
    async edit_profile(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;
            const svgFile = req.file as Express.Multer.File;

            const { error } = EditProfileSchema.validate(body, { abortEarly: false } );
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(400).json({ error: "User not found"});

            const { username, password, email, group, name, agent, clientType } = body;
            let data_to_update = {};

            if (password) {
                const new_hash = await argon2.hash(password);

                data_to_update = {
                    password,
                    passwordHash: new_hash
                };
            };

            if (agent) {
                // const existingAgentIndex = check_user.agents.findIndex((a: any) => a.agentId === agent.agentId);

                // if (existingAgentIndex !== -1) {
                //     check_user.agents[existingAgentIndex] = agent;
                // } else {
                //     check_user.agents.push(agent);
                // }

                data_to_update = {
                    ...data_to_update,
                    "agents.0.agentId": agent
                };
            };

            if (email) {
                const check_email = await userModel.findOne({ email });
                if (check_email) return res.status(400).json({ error: "Email already exists for another user" });

                data_to_update = {
                    ...data_to_update,
                    email
                };
            };

            if (clientType) {
                if (!Object.values(ClientType).includes(clientType)) {
                    return res.status(400).json({ error: "Invalid client type" });
                };

                data_to_update = {
                    ...data_to_update,
                    clientType
                };
            };

            if (svgFile) {
                const uploadFileHandler = () => {
                    return new Promise((resolve, reject) => {
                        const svgImageResult = cloudinary.v2.uploader.upload_stream(
                            { 
                                resource_type: "image", 
                                folder: `Client_Logos`,
                                public_id: `${Date.now()}_cover_${svgFile.originalname.replace(/\s/g, "_")}`   
                            }, 
                            (error, data) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(data);
                                    return data; 
                                }
                            });

                        streamifier.createReadStream(svgFile.buffer).pipe(svgImageResult);
                    });
                };

                const svgResult = await uploadFileHandler() as any;
                const svgUrl = svgResult.secure_url;

                data_to_update = {
                    ...data_to_update,
                    svgUrl
                };

            };

            const fieldsToUpdate = { username, group, name };
            for (const [key, value] of Object.entries(fieldsToUpdate)) {
                if (value !== undefined && value !== null && value !== '') {
                    data_to_update = {
                        ...data_to_update,
                        [key]: value
                    };
                }
            };

            const updatedUser = await userModel.updateOne(
                { _id: clientId },
                { $set: data_to_update }
            );

            if (!updatedUser.acknowledged) {
                return res.status(400).json({ message: "Unable to update profile" });
            };

            return res.status(200).json({
                success: true,
                message: "Profile updated successfully"
                ,
                updatedFields: data_to_update
            });

        } catch (e) {
            console.error("Error editing profile: " + e);
            next(e);
        };
    };

};

export const profile_management_service = new ProfileManagementService();