"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllLLM = getAllLLM;
exports.getOneLLM = getOneLLM;
exports.updateAgent = updateAgent;
exports.updateLLM = updateLLM;
exports.revertLLM = revertLLM;
exports.revertAgent = revertAgent;
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const lllm_schema_1 = require("./lllm-schema");
const client = new retell_sdk_1.default({
    apiKey: process.env.RETELL_API_KEY,
});
async function getAllLLM() {
    try {
        const llmResponses = await client.llm.list();
        console.log(llmResponses);
        return {
            success: true,
            data: llmResponses,
        };
    }
    catch (error) {
        let errorMessage = "An unknown error occurred while retrieving LLMs.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === "string") {
            errorMessage = error;
        }
        console.error("Error getting LLMs:", errorMessage);
        return {
            success: false,
            message: errorMessage,
        };
    }
}
async function getOneLLM(llm_id) {
    try {
        if (!llm_id) {
            throw new Error("LLM ID is required.");
        }
        const llmResponse = await client.llm.retrieve(llm_id);
        return {
            success: true,
            data: llmResponse,
        };
    }
    catch (error) {
        let errorMessage = "An unknown error occurred while retrieving the LLM.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === "string") {
            errorMessage = error;
        }
        console.error("Error getting single LLM:", errorMessage);
        return {
            success: false,
            message: errorMessage,
        };
    }
}
async function updateAgent(agentId, payload) {
    try {
        const allowedKeys = [
            "agent_name",
            "ambient_sound",
            "ambient_sound_volume",
            "backchannel_frequency",
            "backchannel_words",
            "boosted_keywords",
            "enable_backchannel",
            "enable_voicemail_detection",
            "end_call_after_silence_ms",
            "fallback_voice_ids",
            "interruption_sensitivity",
            "language",
            "llm_websocket_url",
            "max_call_duration_ms",
            "normalize_for_speech",
            "opt_out_sensitive_data_storage",
            "post_call_analysis_data",
            "pronunciation_dictionary",
            "reminder_max_count",
            "reminder_trigger_ms",
            "responsiveness",
            "voice_id",
            "voice_model",
            "voice_speed",
            "voice_temperature",
            "voicemail_detection_timeout_ms",
            "voicemail_message",
            "volume",
            "webhook_url",
        ];
        const filteredPayload = Object.keys(payload)
            .filter((key) => allowedKeys.includes(key))
            .reduce((obj, key) => {
            obj[key] = payload[key];
            return obj;
        }, {});
        if (Object.keys(filteredPayload).length === 0) {
            return {
                success: false,
                message: "No valid fields to update. Please provide valid keys.",
            };
        }
        const previousData = await client.agent.retrieve(agentId);
        const result = await client.agent.update(agentId, filteredPayload);
        const lastUpdate = await lllm_schema_1.AgentUpdateHistory.findOne({ agentId })
            .sort({ createdAt: "desc" })
            .lean();
        const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;
        await lllm_schema_1.AgentUpdateHistory.create({
            agentId,
            previousData,
            updatedData: result,
            updateIndex: newUpdateIndex,
            timestamp: Date.now(),
        });
        return {
            success: true,
            message: "Agent updated successfully.",
            data: result,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "An unknown error occurred during the update operation.";
        return {
            success: false,
            message: "Failed to update agent.",
            error: errorMessage,
        };
    }
}
async function updateLLM(llmid, payload) {
    try {
        if (!payload || typeof payload !== "object") {
            return {
                success: false,
                message: "Invalid payload. Please provide an object with valid fields.",
            };
        }
        const allowedKeys = [
            "begin_message",
            "general_prompt",
            "general_tools",
            "inbound_dynamic_variables_webhook_url",
            "model",
            "model_temperature",
            "starting_state",
            "states",
        ];
        const filteredPayload = Object.keys(payload)
            .filter((key) => allowedKeys.includes(key))
            .reduce((obj, key) => {
            obj[key] = payload[key];
            return obj;
        }, {});
        if (Object.keys(filteredPayload).length === 0) {
            return {
                success: false,
                message: "No valid fields to update. Please provide valid keys.",
            };
        }
        const previousData = await client.llm.retrieve(llmid);
        const result = await client.llm.update(llmid, filteredPayload);
        const lastUpdate = await lllm_schema_1.LLMUpdateHistory.findOne({ llm_id: llmid })
            .sort({ createdAt: "desc" })
            .lean();
        const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;
        await lllm_schema_1.LLMUpdateHistory.create({
            llm_id: llmid,
            previousData,
            updatedData: result,
            updateIndex: newUpdateIndex,
            timestamp: Date.now(),
        });
        return {
            success: true,
            message: "LLM updated successfully.",
            data: result,
        };
    }
    catch (error) {
        console.error("Error updating LLM:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return {
            success: false,
            message: errorMessage,
        };
    }
}
async function revertLLM(llmid, updateIndex) {
    try {
        if (!llmid || typeof llmid !== "string") {
            return {
                success: false,
                message: "Invalid LLM ID. Please provide a valid llmid.",
            };
        }
        if (!updateIndex || typeof updateIndex !== "number") {
            return {
                success: false,
                message: "Invalid update index. Please provide a valid number.",
            };
        }
        const historyRecord = await lllm_schema_1.LLMUpdateHistory.findOne({
            llm_id: llmid,
            updateIndex,
        }).lean();
        if (!historyRecord) {
            return {
                success: false,
                message: `No history found for LLM ID ${llmid} at update index ${updateIndex}.`,
            };
        }
        const { previousData } = historyRecord;
        if (!previousData) {
            return {
                success: false,
                message: `No previous data available for LLM ID ${llmid} at update index ${updateIndex}.`,
            };
        }
        const result = await client.llm.update(llmid, previousData);
        const lastUpdate = await lllm_schema_1.LLMUpdateHistory.findOne({ llm_id: llmid })
            .sort({ createdAt: "desc" })
            .lean();
        const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;
        await lllm_schema_1.LLMUpdateHistory.create({
            llm_id: llmid,
            previousData: result,
            updatedData: previousData,
            updateIndex: newUpdateIndex,
            timestamp: Date.now(),
        });
        return {
            success: true,
            message: `LLM reverted successfully to update index ${updateIndex}.`,
            data: result,
        };
    }
    catch (error) {
        console.error("Error reverting LLM:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return {
            success: false,
            message: errorMessage,
        };
    }
}
async function revertAgent(agentId, updateIndex) {
    try {
        if (!agentId || typeof agentId !== "string") {
            return {
                success: false,
                message: "Invalid LLM ID. Please provide a valid llmid.",
            };
        }
        if (!updateIndex || typeof updateIndex !== "number") {
            return {
                success: false,
                message: "Invalid update index. Please provide a valid number.",
            };
        }
        const historyRecord = await lllm_schema_1.AgentUpdateHistory.findOne({
            agentId,
            updateIndex,
        }).lean();
        if (!historyRecord) {
            return {
                success: false,
                message: `No history found for LLM ID ${agentId} at update index ${updateIndex}.`,
            };
        }
        const { previousData } = historyRecord;
        if (!previousData) {
            return {
                success: false,
                message: `No previous data available for LLM ID ${agentId} at update index ${updateIndex}.`,
            };
        }
        const result = await client.llm.update(agentId, previousData);
        const lastUpdate = await lllm_schema_1.AgentUpdateHistory.findOne({ agentId })
            .sort({ createdAt: "desc" })
            .lean();
        const newUpdateIndex = lastUpdate ? lastUpdate.updateIndex + 1 : 1;
        await lllm_schema_1.AgentUpdateHistory.create({
            agentId,
            previousData: result,
            updatedData: previousData,
            updateIndex: newUpdateIndex,
            timestamp: Date.now(),
        });
        return {
            success: true,
            message: `LLM reverted successfully to update index ${updateIndex}.`,
            data: result,
        };
    }
    catch (error) {
        console.error("Error reverting LLM:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return {
            success: false,
            message: errorMessage,
        };
    }
}
