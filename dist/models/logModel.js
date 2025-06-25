"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyStatsModel = void 0;
const mongoose_1 = require("mongoose");
const dailyStatsSchema = new mongoose_1.Schema({
    day: { type: String },
    totalCalls: { type: Number },
    totalTransffered: { type: Number },
    totalAnsweredByVm: { type: Number },
    totalFailed: { type: Number },
    totalAppointment: { type: Number },
    totalCallAnswered: { type: Number },
    agentId: { type: String },
    jobProcessedBy: { type: String },
    totalDialNoAnswer: { type: Number },
    totalAnsweredByIVR: { type: Number },
    totalCallInactivity: { type: Number },
    totalCallDuration: { type: Number }
}, { timestamps: true });
// Create model for daily call statistics
exports.DailyStatsModel = (0, mongoose_1.model)("DailyStats", dailyStatsSchema);
