import { createObjectCsvWriter } from "csv-writer";
import { contactModel, jobModel } from "../models/contact_model";
import path from "path";
import { callSentimentenum, callstatusenum, DateOption } from "../utils/types";
import { differenceInDays, addDays } from "date-fns";
import { subDays, startOfMonth, startOfWeek } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";

export const logsToCsv = async (
  agentId: string,
  newlimit?: number,
  startDate?: string,
  endDate?: string,
  statusOption?: "called" | "not-called" | "voicemail" | "failed" | "all",
  sentimentOption?:
    | "unknown"
    | "scheduled"
    | "call-back"
    | "neutral"
    | "positive"
    | "negative"
    | "dnc"
    | "all",
  dateOption?: string,
  tag?: string,
) => {
  try {
    const validSentimentOptions = [
      "unknown",
      "scheduled",
      "call-back",
      "neutral",
      "positive",
      "negative",
      "dnc",
      "all",
    ];

    if (sentimentOption && !validSentimentOptions.includes(sentimentOption)) {
      return { status: 400, error: "Invalid sentiment option provided." };
    }

    const validStatusOptions = [
      "called",
      "not-called",
      "voicemail",
      "failed",
      "all",
    ];

    if (statusOption && !validStatusOptions.includes(statusOption)) {
      return { status: 400, error: "Invalid status option provided." };
    }

    let dateFilter1 = {};

    const timeZone = "America/Los_Angeles"; // PST time zone
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);
    const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

    switch (dateOption) {
      case DateOption.Today:
        dateFilter1 = { day: today };
        break;
      case DateOption.Yesterday:
        const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
        const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
        dateFilter1 = { day: yesterday };
        break;
      case DateOption.ThisWeek:
        const pastDays = [];
        for (let i = 1; pastDays.length < 5; i++) {
          const day = subDays(now, i);
          const dayOfWeek = day.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // Exclude weekends
            pastDays.push(
              format(toZonedTime(day, timeZone), "yyyy-MM-dd", { timeZone }),
            );
          }
        }
        dateFilter1 = {
          day: { $gte: pastDays[pastDays.length - 1], $lte: today },
        };
        break;

      case DateOption.ThisMonth:
        const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
        const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
          timeZone,
        });
        dateFilter1 = { day: { $gte: startOfMonthDate } };
        break;
      case DateOption.Total:
        dateFilter1 = {};
        break;
      case DateOption.LAST_SCHEDULE:
        const recentJob = await jobModel
          .findOne({})
          .sort({ createdAt: -1 })
          .lean();
        if (!recentJob) {
          return "No jobs found for today's filter.";
        }
        const dateToCheck = recentJob.scheduledTime.split("T")[0];
        dateFilter1 = { day: { $gte: dateToCheck } };
        break;
    }

    let query: any = {
      isDeleted: false,
      ...dateFilter1,
    };

    if (agentId) {
      query.agentId = agentId;
    }

    if (statusOption && statusOption !== "all") {
      let callStatus;
      if (statusOption === "called") {
        callStatus = callstatusenum.CALLED;
      } else if (statusOption === "not-called") {
        callStatus = callstatusenum.NOT_CALLED;
      } else if (statusOption === "voicemail") {
        callStatus = callstatusenum.VOICEMAIL;
      } else if (statusOption === "failed") {
        callStatus = callstatusenum.FAILED;
      }
      query.dial_status = callStatus;
    }

    const formattedStartDate = startDate
      ? new Date(startDate).toISOString().split("T")[0]
      : null;
    const formattedEndDate = endDate
      ? new Date(endDate).toISOString().split("T")[0]
      : null;

    const getDatesInRange = (start: string, end: string): string[] => {
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      const daysDiff = differenceInDays(endDateObj, startDateObj);
      const dates = [];

      for (let i = 0; i <= daysDiff; i++) {
        dates.push(addDays(startDateObj, i).toISOString().split("T")[0]);
      }
      return dates;
    };

    // Filter by date range
    if (formattedStartDate && formattedEndDate) {
      const datesInRange = getDatesInRange(
        formattedStartDate,
        formattedEndDate,
      );
      query["datesCalled"] = { $in: datesInRange };
    } else if (formattedStartDate) {
      query["datesCalled"] = formattedStartDate;
    }

    if (tag) {
      query.tag = tag;
    }

    let contactQuery = contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .select(
        "firstname lastname email phone dial_status referenceToCallId datesCalled",
      )
      .populate(
        "referenceToCallId",
        "transcript analyzedTranscript recordingUrl",
      );

    console.log(
      "Executing MongoDB Query:",
      JSON.stringify(contactQuery.getQuery(), null, 2),
    );
    // Conditionally add limit if provided
    if (newlimit && Number.isInteger(newlimit) && newlimit > 0) {
      contactQuery = contactQuery.limit(newlimit);
    }

    const foundContacts = await contactQuery.exec();

    console.log(foundContacts.length);
    const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "firstname", title: "firstname" },
        { id: "lastname", title: "lastname" },
        { id: "email", title: "email" },
        { id: "phone", title: "phone" },
        { id: "dial_status", title: "status" },
        { id: "transcript", title: "transcript" },
        { id: "call_recording_url", title: "call_recording_url" },
        { id: "analyzedTranscript", title: "analyzedTranscript" },
        { id: "last_date_called", title: "last_date_called" },
      ],
    });
    let callSentimentStatus: string;
    if (sentimentOption === "unknown") {
      callSentimentStatus = callSentimentenum.UNKNOWN;
    } else if (sentimentOption === "dnc") {
      callSentimentStatus = callSentimentenum.DNC;
    } else if (sentimentOption === "scheduled") {
      callSentimentStatus = callSentimentenum.SCHEDULED;
    } else if (sentimentOption === "call-back") {
      callSentimentStatus = callSentimentenum.CALLBACK;
    } else if (sentimentOption === "neutral") {
      callSentimentStatus = callSentimentenum.NEUTRAL;
    } else if (sentimentOption === "positive") {
      callSentimentStatus = callSentimentenum.POSITIVE;
    } else if (sentimentOption === "negative") {
      callSentimentStatus = callSentimentenum.NEGATIVE;
    } else if (sentimentOption === "all") {
      callSentimentStatus = "";
    }
    console.log(callSentimentStatus);
    const contactsData = foundContacts
      .map((contact) => ({
        firstname: contact.firstname,
        lastname: contact.lastname,
        email: contact.email,
        phone: contact.phone,
        status: contact.dial_status,
        transcript: contact.referenceToCallId?.transcript,
        call_recording_url: contact.referenceToCallId?.recordingUrl,
        analyzedTranscript: contact.referenceToCallId?.analyzedTranscript,
        last_date_called: contact.datesCalled,
      }))
      .filter((contact) => {
        return (
          !sentimentOption || contact.analyzedTranscript === callSentimentStatus
        );
      });

    await csvWriter.writeRecords(contactsData);
    console.log("CSV file logs.csv has been written successfully");
    return filePath;
  } catch (error) {
    console.error(
      `Error generating CSV: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return {
      error:
        error instanceof Error ? error.message : "An unknown error occurred.",
    };
  }
};
