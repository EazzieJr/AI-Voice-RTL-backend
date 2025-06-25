"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContactAndTranscriptForClient = exports.updateContactAndTranscript = exports.updateOneContact = exports.deleteOneContact = exports.getAllContact = exports.createContact = void 0;
const types_1 = require("../utils/types");
const contact_model_1 = require("../models/contact_model");
const retell_sdk_1 = __importDefault(require("retell-sdk"));
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
const logModel_1 = require("../models/logModel");
const historyModel_1 = __importDefault(require("../models/historyModel"));
const retell = new retell_sdk_1.default({
    apiKey: process.env.RETELL_API_KEY,
});
const createContact = async (firstname, lastname, email, phone, agentId, lowerCaseTags, dayToBeProcessed, address) => {
    try {
        if (!firstname || !email || !phone) {
            return "Missing required fields";
        }
        function formatPhoneNumber(phoneNumber) {
            let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");
            if (phoneNumber.startsWith("+1")) {
                return `+${digitsOnly}`;
            }
            return `+1${digitsOnly}`;
        }
        const createdContact = await contact_model_1.contactModel.create({
            firstname,
            lastname,
            email,
            phone: formatPhoneNumber(phone),
            agentId,
            tags: lowerCaseTags,
            dayToBeProcessed,
            address,
        });
        return createdContact;
    }
    catch (error) {
        console.log("Error creating contact:", error);
        return null;
    }
};
exports.createContact = createContact;
const getAllContact = async (agentId, page, limit, jobId, dateOption) => {
    var _a;
    try {
        const skip = (page - 1) * limit;
        let dateFilter = {};
        let dateFilter1 = {};
        let tag = {};
        const timeZone = "America/Los_Angeles";
        const now = new Date();
        const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
        const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
        if (jobId) {
            const job = await contact_model_1.jobModel.findOne({ jobId, agentId }).lean();
            if (job && job.createdAt) {
                const createdAtDate = new Date(job.createdAt)
                    .toISOString()
                    .split("T")[0];
                dateFilter = { datesCalled: createdAtDate };
                dateFilter1 = { day: createdAtDate };
                tag = { tag: job.tagProcessedFor };
            }
        }
        else if (dateOption) {
            switch (dateOption) {
                case types_1.DateOption.Today:
                    dateFilter = { datesCalled: today };
                    dateFilter1 = { day: today };
                    break;
                case types_1.DateOption.Yesterday:
                    const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                    const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", { timeZone });
                    dateFilter = { datesCalled: yesterday };
                    dateFilter1 = { day: yesterday };
                    break;
                case types_1.DateOption.ThisWeek:
                    const weekdays = [];
                    for (let i = 0; i < 7; i++) {
                        const day = (0, date_fns_1.subDays)(zonedNow, i);
                        const dayOfWeek = day.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                        }
                    }
                    dateFilter = { datesCalled: { $in: weekdays } };
                    dateFilter1 = { day: { $in: weekdays } };
                    break;
                case types_1.DateOption.ThisMonth:
                    const monthDates = [];
                    for (let i = 0; i < now.getDate(); i++) {
                        const day = (0, date_fns_1.subDays)(now, i);
                        monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                    }
                    dateFilter = { datesCalled: { $in: monthDates } };
                    dateFilter1 = { day: { $in: monthDates } };
                    break;
                default:
                    const recentJob = await contact_model_1.jobModel
                        .findOne({ agentId })
                        .sort({ createdAt: -1 })
                        .lean();
                    if (recentJob) {
                        const dateToCheck = recentJob.scheduledTime.split("T")[0];
                        dateFilter = { datesCalled: dateToCheck };
                        dateFilter1 = { day: dateToCheck };
                    }
                    else {
                        dateFilter = {};
                        dateFilter1 = {};
                    }
                    break;
                case types_1.DateOption.Total:
                    dateFilter = {};
                    dateFilter1 = {};
                    break;
            }
        }
        const foundContacts = await contact_model_1.contactModel
            .find(Object.assign(Object.assign({ agentId, isDeleted: false }, dateFilter), tag))
            .sort({ createdAt: "desc" })
            .populate("referenceToCallId")
            .skip(skip)
            .limit(limit);
        console.log({ agentId, dateFilter, tag });
        const totalCount = await contact_model_1.contactModel.countDocuments(Object.assign(Object.assign({ agentId, isDeleted: false }, dateFilter), tag));
        const totalContactForAgent = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
        });
        const totalNotCalledForAgent = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.NOT_CALLED,
        });
        const stats = await logModel_1.DailyStatsModel.aggregate([
            { $match: Object.assign({ agentId }, dateFilter1) },
            {
                $group: {
                    _id: null,
                    totalCalls: { $sum: "$totalCalls" },
                    totalAnsweredByVm: { $sum: "$totalAnsweredByVm" },
                    totalAppointment: { $sum: "$totalAppointment" },
                    totalCallsTransffered: { $sum: "$totalTransffered" },
                    totalFailedCalls: { $sum: "$totalFailed" },
                    totalAnsweredCalls: { $sum: "$totalCallAnswered" },
                    totalDialNoAnswer: { $sum: "$totalDialNoAnswer" },
                    totalAnsweredByIVR: { $sum: "$totalAnsweredByIVR" },
                    totalCallInactivity: { $sum: "$totalCallInactivity" },
                    totalCallDuration: { $sum: "$totalCallDuration" },
                },
            },
        ]);
        const totalAnsweredCalls = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: { $ne: types_1.callstatusenum.NOT_CALLED },
        });
        const totalAnsweredByIVR = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.IVR,
        });
        const totalAnsweredByVm = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.VOICEMAIL,
        });
        const totalCallsTransffered = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.TRANSFERRED,
        });
        const totalCallotAnswered = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.NO_ANSWER,
        });
        const totalCallInactivity = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.INACTIVITY,
        });
        const totalAppointment = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.SCHEDULED,
        });
        const totalFailedCalls = await contact_model_1.contactModel.countDocuments({
            agentId,
            isDeleted: false,
            dial_status: types_1.callstatusenum.FAILED,
        });
        const totalPages = Math.ceil(totalCount / limit);
        const statsWithTranscripts = await Promise.all(foundContacts.map(async (stat) => {
            var _a, _b;
            const transcript = (_a = stat.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript;
            const analyzedTranscript = (_b = stat.referenceToCallId) === null || _b === void 0 ? void 0 : _b.analyzedTranscript;
            return Object.assign(Object.assign({}, stat.toObject()), { originalTranscript: transcript, analyzedTranscript });
        }));
        function convertMsToHourMinSec(ms) {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }
        const combinedCallDuration = convertMsToHourMinSec(((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.totalCallDuration) || 0);
        return {
            totalContactForAgent,
            totalAnsweredCalls,
            totalAnsweredByVm,
            totalAppointment,
            totalCallsTransffered,
            totalNotCalledForAgent,
            totalFailedCalls,
            totalAnsweredByIVR,
            totalCallotAnswered,
            totalCallInactivity,
            callDuration: combinedCallDuration,
            totalPages,
            contacts: statsWithTranscripts,
        };
    }
    catch (error) {
        console.error("Error fetching all contacts:", error);
        return "error getting contact";
    }
};
exports.getAllContact = getAllContact;
const deleteOneContact = async (id) => {
    try {
        const deleteContact = await contact_model_1.contactModel.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: { isDeleted: true } }, { new: true });
        return deleteContact;
    }
    catch (error) {
        console.error("Error deleting contact:", error);
        return "delete failed, something went wrong";
    }
};
exports.deleteOneContact = deleteOneContact;
const updateOneContact = async (id, updateFields) => {
    try {
        const updatedContact = await contact_model_1.contactModel.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: updateFields }, { new: true });
        return updatedContact;
    }
    catch (error) {
        console.error("Error updating contact:", error);
        return "could not update contact";
    }
};
exports.updateOneContact = updateOneContact;
const updateContactAndTranscript = async (updates) => {
    try {
        for (const update of updates) {
            if (update.callId) {
                await contact_model_1.contactModel.findOneAndUpdate({
                    callId: update.callId,
                    isDeleted: { $ne: true },
                }, { $set: update.updateFields }, { new: true });
            }
            if (update.updateFields.referencetocallid &&
                update.updateFields.referencetocallid.callId) {
                await contact_model_1.EventModel.findOneAndUpdate({
                    callId: update.updateFields.referencetocallid.callId,
                }, { $set: update.updateFields.referencetocallid.updateFields }, { new: true });
            }
        }
        return "Update successful";
    }
    catch (error) {
        console.error("Error updating contact and transcript:", error);
        return "Could not update contact and transcript";
    }
};
exports.updateContactAndTranscript = updateContactAndTranscript;
const updateContactAndTranscriptForClient = async (update) => {
    console.log(update, "hr");
    try {
        if (!update.callId) {
            throw new Error("callId is required for updating records");
        }
        console.log(update);
        // Helper function to filter out undefined values
        const filterFields = (fields) => Object.fromEntries(Object.entries(fields).filter(([_, value]) => value !== undefined));
        // Data for each model
        const dataForContactModel = filterFields({
            firstname: update.firstname,
            lastname: update.lastname,
            email: update.email,
            phone: update.phone,
            agentId: update.agentId,
        });
        const dataForHistoryModel = filterFields({
            transcript: update.transcript,
            callSummary: update.summary,
            userSentiment: update.sentiment,
            endTimestamp: update.timestamp,
            durationMs: update.duration,
            callStatus: update.status,
            recordingUrl: update.recordingUrl,
            address: update.address,
            userFirstname: update.firstname,
            userLastname: update.lastname,
            userEmail: update.email,
            agentId: update.agentId,
            toNumber: update.phone,
            call_outcome: update.call_outcome
        });
        const dataForTranscriptModel = filterFields({
            transcript: update.transcript,
            retellCallSummary: update.summary,
            userSentiment: update.sentiment,
            duration: update.duration,
            retellCallStatus: update.status,
            recordingUrl: update.recordingUrl,
            address: update.address,
            analyzedTranscript: update.sentiment,
            agentId: update.agentId
        });
        const updatedData = {};
        // Update contactModel and merge updated fields
        if (Object.keys(dataForContactModel).length > 0) {
            console.log(dataForContactModel);
            await contact_model_1.contactModel.findOneAndUpdate({ callId: update.callId }, { $set: dataForContactModel }, { new: true });
            Object.assign(updatedData, dataForContactModel);
        }
        // Update callHistoryModel and merge updated fields
        if (Object.keys(dataForHistoryModel).length > 0) {
            console.log(dataForHistoryModel);
            await historyModel_1.default.findOneAndUpdate({ callId: update.callId }, { $set: dataForHistoryModel }, { new: true });
            Object.assign(updatedData, dataForHistoryModel);
        }
        // Update callHistoryModel and merge updated fields
        if (Object.keys(dataForTranscriptModel).length > 0) {
            console.log(dataForTranscriptModel);
            await contact_model_1.EventModel.findOneAndUpdate({ callId: update.callId }, { $set: dataForTranscriptModel }, { new: true });
            Object.assign(updatedData, dataForTranscriptModel);
        }
        return {
            message: "Update successful",
            updatedData,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Error updating contact and transcript:", {
            error: errorMessage,
            callId: update.callId,
        });
        return {
            message: "Could not update contact and transcript",
            error: errorMessage,
        };
    }
};
exports.updateContactAndTranscriptForClient = updateContactAndTranscriptForClient;
