import { contactModel, jobModel } from "../models/contact_model";
import { DateOption } from "./types";
import { format, toZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";

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

export const DateFilterObjects = async (dateOption: DateOption, agentId: string): Promise<any> => {
    let dateFilter = {};
    let dateFilter2 = {};
    let date_to_check: {};

    const timeZone = "America/Los_Angeles";
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);
    const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

    switch (dateOption) {
        case DateOption.Today:
            dateFilter = { datesCalled: today };
            dateFilter2 = { day: today };
            date_to_check = { date: today };

            break;
        
        case DateOption.Yesterday:
            const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
            const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });

            dateFilter = { datesCalled: yesterday };
            dateFilter2 = { day: yesterday };
            date_to_check = { date: yesterday };
            break;

        case DateOption.ThisWeek:
            const weekdays: string[] = [];
            for (let i = 0; i < 7; i++) {
                const day = subDays(zonedNow, i);
                const dayOfWeek = day.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                    weekdays.push(valid_day);
                };
            };

            dateFilter = { datesCalled: { $in: weekdays }};
            dateFilter2 = { day: { $in: weekdays }};
            date_to_check = { date: { $in: weekdays } };

            break;

        case DateOption.ThisMonth:
            const monthDates: string[] = [];
            for (let i = 0; i < now.getDate(); i++) {
                const day = subDays(now, i);
                const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                monthDates.unshift(valid_day);
            };

            dateFilter = { datesCalled: { $in: monthDates } };
            dateFilter2 = { day: { $in: monthDates } };
            date_to_check = { date: { $in: monthDates } };

            break;

        case DateOption.PastMonth:
            const pastDates: string[] = [];
            for (let i = 0; i < 30; i++) {
                const day = subDays(now, i);
                const valid_day = format(day, "yyyy-MM-dd", { timeZone });
                pastDates.unshift(valid_day);
            };

            dateFilter = { datesCalled: { $in: pastDates } };
            dateFilter2 = { day: { $in: pastDates } };
            date_to_check = { date: { $in: pastDates } };

            break;

        case DateOption.Total:
            dateFilter = {};
            dateFilter2 = {};
            date_to_check = {};

            break;

        case DateOption.LAST_SCHEDULE:
            const recent_job = await jobModel
                .findOne({ agentId })
                .sort({ createdAt: -1 })
                .lean();

            if (!recent_job) {
                dateFilter = {};
                dateFilter2 = {};
                date_to_check = {};
            } else {
                const dateToCheck = recent_job.scheduledTime.split("T")[0];

                dateFilter = { datesCalled: dateToCheck };
                dateFilter2 = { day: dateToCheck };
                date_to_check = { date: dateToCheck };
            };

            break;
    };

    console.log("dateFilter: ", dateFilter);
    console.log("dateFilter2: ", dateFilter2);
    console.log("date_to_check: ", date_to_check);

    return { dateFilter, dateFilter2, date_to_check };
};