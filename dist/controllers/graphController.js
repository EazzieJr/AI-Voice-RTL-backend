"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatsByHour = updateStatsByHour;
const graphModel_1 = require("../models/graphModel");
const luxon_1 = require("luxon");
async function updateStatsByHour(agentId, date, timestamp) {
    try {
        const pstTime = luxon_1.DateTime.fromJSDate(timestamp).setZone("America/Los_Angeles");
        const currentHour = pstTime.toFormat("HH");
        const hourKey = `${currentHour}:00`;
        const statsUpdate = {
            $inc: {
                totalCalls: 1,
                [`hourlyCalls.${hourKey}`]: 1,
            },
        };
        const updatedStats = await graphModel_1.dailyGraphModel.findOneAndUpdate({ date, agentId }, statsUpdate, 
        // { upsert: true, new: true },
        { returnOriginal: false });
        return updatedStats;
    }
    catch (error) {
        console.error("Error in updateStatsByHour:", error);
        throw error;
    }
}
