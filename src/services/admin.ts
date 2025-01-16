import RootService from "./_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/authRequest";
import { SearchClientSchema } from "../validations/admin";
import { contactModel } from "../models/contact_model";


class AdminService extends RootService {

    private static getStatusOption(statusOption: string): string | undefined {
        const statusMapping: { [key: string]: string } = {
            called: 'CALLED',
            'not-called': 'NOT_CALLED',
            voicemail: 'VOICEMAIL',
            failed: 'FAILED',
            transferred: 'TRANSFERRED',
            scheduled: 'SCHEDULED',
            ivr: 'IVR',
            inactivity: 'INACTIVITY',
        };
        return statusMapping[statusOption.toLowerCase()];
    };

    private static getSentimentStatus(sentimentOption: string): string | undefined {
        const sentimentMapping: { [key: string]: string } = {
            negative: 'NEGATIVE',
            'call-back': 'CALLBACK',
            positive: 'POSITIVE',
            scheduled: 'SCHEDULED',
            neutral: 'NEUTRAL',
            unknown: 'UNKNOWN',
            dnc: 'DNC',
        };
        return sentimentMapping[sentimentOption.toLowerCase()];
    };

    private static formatDateToDB(dateString: string): string {
        const date = new Date(dateString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    async search_client(req: AuthRequest, res: Response, next: NextFunction): Promise<Response> {
        try {
            const body = req.body;

            const { error } = SearchClientSchema.validate(body, { abortEarly: false });
            if (error) return this.handle_validation_errors(error, res, next);

            const { agentIds, statusOption, tag, sentimentOption, startDate, endDate } = body;
            const page = req.body.page || 1;
            const limit = req.body.limit || 100;

            const query: any = {
                agentId: { $in: agentIds },
                isDeleted: false
            };

            if (statusOption) {
                const status = AdminService.getStatusOption(statusOption);

                if (status) {
                    query.dial_status = status;
                };
            };

            if (tag) {
                query["tag"] == tag.toLowerCase();
            };

            const sentimentStatus = sentimentOption ? AdminService.getSentimentStatus(sentimentOption): undefined;
            console.log("sentime: ", sentimentStatus);

            const timeZone = "America/Los_Angeles"; // PST time zone
            const now = new Date();

            if (startDate || endDate) {
                query["datesCalled"] = {};

                if (startDate === endDate) return res.status(400).json({ message: "start and end date caannot be the same value" });

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
                } else if (isValidStartDate) {
                    query["datesCalled"] = { $eq: formattedStartDate };
                } else if (isValidEndDate) {
                    return res.status(400).json({ message: "start date is required" });
                };
            };

            let results;
            let totalRecords;
            let totalPages;

            if (sentimentOption) {

                const result = await contactModel.aggregate([
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
                            "totalRecords": [{ "$count": "count"}],
                            "results": [
                              { "$skip": (page - 1) * limit},
                              { "$limit": limit }
                            ]
                        }
                    }
                ]);

                totalRecords = result[0].totalRecords[0].count;
                results = result[0].results;

                totalPages = Math.ceil(totalRecords / limit);
                const startIndex = (page - 1) * limit;
                results = results.slice(startIndex, startIndex + limit);
            } else {
                totalRecords = await contactModel.countDocuments(query);
                totalPages = Math.ceil(totalRecords / limit);

                results = await contactModel
                    .find(query)
                    .populate("referenceToCallId")
                    .skip((page - 1) * limit)
                    .limit(limit);
            };

            return res.status(200).json({
                page,
                limit,
                totalRecords,
                totalPages,
                results,
            });
            
        } catch (e) {
            console.error("Error searching client: ", e);
            next(e);
        };
    };
};

export const admin_service = new AdminService();