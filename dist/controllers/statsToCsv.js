"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsToCsv = void 0;
const csv_writer_1 = require("csv-writer");
const contact_model_1 = require("../models/contact_model");
const path_1 = __importDefault(require("path"));
const statsToCsv = async (startDate, endDate, agentIds) => {
    try {
        const dailyStats = await contact_model_1.contactModel
            .find({
            $and: [
                { agentId: { $in: agentIds } },
                { isDeleted: false },
                {
                    $and: [
                        {
                            datesCalled: { $gte: startDate },
                        },
                        {
                            datesCalled: { $lte: endDate },
                        },
                    ],
                },
            ],
        })
            .sort({ createdAt: "desc" })
            .populate("referenceToCallId");
        const contactsData = await Promise.all(dailyStats.map(async (contact) => {
            var _a, _b, _c, _d;
            const transcript = (_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript;
            const analyzedTranscript = (_b = contact.referenceToCallId) === null || _b === void 0 ? void 0 : _b.analyzedTranscript;
            const lastDateCalled = ((_c = contact.datesCalled) === null || _c === void 0 ? void 0 : _c.length) > 0
                ? contact.datesCalled[contact.datesCalled.length - 1]
                : null;
            return {
                firstname: contact.firstname,
                lastname: contact.lastname,
                email: contact.email,
                phone: contact.phone,
                status: contact.dial_status,
                transcript: transcript,
                analyzedTranscript: analyzedTranscript,
                call_recording_url: (_d = contact.referenceToCallId) === null || _d === void 0 ? void 0 : _d.recordingUrl,
                last_date_called: lastDateCalled,
            };
        }));
        // Write contacts data to CSV file
        const filePath = path_1.default.join(__dirname, "..", "..", "public", "stats.csv");
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: "firstname", title: "firstname" },
                { id: "lastname", title: "lastname" },
                { id: "email", title: "email" },
                { id: "phone", title: "phone" },
                { id: "dial_status", title: "Status" },
                { id: "transcript", title: "transcript" },
                { id: "call_recording_url", title: "call_recording_url" },
                { id: "analyzedTranscript", title: "analyzedTranscript" },
                { id: "last_date_called", title: "last_date_called" },
            ],
        });
        await csvWriter.writeRecords(contactsData);
        console.log("CSV file stats.csv has been written successfully");
        return filePath;
    }
    catch (error) {
        console.error("Error occurred during CSV creation:", error);
        return `Error occurred during CSV creation: ${error}`;
    }
};
exports.statsToCsv = statsToCsv;
