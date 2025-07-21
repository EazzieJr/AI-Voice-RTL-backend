import { userModel } from '../models/userModel';
import { contactModel, EventModel, jobModel } from '../models/contact_model';
import { dailyGraphModel } from '../models/graphModel';
import { DailyStatsModel } from '../models/logModel';
import callHistoryModel from '../models/historyModel';

export async function UpdateAgent(agentId: string, newAgentId: string, type: string) {
    try {
        let successUpdates = [];
        let failedUpdates = [];

        console.log("old agentId: ", agentId);
        console.log("new agentId: ", newAgentId);
        console.log("type: ", type);

        const user = await userModel.updateOne(
            { "agents.agentId": agentId, "agents.type": type },
            { $set: { "agents.$.agentId": newAgentId } }
        );

        if (user.acknowledged) {
            successUpdates.push("user");
        } else {
            failedUpdates.push("user");
        };

        const leads = await contactModel.updateMany(
            { agentId },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );

        if (leads.acknowledged) {
            successUpdates.push("leads");
        } else {
            failedUpdates.push("leads");
        };

        const transcript = await EventModel.updateMany(
            { agentId },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );
        if (transcript.acknowledged) {
            successUpdates.push("transcript");
        } else {
            failedUpdates.push("transcript");
        };

        const job = await jobModel.updateMany(
            { agentId },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );
        if (job.acknowledged) {
            successUpdates.push("job");
        } else {
            failedUpdates.push("job");
        };

        const graph = await dailyGraphModel.updateMany(
            { agentId },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );
        if (graph.acknowledged) {
            successUpdates.push("graph");
        } else {
            failedUpdates.push("graph");
        };

        const dailyStats = await DailyStatsModel.updateMany(
            { agentId },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );
        if (dailyStats.acknowledged) {
            successUpdates.push("daily stats");
        } else {
            failedUpdates.push("daily stats");
        };

        const history = await callHistoryModel.updateMany(
            { agentId, direction: type },
            {
                $set: {
                    agentId: newAgentId
                }
            }
        );
        if (history.acknowledged) {
            successUpdates.push("call history");
        } else {
            failedUpdates.push("call history");
        };

        return {
            successUpdates,
            failedUpdates
        };
        
    } catch (error) {
        console.error("Error updating agent:", error);
        throw error;
    };
};