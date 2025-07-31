import { contactModel } from "../models/contact_model";


export function convertMsToMinSec(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const AutomatedResponses = async (jobId: string): Promise<number> => {
    const responses = await contactModel.aggregate([
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