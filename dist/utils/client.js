"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomatedResponses = void 0;
exports.convertMsToMinSec = convertMsToMinSec;
const contact_model_1 = require("../models/contact_model");
function convertMsToMinSec(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
;
const AutomatedResponses = async (jobId) => {
    const responses = await contact_model_1.contactModel.aggregate([
        {
            $match: {
                jobProcessedWithId: {
                    $in: [jobId]
                },
            }
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
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $match: {
                "referenceToCallId.disconnectionReason": {
                    $in: ["voicemail_reached", "machine_detected"]
                }
            }
        }
    ]);
    return responses.length;
};
exports.AutomatedResponses = AutomatedResponses;
