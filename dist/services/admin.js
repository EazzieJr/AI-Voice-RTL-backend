"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin_service = void 0;
const _root_1 = __importDefault(require("./_root"));
const admin_1 = require("../validations/admin");
const contact_model_1 = require("../models/contact_model");
const types_1 = require("../utils/types");
class AdminService extends _root_1.default {
    static getStatusOption(statusOption) {
        const statusMapping = {
            called: types_1.callstatusenum.CALLED,
            'not-called': types_1.callstatusenum.NOT_CALLED,
            voicemail: types_1.callstatusenum.VOICEMAIL,
            failed: types_1.callstatusenum.FAILED,
            transferred: types_1.callstatusenum.TRANSFERRED,
            scheduled: types_1.callstatusenum.SCHEDULED,
            ivr: types_1.callstatusenum.IVR,
            inactivity: types_1.callstatusenum.INACTIVITY,
        };
        return statusMapping[statusOption.toLowerCase()];
    }
    ;
    static getSentimentStatus(sentimentOption) {
        const sentimentMapping = {
            negative: 'NEGATIVE',
            'call-back': 'CALLBACK',
            positive: 'POSITIVE',
            scheduled: 'SCHEDULED',
            neutral: 'NEUTRAL',
            unknown: 'UNKNOWN',
            dnc: 'DNC',
        };
        return sentimentMapping[sentimentOption.toLowerCase()];
    }
    ;
    static formatDateToDB(dateString) {
        const date = new Date(dateString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    ;
    async search_client(req, res, next) {
        try {
            const body = req.body;
            const { error } = admin_1.SearchClientSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const { agentIds, statusOption, tag, sentimentOption, startDate, endDate } = body;
            const page = req.body.page || 1;
            const limit = req.body.limit || 100;
            const query = {
                agentId: { $in: agentIds },
                isDeleted: false
            };
            if (statusOption) {
                const status = AdminService.getStatusOption(statusOption);
                if (status) {
                    query.dial_status = status;
                }
                ;
            }
            ;
            if (tag) {
                query["tag"] == tag.toLowerCase();
            }
            ;
            if (startDate || endDate) {
                query["datesCalled"] = {};
                if (startDate === endDate)
                    return res.status(400).json({ message: "start and end date caannot be the same value" });
                const formattedStartDate = AdminService.formatDateToDB(startDate);
                const formattedEndDate = AdminService.formatDateToDB(endDate);
                const startDateObj = new Date(formattedStartDate);
                const endDateObj = new Date(formattedEndDate);
                // Check if startDate and endDate are valid Date objects
                const isValidStartDate = !isNaN(startDateObj.getTime());
                const isValidEndDate = !isNaN(endDateObj.getTime());
                if (isValidStartDate && isValidEndDate) {
                    query["datesCalled"] = {
                        $gte: formattedStartDate,
                        $lte: formattedEndDate,
                    };
                }
                else if (isValidStartDate) {
                    query["datesCalled"] = { $eq: formattedStartDate };
                }
                else if (isValidEndDate) {
                    return res.status(400).json({ message: "start date is required" });
                }
                ;
            }
            ;
            console.log("Query: ", query);
            let results;
            let totalRecords;
            let totalPages;
            if (sentimentOption) {
                const result = await contact_model_1.contactModel.aggregate([
                    {
                        $match: query
                    },
                    {
                        $lookup: {
                            from: "transcripts",
                            localField: "referenceToCallId",
                            foreignField: "_id",
                            as: "referenceToCallId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$referenceToCallId",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $match: {
                            'referenceToCallId.analyzedTranscript': sentimentOption
                        }
                    },
                    {
                        $facet: {
                            "totalRecords": [{ "$count": "count" }],
                            "results": [
                                { "$skip": (page - 1) * limit },
                                { "$limit": limit }
                            ]
                        }
                    }
                ]);
                console.log("result: ", result);
                if (result[0].results.length === 0) {
                    return res.status(200).json({ result: [], message: "No data found for your search params" });
                }
                ;
                totalRecords = result[0].totalRecords[0].count;
                results = result[0].results;
                totalPages = Math.ceil(totalRecords / limit);
                const startIndex = (page - 1) * limit;
                results = results.slice(startIndex, startIndex + limit);
            }
            else {
                const result = await contact_model_1.contactModel.aggregate([
                    {
                        $match: query
                    },
                    {
                        $lookup: {
                            from: "transcripts",
                            localField: "referenceToCallId",
                            foreignField: "_id",
                            as: "referenceToCallId"
                        }
                    },
                    {
                        $unwind: {
                            path: "$referenceToCallId",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $facet: {
                            "totalRecords": [{ "$count": "count" }],
                            "results": [
                                { "$skip": (page - 1) * limit },
                                { "$limit": limit }
                            ]
                        }
                    }
                ]);
                if (result[0].results.length === 0) {
                    return res.status(200).json({ message: "No data found for your search params" });
                }
                ;
                totalRecords = result[0].totalRecords[0].count;
                results = result[0].results;
                totalPages = Math.ceil(totalRecords / limit);
            }
            ;
            const data = results.map((contact) => {
                var _a, _b, _c, _d, _e, _f, _g;
                return ({
                    callId: contact.callId || "",
                    firstName: contact.firstname,
                    lastName: contact.lastname,
                    email: contact.email,
                    phone: contact.phone,
                    agentId: contact.agentId,
                    dial_status: contact.dial_status,
                    address: contact.address,
                    transcript: (_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript,
                    summary: (_b = contact.referenceToCallId) === null || _b === void 0 ? void 0 : _b.retellCallSummary,
                    status: (_c = contact.referenceToCallId) === null || _c === void 0 ? void 0 : _c.retellCallStatus,
                    duration: (_d = contact.referenceToCallId) === null || _d === void 0 ? void 0 : _d.duration,
                    sentiment: (_e = contact.referenceToCallId) === null || _e === void 0 ? void 0 : _e.analyzedTranscript,
                    timestamp: (_f = contact.referenceToCallId) === null || _f === void 0 ? void 0 : _f.timestamp,
                    recording: (_g = contact.referenceToCallId) === null || _g === void 0 ? void 0 : _g.recordingUrl
                });
            });
            return res.status(200).json({
                page,
                limit,
                totalRecords,
                totalPages,
                results: data,
            });
        }
        catch (e) {
            console.error("Error searching client: ", e);
            next(e);
        }
        ;
    }
    ;
}
;
exports.admin_service = new AdminService();
