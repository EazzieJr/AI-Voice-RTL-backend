"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAgent = UpdateAgent;
const userModel_1 = require("../models/userModel");
const contact_model_1 = require("../models/contact_model");
const graphModel_1 = require("../models/graphModel");
const logModel_1 = require("../models/logModel");
const historyModel_1 = __importDefault(require("../models/historyModel"));
async function UpdateAgent(agentId, newAgentId, type) {
    try {
        let successUpdates = [];
        let failedUpdates = [];
        console.log("old agentId: ", agentId);
        console.log("new agentId: ", newAgentId);
        console.log("type: ", type);
        const user = await userModel_1.userModel.updateOne({ "agents.agentId": agentId, "agents.type": type }, { $set: { "agents.$.agentId": newAgentId } });
        if (user.acknowledged) {
            successUpdates.push("user");
        }
        else {
            failedUpdates.push("user");
        }
        ;
        const leads = await contact_model_1.contactModel.updateMany({ agentId }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (leads.acknowledged) {
            successUpdates.push("leads");
        }
        else {
            failedUpdates.push("leads");
        }
        ;
        const transcript = await contact_model_1.EventModel.updateMany({ agentId }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (transcript.acknowledged) {
            successUpdates.push("transcript");
        }
        else {
            failedUpdates.push("transcript");
        }
        ;
        const job = await contact_model_1.jobModel.updateMany({ agentId }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (job.acknowledged) {
            successUpdates.push("job");
        }
        else {
            failedUpdates.push("job");
        }
        ;
        const graph = await graphModel_1.dailyGraphModel.updateMany({ agentId }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (graph.acknowledged) {
            successUpdates.push("graph");
        }
        else {
            failedUpdates.push("graph");
        }
        ;
        const dailyStats = await logModel_1.DailyStatsModel.updateMany({ agentId }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (dailyStats.acknowledged) {
            successUpdates.push("daily stats");
        }
        else {
            failedUpdates.push("daily stats");
        }
        ;
        const history = await historyModel_1.default.updateMany({ agentId, direction: type }, {
            $set: {
                agentId: newAgentId
            }
        });
        if (history.acknowledged) {
            successUpdates.push("call history");
        }
        else {
            failedUpdates.push("call history");
        }
        ;
        return {
            successUpdates,
            failedUpdates
        };
    }
    catch (error) {
        console.error("Error updating agent:", error);
        throw error;
    }
    ;
}
;
