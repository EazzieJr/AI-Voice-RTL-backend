import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../models/contact_model";
import path from "path";

export const statsToCsv = async (
  startDate: string,
  endDate: string,
  agentIds: [],
) => {
  try {
    const dailyStats = await contactModel
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

    const contactsData = await Promise.all(
      dailyStats.map(async (contact) => {
        const transcript = contact.referenceToCallId?.transcript;
        const analyzedTranscript =
          contact.referenceToCallId?.analyzedTranscript;
        const lastDateCalled =
          contact.datesCalled?.length > 0
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
          call_recording_url: contact.referenceToCallId?.recordingUrl,
          last_date_called: lastDateCalled,
        };
      }),
    );

    // Write contacts data to CSV file
    const filePath = path.join(__dirname, "..", "..", "public", "stats.csv");
    const csvWriter = createObjectCsvWriter({
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
  } catch (error) {
    console.error("Error occurred during CSV creation:", error);
    return `Error occurred during CSV creation: ${error}`;
  }
};
