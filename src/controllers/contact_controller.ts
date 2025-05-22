import { DateOption, IContact, Ijob, callstatusenum } from "../utils/types";
import { contactModel, EventModel, jobModel } from "../models/contact_model";
import mongoose, { Document } from "mongoose";
import axios from "axios";
import Retell from "retell-sdk";
import { subDays, startOfMonth, startOfWeek } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { DailyStatsModel } from "../models/logModel";
import callHistoryModel from "../models/historyModel";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string,
  lowerCaseTags: string,
  dayToBeProcessed?: string,
  address?: string,
): Promise<IContact | string> => {
  try {
    if (!firstname || !email || !phone) {
      return "Missing required fields";
    }
    function formatPhoneNumber(phoneNumber: string) {
      let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

      if (phoneNumber.startsWith("+1")) {
        return `+${digitsOnly}`;
      }

      return `+1${digitsOnly}`;
    }
    const createdContact = await contactModel.create({
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
  } catch (error) {
    console.log("Error creating contact:", error);
    return null;
  }
};

export type ContactDocument = Omit<Document & IContact, "_id">;

export const getAllContact = async (
  agentId: string,
  page: number,
  limit: number,
  jobId?: string,
  dateOption?: DateOption,
) => {
  try {
    const skip = (page - 1) * limit;
    let dateFilter = {};
    let dateFilter1 = {};
    let tag = {};

    const timeZone = "America/Los_Angeles";
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);
    const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

    if (jobId) {
      const job = await jobModel.findOne({ jobId, agentId }).lean<any>();
      if (job && job.createdAt) {
        const createdAtDate = new Date(job.createdAt)
          .toISOString()
          .split("T")[0];
        dateFilter = { datesCalled: createdAtDate };
        dateFilter1 = { day: createdAtDate };
        tag = { tag: job.tagProcessedFor };
      }
    } else if (dateOption) {
      switch (dateOption) {
        case DateOption.Today:
          dateFilter = { datesCalled: today };
          dateFilter1 = { day: today };
          break;
        case DateOption.Yesterday:
          const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
          const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
          dateFilter = { datesCalled: yesterday };
          dateFilter1 = { day: yesterday };
          break;
        case DateOption.ThisWeek:
          const weekdays: string[] = [];
          for (let i = 0; i < 7; i++) {
            const day = subDays(zonedNow, i);
            const dayOfWeek = day.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              weekdays.push(format(day, "yyyy-MM-dd", { timeZone }));
            }
          }
          dateFilter = { datesCalled: { $in: weekdays } };
          dateFilter1 = { day: { $in: weekdays } };
          break;
        case DateOption.ThisMonth:
          const monthDates: string[] = [];
          for (let i = 0; i < now.getDate(); i++) {
            const day = subDays(now, i);
            monthDates.unshift(format(day, "yyyy-MM-dd", { timeZone }));
          }
          dateFilter = { datesCalled: { $in: monthDates } };
          dateFilter1 = { day: { $in: monthDates } };
          break;
        default:
          const recentJob = await jobModel
            .findOne({ agentId })
            .sort({ createdAt: -1 })
            .lean();

          if (recentJob) {
            const dateToCheck = recentJob.scheduledTime.split("T")[0];

            dateFilter = { datesCalled: dateToCheck };
            dateFilter1 = { day: dateToCheck };
          } else {
            dateFilter = {};
            dateFilter1 = {};
          }
          break;
        case DateOption.Total:
          dateFilter = {};
          dateFilter1 = {};
          break;
      }
    }
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: false, ...dateFilter, ...tag })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .skip(skip)
      .limit(limit);

    console.log({ agentId, dateFilter, tag });

    const totalCount = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      ...dateFilter,
      ...tag,
    });

    const totalContactForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
    });
    const totalNotCalledForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.NOT_CALLED,
    });

    const stats = await DailyStatsModel.aggregate([
      { $match: { agentId, ...dateFilter1 } },
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

    const totalAnsweredCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: {$ne:callstatusenum.NOT_CALLED},
    });

    const totalAnsweredByIVR = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.IVR,
    });

    
    const totalAnsweredByVm = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.VOICEMAIL,
    });

    
    const totalCallsTransffered = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.TRANSFERRED,
    });

    const totalCallotAnswered = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.NO_ANSWER,
    });

    const totalCallInactivity = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.INACTIVITY,
    });

    const totalAppointment = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.SCHEDULED,
    });
    
    const totalFailedCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      dial_status: callstatusenum.FAILED,
    });
    const totalPages = Math.ceil(totalCount / limit);

    const statsWithTranscripts = await Promise.all(
      foundContacts.map(async (stat) => {
        const transcript = stat.referenceToCallId?.transcript;
        const analyzedTranscript = stat.referenceToCallId?.analyzedTranscript;
        return {
          ...stat.toObject(),
          originalTranscript: transcript,
          analyzedTranscript,
        };
      }),
    );

    function convertMsToHourMinSec(ms: number): string {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0",
      )}:${String(seconds).padStart(2, "0")}`;
    }

    const combinedCallDuration = convertMsToHourMinSec(
      stats[0]?.totalCallDuration || 0,
    );

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
  } catch (error) {
    console.error("Error fetching all contacts:", error);
    return "error getting contact";
  }
};

export const deleteOneContact = async (id: string) => {
  try {
    const deleteContact = await contactModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } },
      { new: true },
    );
    return deleteContact;
  } catch (error) {
    console.error("Error deleting contact:", error);
    return "delete failed, something went wrong";
  }
};

export const updateOneContact = async (id: string, updateFields: object) => {
  try {
    const updatedContact = await contactModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: updateFields },
      { new: true },
    );
    return updatedContact;
  } catch (error) {
    console.error("Error updating contact:", error);
    return "could not update contact";
  }
};

export const updateContactAndTranscript = async (
  updates: any,
): Promise<any> => {
  try {
    for (const update of updates) {
      if (update.callId) {
        await contactModel.findOneAndUpdate(
          {
            callId: update.callId,
            isDeleted: { $ne: true },
          },
          { $set: update.updateFields },
          { new: true },
        );
      }

      if (
        update.updateFields.referencetocallid &&
        update.updateFields.referencetocallid.callId
      ) {
        await EventModel.findOneAndUpdate(
          {
            callId: update.updateFields.referencetocallid.callId,
          },
          { $set: update.updateFields.referencetocallid.updateFields },
          { new: true },
        );
      }
    }

    return "Update successful";
  } catch (error) {
    console.error("Error updating contact and transcript:", error);
    return "Could not update contact and transcript";
  }
};

export const updateContactAndTranscriptForClient = async (
  update: any,
): Promise<any> => {
  console.log(update, "hr");
  try {
    if (!update.callId) {
      throw new Error("callId is required for updating records");
    }

    console.log(update);
    // Helper function to filter out undefined values
    const filterFields = (fields: any) =>
      Object.fromEntries(
        Object.entries(fields).filter(([_, value]) => value !== undefined),
      );

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
      toNumber: update.phone
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

    const updatedData: any = {};

    // Update contactModel and merge updated fields
    if (Object.keys(dataForContactModel).length > 0) {
      console.log(dataForContactModel);
      await contactModel.findOneAndUpdate(
        { callId: update.callId },
        { $set: dataForContactModel },
        { new: true },
      );
      Object.assign(updatedData, dataForContactModel);
    }

    // Update callHistoryModel and merge updated fields
    if (Object.keys(dataForHistoryModel).length > 0) {
      console.log(dataForHistoryModel);
      await callHistoryModel.findOneAndUpdate(
        { callId: update.callId },
        { $set: dataForHistoryModel },
        { new: true },
      );
      Object.assign(updatedData, dataForHistoryModel);
    }

    // Update callHistoryModel and merge updated fields
    if (Object.keys(dataForTranscriptModel).length > 0) {
      console.log(dataForTranscriptModel);
      await EventModel.findOneAndUpdate(
        { callId: update.callId },
        { $set: dataForTranscriptModel },
        { new: true },
      );
      Object.assign(updatedData, dataForTranscriptModel);
    }

    return {
      message: "Update successful",
      updatedData,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
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
