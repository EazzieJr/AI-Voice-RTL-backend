"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restartScheduledJobs = void 0;
const contact_model_1 = require("../models/contact_model");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const types_1 = require("./types");
const jobExecutor_1 = require("./jobExecutor");
const restartScheduledJobs = async () => {
    try {
        console.log("Restarting scheduled jobs...");
        const now = (0, moment_timezone_1.default)().tz("America/Los_Angeles").format("YYYY-MM-DDTHH:mm:ss");
        console.log("Current time: ", now);
        const pendingJobs = await contact_model_1.jobModel.find({
            callstatus: types_1.jobstatus.QUEUED,
            shouldContinueProcessing: true,
            scheduledTime: { $gt: now }
        });
        if (!pendingJobs.length) {
            console.log("No pending jobs", pendingJobs);
            return;
        }
        ;
        for (const job of pendingJobs) {
            const { agentId, scheduledTime, tagProcessedFor, jobId, limit, fromNumber } = job;
            const contacts = await contact_model_1.contactModel.find(Object.assign(Object.assign({ agentId, dial_status: types_1.callstatusenum.NOT_CALLED, isDeleted: false }, (tagProcessedFor ? { tag: tagProcessedFor } : {})), { isOnDNCList: false, isTaken: true }))
                .limit(limit)
                .sort({ createdAt: "desc" });
            if (!contacts.length) {
                console.log("No contacts for requeued job; ", jobId);
                continue;
            }
            ;
            const scheduledTimePST = (0, moment_timezone_1.default)(scheduledTime)
                .tz("America/Los_Angeles")
                .toDate();
            console.log("Rescheduling job for; ", jobId);
            await (0, jobExecutor_1.executeJob)(jobId, agentId, scheduledTimePST, limit, fromNumber, tagProcessedFor);
        }
        ;
        console.log("All pending jobs have been rescheduled");
    }
    catch (e) {
        console.error("Error restarting scheduled jobs: ", e);
    }
    ;
};
exports.restartScheduledJobs = restartScheduledJobs;
