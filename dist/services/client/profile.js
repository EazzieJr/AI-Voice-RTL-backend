"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profile_management_service = void 0;
const _root_1 = __importDefault(require("../_root"));
const profile_1 = require("../../validations/client/profile");
const userModel_1 = require("../../models/userModel");
const argon2_1 = __importDefault(require("argon2"));
const types_1 = require("../../utils/types");
const upload_1 = require("../../utils/upload");
const streamifier_1 = __importDefault(require("streamifier"));
const agent_1 = require("../../utils/agent");
class ProfileManagementService extends _root_1.default {
    async edit_profile(req, res, next) {
        try {
            const clientId = req.user._id;
            const body = req.body;
            const svgFile = req.file;
            const { error } = profile_1.EditProfileSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return res.status(400).json({ error: "User not found" });
            const { username, password, email, group, name, clientType, inbound, outbound, number } = body;
            let data_to_update = {};
            if (password) {
                const new_hash = await argon2_1.default.hash(password);
                data_to_update = {
                    password,
                    passwordHash: new_hash
                };
            }
            ;
            if (email) {
                const check_email = await userModel_1.userModel.findOne({ email });
                if (check_email)
                    return res.status(400).json({ error: "Email already exists for another user" });
                data_to_update = Object.assign(Object.assign({}, data_to_update), { email });
            }
            ;
            if (clientType) {
                if (!Object.values(types_1.ClientType).includes(clientType)) {
                    return res.status(400).json({ error: "Invalid client type" });
                }
                ;
                data_to_update = Object.assign(Object.assign({}, data_to_update), { clientType });
            }
            ;
            if (svgFile) {
                const uploadFileHandler = () => {
                    return new Promise((resolve, reject) => {
                        const svgImageResult = upload_1.cloudinary.v2.uploader.upload_stream({
                            resource_type: "image",
                            folder: `Client_Logos`,
                            public_id: `${Date.now()}_cover_${svgFile.originalname.replace(/\s/g, "_")}`
                        }, (error, data) => {
                            if (error) {
                                reject(error);
                            }
                            else {
                                resolve(data);
                                return data;
                            }
                        });
                        streamifier_1.default.createReadStream(svgFile.buffer).pipe(svgImageResult);
                    });
                };
                const svgResult = await uploadFileHandler();
                const svgUrl = svgResult.secure_url;
                data_to_update = Object.assign(Object.assign({}, data_to_update), { svgUrl });
            }
            ;
            const fieldsToUpdate = { username, group, name, number };
            for (const [key, value] of Object.entries(fieldsToUpdate)) {
                if (value !== undefined && value !== null && value !== '') {
                    data_to_update = Object.assign(Object.assign({}, data_to_update), { [key]: value });
                }
            }
            ;
            const updatedUser = await userModel_1.userModel.updateOne({ _id: clientId }, { $set: data_to_update }, { arrayFilters: [{ "elem.type": "inbound" }] });
            if (!updatedUser.acknowledged) {
                return res.status(400).json({ message: "Unable to update profile" });
            }
            ;
            if (inbound) {
                const check_inbound = await userModel_1.userModel.findOne({ _id: clientId, agents: { $elemMatch: { type: "inbound" } } });
                console.log("check inbound: ", check_inbound);
                if (check_inbound) {
                    const inboundAgent = check_user.agents.find(agent => agent.type === "inbound");
                    if (inboundAgent) {
                        console.log("Inbound agent exists");
                        const inbound_agent = inboundAgent.agentId;
                        const checkAgent = await userModel_1.userModel.find({ 'agents.agentId': inbound });
                        if (checkAgent.length > 0) {
                            return res.status(400).json({ message: "Inbound AgentId already exists" });
                        }
                        ;
                        const agentUpdate = await (0, agent_1.UpdateAgent)(inbound_agent, inbound, "inbound");
                        console.log("Agent update result: ", agentUpdate);
                        data_to_update = Object.assign(Object.assign({}, data_to_update), { inboundAgentUpdate: agentUpdate });
                    }
                    ;
                }
                else {
                    console.log("Inbound agent does not exist");
                    const push = await userModel_1.userModel.updateOne({ _id: clientId }, { $push: { agents: { type: "inbound", agentId: inbound } } });
                    console.log("Push result: ", push);
                    if (!push.acknowledged) {
                        return res.status(400).json({ message: "Unable to push inbound agent" });
                    }
                    ;
                    data_to_update = Object.assign(Object.assign({}, data_to_update), { newInboundAgent: { type: "inbound", agentId: inbound } });
                }
                ;
                console.log("data_to_update: ", data_to_update);
            }
            ;
            if (outbound) {
                const check_outbound = await userModel_1.userModel.findOne({ _id: clientId, agents: { $elemMatch: { type: "outbound" } } });
                console.log("check outbound: ", check_outbound);
                if (check_outbound) {
                    const outboundAgent = check_user.agents.find(agent => agent.type === "outbound");
                    if (outboundAgent) {
                        console.log("Outbound agent exists");
                        const outbound_agent = outboundAgent.agentId;
                        const checkAgent = await userModel_1.userModel.find({ 'agents.agentId': outbound });
                        if (checkAgent.length > 0) {
                            return res.status(400).json({ message: "Outbound AgentId already exists" });
                        }
                        ;
                        const agentUpdate = await (0, agent_1.UpdateAgent)(outbound_agent, outbound, "outbound");
                        console.log("Agent update result: ", agentUpdate);
                        data_to_update = Object.assign(Object.assign({}, data_to_update), { outboundAgentUpdate: agentUpdate });
                    }
                    ;
                }
                else {
                    return res.status(400).json({ message: "Outbound agent does not exist" });
                }
                ;
                console.log("data_to_update: ", data_to_update);
            }
            ;
            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                updatedFields: data_to_update
            });
        }
        catch (e) {
            console.error("Error editing profile: " + e);
            next(e);
        }
        ;
    }
    ;
    async client_details(req, res, next) {
        try {
            const clientId = req.user._id;
            const check_user = await userModel_1.userModel.findById(clientId).select("email username group name agents autoEmail svgUrl clientType").lean();
            if (!check_user)
                return res.status(400).json({ error: "User not found" });
            const inbound = check_user.agents.find((agent) => agent.type === "inbound");
            const outbound = check_user.agents.find((agent) => agent.type === "outbound");
            const result = Object.assign(Object.assign({ name: check_user.name, email: check_user.email, username: check_user.username, group: check_user.group, 
                // agentId: check_user?.agents[0]?.agentId || "",
                autoEmail: check_user.autoEmail || check_user.email, logo: check_user.svgUrl || "", clientType: check_user.clientType }, (inbound && { inbound: inbound.agentId })), (outbound && { outbound: outbound.agentId }));
            return res.status(200).json({
                success: true,
                result
            });
        }
        catch (e) {
            console.error("Error fetching client details: " + e);
            next(e);
        }
        ;
    }
    ;
}
;
exports.profile_management_service = new ProfileManagementService();
