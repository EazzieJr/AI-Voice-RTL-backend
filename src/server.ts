process.env.TZ = "America/Los_Angeles";
import cors from "cors";
import { format, toZonedTime } from "date-fns-tz";
import express, { Request, Response, Router } from "express";
import expressWs from "express-ws";

import { Server as HTTPServer, createServer as httpCreateServer } from "http";

import { Retell } from "retell-sdk";
import { createArrayCsvWriter, createObjectCsvWriter } from "csv-writer";
import {
  createContact,
  deleteOneContact,
  getAllContact,
  updateContactAndTranscript,
  updateContactAndTranscriptForClient,
  updateOneContact,
} from "./controllers/contact_controller";

import csv from "csv-parser";

import {
  connectDb,
  contactModel,
  jobModel,
  EventModel,
} from "./models/contact_model";
import axios from "axios";
import argon2 from "argon2";
// import { TwilioClient } from "./twilio_api";

import { callSentimentenum, DateOption, Ilogs } from "./utils/types";
import {
  IContact,
  RetellRequest,
  callstatusenum,
  jobstatus,
} from "./utils/types";
import * as Papa from "papaparse";
import { subDays, startOfMonth, isFirstDayOfMonth } from "date-fns";
import fs from "fs";
import multer from "multer";
import moment from "moment-timezone";
import schedule from "node-schedule";
import path from "path";
import SmeeClient from "smee-client";
import { DailyStatsModel } from "./models/logModel";
import { logsToCsv } from "./controllers/adminExportToCsv";
import { statsToCsv } from "./controllers/statsToCsv";
import { scheduleCronJob } from "./controllers/scheduleJob";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import { redisConnection } from "./utils/redis";
import { userModel } from "./models/userModel";
import authmiddleware from "./middleware/protect";
import { isAdmin } from "./middleware/isAdmin";
import { google } from "googleapis";
import mongoose from "mongoose";
import {
  checkAvailability,
  generateZoomAccessToken,
  getAllSchedulesWithAvailabilityId,
  getUserId,
  scheduleMeeting,
} from "./utils/zoom";
import callHistoryModel from "./models/historyModel";
import { formatPhoneNumber } from "./utils/formatter";

import {
  getAllLLM,
  getOneLLM,
  revertAgent,
  revertLLM,
  updateAgent,
  updateLLM,
} from "./LLM/llm-fuctions";
import { dailyGraphModel } from "./models/graphModel";
import { updateStatsByHour } from "./controllers/graphController";
import { DateTime } from "luxon";
import { reviewCallback, reviewTranscript } from "./utils/transcript-review";
import { stat } from "fs/promises";
import { script } from "./utils/script";
import HTTP from "./middleware/handler";
import routeHandlers from "./routes";
import { recordModel } from "./models/recordModel";

connectDb();
// const smee = new SmeeClient({
//   source: process.env.SMEE_URL,
//   target: "https://api.intuitiveagents.ai/webhook",
//   logger: console,
// });
// smee.start();
// redisConnection();

export class Server {
  public app: expressWs.Application;
  private httpServer: HTTPServer;
  private retellClient: Retell;
  // private twilioClient: TwilioClient;
  private client: OpenAI;
  storage = multer.diskStorage({
    destination: "public/",
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const newFilename = `${file.originalname
        .split(".")
        .slice(0, -1)
        .join(".")}_${timestamp}.${fileExtension}`;

      cb(null, newFilename);
    },
  });

  upload = multer({ storage: this.storage });
  constructor() {
    this.app = expressWs(express()).app;
    this.app.use(express.json());
    this.app.use(
      cors({
        origin: "*",
      }),
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, "public")));
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
    });

    this.app.get("/", (req, res) => {
      res.send("Hello World");
    });

    this.app.use(HTTP.setupRequest);
    this.app.use(routeHandlers);
    this.app.use(HTTP.processResponse);
    this.app.use(HTTP.handle404);
    this.app.use(HTTP.handleError);

    this.updateAgent();
    this.getFullStat();
    // this.handleRetellLlmWebSocket();
    this.getAllDbTags();
    this.takeAgentId();
    this.handleContactSaving();
    this.zap()
    this.handlecontactDelete();
    this.handlecontactGet();
    this.secondscript();
    // this.createPhoneCall();
    this.updateUserTagForClient();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.getjobstatus();
    this.resetAgentStatus();
    this.getDatesAgentsHaveBeenCalled();
    this.getCallLogs();
    this.stopSpecificSchedule();
    this.getAllJobSchedule();
    this.getAllJob();
    this.stopSpecificJob();
    this.deleteAll();
    //this.dummy()
    this.adminSideLogsToCsv();
    this.getAllDbTagsClient();
    this.statsForAgent();
    this.clientSideToCsv();
    this.createPhoneCall2();
    this.searchForAdmin();
    this.getTranscriptAfterCallEnded();
    this.searchForClient();
    this.batchDeleteUser();
    this.sendReportToClient();
    this.getNotCalledUsersAndDelete();
    this.signUpUser();
    this.loginAdmin();
    this.loginUser();
    this.populateUserGet();
    this.testingMake();
    this.testingCalendly();
    this.syncStatWithMake();
    this.testingZoom();
    // this.updateSentimentMetadata()
    this.updateUserTag();
    this.script();
    this.getSpecificScheduleAdmin();
    this.getSpecificScheduleClient();
    this.bookAppointmentWithZoom();
    this.checkAvailabiltyWithZoom();
    this.graphChartAdmin();
    this.graphChartClient();
    this.resetPassword();
    this.testingZap();
    this.getCallHistoryClient();
    this.getCallHistoryAdmin();
    this.getAllLLM();
    this.getOneLLM();
    this.updateLLM();
    this.revertLLM();
    this.revertAgent();
    this.retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // this.twilioClient = new TwilioClient(this.retellClient);
    // this.twilioClient.ListenTwilioVoiceWebhook(this.app);
  }
  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }

  createPhoneCall2() {
    this.app.post(
      "/create-llm-phone-call",
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId, agentId, address } = req.body;
        const result = await contactModel.findById(userId);
        try {
          if (!result.lastname || result.lastname.trim() === "") {
            result.lastname = ".";
          }
          const callRegister = await this.retellClient.call.registerPhoneCall({
            agent_id: agentId,
            from_number: fromNumber,
            to_number: toNumber,
            retell_llm_dynamic_variables: {
              user_firstname: result.firstname,
              user_email: result.email,
            },
          });
          const registerCallResponse2 =
            await this.retellClient.call.createPhoneCall({
              from_number: fromNumber,
              to_number: toNumber,
              override_agent_id: agentId,
              retell_llm_dynamic_variables: {
                user_firstname: result.firstname,
                user_email: result.email,
                user_address: address,
              },
            });

          // const callRegister = await this.retellClient.call.register({
          //   agent_id: agentId,
          //   audio_encoding: "s16le",
          //   audio_websocket_protocol: "twilio",
          //   sample_rate: 24000,
          //   end_call_after_silence_ms: 15000,
          // });
          // const registerCallResponse2 = await this.retellClient.call.create({
          //   from_number: fromNumber,
          //   to_number: toNumber,
          //   override_agent_id: agentId,
          //   drop_call_if_machine_detected: true,
          //   retell_llm_dynamic_variables: {
          //     user_firstname: result.firstname,
          //     user_email: result.email,
          //     user_lastname: result.lastname,
          //   },
          // });
          await contactModel.findByIdAndUpdate(userId, {
            callId: registerCallResponse2.call_id,
            isusercalled: true,
          });
          res.send({ callCreation: registerCallResponse2, callRegister });
        } catch (error) {
          console.log("This is the error:", error);
        }
      },
    );
  }
  handleContactSaving() {
    this.app.post(
      "/users/create",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const {
          firstname,
          lastname,
          email,
          phone,
          agentId,
          tag,
          dayToBeProcessed,
          address,
        } = req.body;

        const lowerCaseTags = typeof tag === "string" ? tag.toLowerCase() : "";
        try {
          const result = await createContact(
            firstname,
            lastname,
            email,
            phone,
            agentId,
            lowerCaseTags,
            dayToBeProcessed,
            address,
          );
          res.json({ result });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }

  handlecontactGet() {
    this.app.post("/users/:agentId", async (req: Request, res: Response) => {
      const agentId = req.params.agentId;
      const { page, limit, dateOption, jobId } = req.body;
      const newPage = parseInt(page);
      const newLimit = parseInt(limit);

      // Validate dateOption
      let validDateOption: DateOption;

      // Validate dateOption
      if (dateOption) {
        if (!Object.values(DateOption).includes(dateOption)) {
          return res.status(400).json({ error: "Invalid date option" });
        }
        validDateOption = dateOption as DateOption;
      } else {
        validDateOption = DateOption.LAST_SCHEDULE;
      }

      try {
        const result = await getAllContact(
          agentId,
          newPage,
          newLimit,
          jobId,
          validDateOption,
        );
        res.json({ result });
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
  handlecontactDelete() {
    this.app.patch(
      "/users/delete",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { id } = req.body;
        try {
          const result = await deleteOneContact(id);
          res.json({ result });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }
  handleContactUpdate() {
    this.app.patch(
      "/users/update",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const { id, fields } = req.body;
          if (!fields) {
            return res
              .status(400)
              .json({ error: "No fields to update provided." });
          }
          const result = await updateOneContact(id, fields);
          res.json({ result });
        } catch (error) {
          console.log(error);
          res
            .status(500)
            .json({ error: "An error occurred while updating contact." });
        }
      },
    );
  }
  uploadcsvToDb() {
    this.app.post(
      "/upload/:agentId",
      this.upload.single("csvFile"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const csvFile = req.file;
          const tag = req.query.tag;
          const lowerCaseTag = typeof tag === "string" ? tag.toLowerCase() : "";
          const csvData = fs.readFileSync(csvFile.path, "utf8");

          Papa.parse(csvData, {
            header: true,
            complete: async (results: any) => {
              const jsonArrayObj: IContact[] = results.data as IContact[];
              const headers = results.meta.fields.map((header: string) =>
                header.trim(),
              );
              const requiredHeaders = [
                "firstname",
                "lastname",
                "phone",
                "email",
              ];
              const missingHeaders = requiredHeaders.filter(
                (header) => !headers.includes(header),
              );

              if (missingHeaders.length > 0) {
                return res.status(400).json({
                  message: `CSV must contain the following headers: ${missingHeaders.join(
                    ", ",
                  )}`,
                });
              }

              const agentId = req.params.agentId;
              console.log("agentId:", agentId);

              const uniqueRecordsMap = new Map<string, IContact>();
              const duplicateKeys = new Set<string>();
              const failedContacts = [];

              // Process each user from the CSV
              for (const user of jsonArrayObj) {
                if (user.firstname && user.phone) {
                  const formattedPhone = formatPhoneNumber(user.phone);
                  user.phone = formattedPhone;

                  if (uniqueRecordsMap.has(formattedPhone)) {
                    duplicateKeys.add(formattedPhone);
                    failedContacts.push({ user, reason: "duplicate" });
                  } else {
                    uniqueRecordsMap.set(formattedPhone, user);
                  }
                } else {
                  failedContacts.push({
                    user,
                    reason: "missing required fields",
                  });
                }
              }

              const uniqueUsersToInsert = Array.from(
                uniqueRecordsMap.values(),
              ).filter((user) => !duplicateKeys.has(user.phone));

              const dncList: string[] = [""];
              // Check against the DNC list and prepare users for insertion
              const usersWithAgentId = uniqueUsersToInsert.map((user) => ({
                ...user,
                agentId: agentId,
                tag,
                address: user.address || "",
                isOnDNCList: dncList.includes(user.phone),
              }));

              // Batch query to find existing users
              const phoneNumbersToCheck = usersWithAgentId.map(
                (user) => user.phone,
              );
              const existingUsers = await contactModel.find({
                isDeleted: false,
                phone: { $in: phoneNumbersToCheck },
              });

              const dbDuplicates = existingUsers;
              const existingPhoneNumbers = new Set(
                existingUsers.map((user) => user.phone),
              );

              const finalUsersToInsert = usersWithAgentId.filter(
                (user) => !existingPhoneNumbers.has(user.phone) && user.phone,
              );

              if (dbDuplicates.length > 0) {
                dbDuplicates.forEach((existingUser) => {
                  failedContacts.push({
                    user: existingUser,
                    reason: "already exists in the database",
                  });
                });
              }

              if (finalUsersToInsert.length > 0) {
                console.log("Inserting users:", finalUsersToInsert);
                await contactModel.bulkWrite(
                  finalUsersToInsert.map((user) => ({
                    insertOne: { document: user },
                  })),
                );
                await userModel.updateOne(
                  { "agents.agentId": agentId },
                  { $addToSet: { "agents.$.tag": lowerCaseTag } },
                );
              } else {
                console.log("No valid users to insert.");
              }

              if (failedContacts.length > 0) {
                console.log("Failed Contacts:", failedContacts);
              }

              res.status(200).json({
                message: `Upload successful, contacts uploaded: ${finalUsersToInsert.length}, duplicates found: ${dbDuplicates.length}`,
                duplicates: dbDuplicates,
                failedContacts: failedContacts,
              });
            },
            error: async (err: Error) => {
              console.error("Error parsing CSV:", err);
              res.status(500).json({ message: "Failed to parse CSV data" });
            },
          });
        } catch (err) {
          console.error("Error:", err);
          res
            .status(500)
            .json({ message: "Failed to upload CSV data to database" });
        }
      },
    );
  }
  getjobstatus() {
    this.app.post(
      "/schedules/status",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { jobId } = req.body;
        const result = await jobModel.findOne({ jobId });
        res.json({ result });
      },
    );
  }
  getAllJobSchedule() {
    this.app.get(
      "/schedules/get",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const result = await jobModel.find().sort({ createdAt: "desc" });
        res.json({ result });
      },
    );
  }
  resetAgentStatus() {
    this.app.post(
      "/users/status/reset",

      async (req: Request, res: Response) => {
        const { agentId, tag } = req.body;

        const query: any = {
          isDeleted: false,
        };
        const newtag = tag ? tag.toLowerCase() : "";
        if (tag) {
          query["tag"] = newtag;
        }
        if (agentId) {
          query["agentId"] = agentId;
        }

        query["dial_status"] = {
          $ne: callstatusenum.SCHEDULED,
        }

        const result = await contactModel.updateMany(query, {
          dial_status: callstatusenum.NOT_CALLED,
          answeredByVM: false,
          isusercalled: false,
          timesCalled: "",
          // callId: "",
          isTaken:false,
          referenceToCallId: null,
          linktocallLogModel: null,
          datesCalled: [],
          dayToBeProcessed: "",
          jobProcessedWithId: [],
          isOnDNCList: false,
          calledTimes: 0
        });
        res.json({ result });
      },
    );
  }
  schedulemycall() {
    this.app.post("/schedule", async (req: Request, res: Response) => {
      const { hour, minute, agentId, limit, fromNumber, tag, address } =
        req.body;

      const scheduledTimePST = moment
        .tz("America/Los_Angeles")
        .set({
          hour,
          minute,
          second: 0,
          millisecond: 0,
        })
        .toDate();
      const formattedDate = moment(scheduledTimePST).format(
        "YYYY-MM-DDTHH:mm:ss",
      );
      if (!tag) {
        return res.send("Please provide a tag");
      }

      const lowerCaseTag = tag.toLowerCase();
      const { jobId, scheduledTime, contacts } = await scheduleCronJob(
        scheduledTimePST,
        agentId,
        limit,
        fromNumber,
        formattedDate,
        lowerCaseTag,
        address,
      );
      res.send({ jobId, scheduledTime, contacts });
    });
  }
  stopSpecificJob() {
    this.app.post(
      "/stop-job",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        try {
          const { jobId } = req.body;
          if (!jobId) {
            console.log("No jobId provided.");
            return res.status(400).send("No jobId provided.");
          }
          const job = await jobModel.findOneAndUpdate(
            { jobId },
            {
              shouldContinueProcessing: false,
              callstatus: jobstatus.CANCELLED,
            },
          );

          if (!job) {
            console.log("No job found with the provided jobId:", jobId);
            return res
              .status(404)
              .send("No job found with the provided jobId.");
          }
          console.log(`Processing stopped for job ${jobId}.`);
          return res.send("Processing stopped for job.");
        } catch (error: any) {
          console.error("Error stopping job:", error);
          return res
            .status(500)
            .send("Error stopping job: " + (error.message || error));
        }
      },
    );
  }
  stopSpecificSchedule() {
    this.app.post(
      "/cancel-schedule",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { jobId } = req.body;
        const scheduledJobs = schedule.scheduledJobs;

        if (!jobId) {
          return res.status(404).send(`Please provide an ID`);
        }
        // Check if the specified job exists
        if (!scheduledJobs.hasOwnProperty(jobId)) {
          return res.status(404).send(`Job with ID ${jobId} not found.`);
        }
        const isCancelled = schedule.cancelJob(jobId);
        if (isCancelled) {
          await jobModel.findOneAndUpdate(
            { jobId },
            {
              callstatus: jobstatus.CANCELLED,
              shouldContinueProcessing: false,
            },
          );
          res.send(`Job with ID ${jobId} cancelled successfully.`);
        } else {
          res.status(500).send(`Failed to cancel job with ID ${jobId}.`);
        }
      },
    );
  }
  getAllJob() {
    this.app.get(
      "/get-jobs",
      authmiddleware,
      async (req: Request, res: Response) => {
        const scheduledJobs = schedule.scheduledJobs;
        let responseString = "";
        for (const jobId in scheduledJobs) {
          if (scheduledJobs.hasOwnProperty(jobId)) {
            const job = scheduledJobs[jobId];
            responseString += `Job ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n`;
          }
        }
        res.send({ responseString });
      },
    );
  }
  getCallLogs() {
    this.app.post(
      "/call-logs",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await jobModel.find({ agentId });
        res.json({ result });
      },
    );
  }
  async getTranscriptAfterCallEnded() {
    this.app.post("/webhook", async (request: Request, response: Response) => {
      const payload = request.body;
      const todays = new Date();
      todays.setHours(0, 0, 0, 0);
      const todayString = todays.toISOString().split("T")[0];
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const hours = String(today.getHours()).padStart(2, "0");
      const minutes = String(today.getMinutes()).padStart(2, "0");

      const todayStringWithTime = `${year}-${month}-${day}`;
      const time = `${hours}:${minutes}`;
      try {
        if (payload.event === "call_started") {
          console.log(`call started for: ${payload.data.call_id}`);
          await this.handleCallStarted(payload.data);
        } else if (payload.event === "call_ended") {
          await this.handleCallEnded(
            payload,
            todayString,
            todayStringWithTime,
            time,
          );
        } else if (payload.event === "call_analyzed") {
          await this.handleCallAnalyzed(payload);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }
  async handleCallStarted(data: any) {
    try {
      const { call_id, agent_id } = data;
      await contactModel.findOneAndUpdate(
        { callId: call_id, agentId: agent_id },
        { dial_status: callstatusenum.IN_PROGRESS },
      );
    } catch (error) {
      console.error("Error in handleCallStarted:", error);
    }
  }
  async handleCallEnded(
    payload: any,
    todayString: any,
    todaysDateForDatesCalled: any,
    time: any,
  ) {
    try {
      const {
        call_id,
        agent_id,
        disconnection_reason,
        start_timestamp,
        end_timestamp,
        transcript,
        recording_url,
        public_log_url,
        cost_metadata,
        call_cost,
        call_analysis,
        retell_llm_dynamic_variables,
        from_number,
        to_number,
        direction,
      } = payload.data;
      let analyzedTranscriptForStatus;
      let callStatus;
      let sentimentStatus;
      let statsUpdate: any = { $inc: {} };

      //console.log("here")
      console.log({
        firstname: payload.retell_llm_dynamic_variables.user_firstname,
      });
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

      if (payload.event === "call_ended") {
        let agentNameEnum;
        if (agent_id === "agent_1852d8aa89c3999f70ecba92b8") {
          agentNameEnum = "ARS";
        } else if (agent_id === "agent_6beffabb9adf0ef5bbab8e0bb2") {
          agentNameEnum = "LQR";
        } else if (agent_id === "agent_155d747175559aa33eee83a976") {
          agentNameEnum = "SDR";
        } else if (agent_id === "214e92da684138edf44368d371da764c") {
          agentNameEnum = "TVAG";
        }
        const isCallFailed = disconnection_reason === "dial_failed";
        const isCallTransferred = disconnection_reason === "call_transfer";
        // const isMachine = disconnection_reason === "voicemail_reached";
        const isDialNoAnswer = disconnection_reason === "dial_no_answer";
        const isCallInactivity = disconnection_reason === "inactivity";
        const isCallAnswered =
          disconnection_reason === "user_hangup" ||
          disconnection_reason === "agent_hangup";
        analyzedTranscriptForStatus = await reviewTranscript(transcript);
        const isCallScheduled =
          analyzedTranscriptForStatus.message.content === "scheduled";
        const isMachine =
          analyzedTranscriptForStatus.message.content === "voicemail";
        const isIVR = analyzedTranscriptForStatus.message.content === "ivr";

        const callbackdate = await reviewCallback(transcript);

        const newDuration = convertMsToHourMinSec(payload.call.duration_ms);

        const callEndedUpdateData = {
          callId: call_id,
          agentId: payload.call.agent_id,
          recordingUrl: recording_url,
          callDuration: newDuration,
          disconnectionReason: disconnection_reason,
          callBackDate: callbackdate,
          retellCallStatus: payload.data.call_status,
          agentName: agentNameEnum,
          duration: convertMsToHourMinSec(end_timestamp - start_timestamp) || 0,
          timestamp: end_timestamp,
          ...(transcript && { transcript }),
        };

        const results = await EventModel.findOneAndUpdate(
          { callId: call_id, agentId: payload.call.agent_id },
          { $set: callEndedUpdateData },
          { upsert: true, returnOriginal: false },
        );

        statsUpdate.$inc.totalCalls = 1;
        statsUpdate.$inc.totalCallDuration = payload.call.duration_ms;

        if (isMachine) {
          statsUpdate.$inc.totalAnsweredByVm = 1;
          callStatus = callstatusenum.VOICEMAIL;
        } else if (isIVR) {
          statsUpdate.$inc.totalAnsweredByIVR = 1;
          callStatus = callstatusenum.IVR;
        } else if (isCallScheduled) {
          statsUpdate.$inc.totalAppointment = 1;
          callStatus = callstatusenum.SCHEDULED;
        } else if (isCallFailed) {
          statsUpdate.$inc.totalFailed = 1;
          callStatus = callstatusenum.FAILED;
        } else if (isCallTransferred) {
          statsUpdate.$inc.totalTransffered = 1;
          callStatus = callstatusenum.TRANSFERRED;
        } else if (isDialNoAnswer) {
          statsUpdate.$inc.totalDialNoAnswer = 1;
          callStatus = callstatusenum.NO_ANSWER;
        } else if (isCallInactivity) {
          statsUpdate.$inc.totalCallInactivity = 1;
          callStatus = callstatusenum.INACTIVITY;
        } else if (isCallAnswered) {
          statsUpdate.$inc.totalCallAnswered = 1;
          callStatus = callstatusenum.CALLED;
        }

        const callData = {
          callId: call_id,
          agentId: agent_id,
          userFirstname: retell_llm_dynamic_variables?.user_firstname || null,
          userLastname: retell_llm_dynamic_variables?.user_lastname || null,
          userEmail: retell_llm_dynamic_variables?.user_email || null,
          recordingUrl: recording_url || null,
          disconnectionReason: disconnection_reason || null,
          callStatus: payload.data.call_status,
          startTimestamp: start_timestamp || null,
          endTimestamp: end_timestamp || null,
          durationMs:
            convertMsToHourMinSec(end_timestamp - start_timestamp) || 0,
          transcript: transcript || null,
          transcriptObject: payload.data.transcript_object || [],
          transcriptWithToolCalls:
            payload.data.transcript_with_tool_calls || [],
          publicLogUrl: public_log_url || null,
          callType: payload.data.call_type || null,
          customAnalysisData:
            payload.event === "call_analyzed" ? call_analysis : null,
          fromNumber: from_number || null,
          toNumber: to_number || null,
          direction: direction || null,
          agentName: agentNameEnum,
          date: todayString,
          address: retell_llm_dynamic_variables?.user_address || null,
          dial_status: callStatus,
        };
        await callHistoryModel.findOneAndUpdate(
          { callId: call_id, agentId: agent_id },
          { $set: callData },
          { upsert: true, returnOriginal: false },
        );
        const jobidfromretell = retell_llm_dynamic_variables.job_id
          ? retell_llm_dynamic_variables.job_id
          : null;
        // const resultforcheck = await contactModel.findOne({callId: payload.call.call_id, agentId: payload.call.agent_id})
        let statsResults;
        // if(resultforcheck.calledTimes < 0){
        statsResults = await DailyStatsModel.findOneAndUpdate(
          {
            day: todayString,
            agentId: agent_id,
            jobProcessedBy: jobidfromretell,
          },
          statsUpdate,
          { upsert: true, returnOriginal: false },
        );
        const timestamp = new Date();
        await updateStatsByHour(agent_id, todayString, timestamp);
        // }

        //const linkToCallLogModelId = statsResults ? statsResults._id : null;
        const updateData: any = {
          dial_status: callStatus,
          $push: { datesCalled: todaysDateForDatesCalled },
          referenceToCallId: results._id,
          timesCalled: time,
          $inc: { calledTimes: 1 },
        };

        // Conditionally include linkToCallLogModel if it exists
        if (statsResults) {
          updateData.linktocallLogModel = statsResults._id;
        }

        const resultForUserUpdate = await contactModel.findOneAndUpdate(
          { callId: call_id, agentId: payload.call.agent_id },
          updateData,
        );

        // if (analyzedTranscript.message.content === "Scheduled") {
        //   const data = {
        //     firstname: resultForUserUpdate.firstname,
        //     lastname: resultForUserUpdate.lastname
        //       ? resultForUserUpdate.lastname
        //       : "None",
        //     email: resultForUserUpdate.email,
        //     phone: resultForUserUpdate.phone,
        //   };
        //   axios.post(process.env.ZAP_URL, data);
        // }
        // try {
        //   if (analyzedTranscript.message.content === "call-back") {
        //     const callbackdate =await reviewCallback(transcript)
        //     const data = {
        //       firstname: resultForUserUpdate.firstname,
        //       email: resultForUserUpdate.email,
        //       phone: resultForUserUpdate.phone,
        //       summary: callbackdate ,
        //       url:recording_url,
        //     };
        //     axios.post(process.env.MAKE_URL, data);
        //   }
        // } catch (error) {
        //  console.log(error)
        // }
      }
    } catch (error) {
      console.error("Error in handleCallAnalyyzedOrEnded:", error);
    }
  }
  async handleCallAnalyzed(payload: any) {
    try {
      const url = process.env.CAN_URL;
      const apiKey = process.env.CAN_KEY;
      const eventBody = { payload };

      let analyzedTranscriptForSentiment;
      let sentimentStatus;
      // axios
      //   .post(url, eventBody, {
      //     headers: {
      //       "Content-Type": "application/json",
      //       "X-Canonical-Api-Key": apiKey,
      //     },
      //   })
      //   .then((response) => {
      //     console.log("Response:", response.data);
      //   })
      //   .catch((error) => {
      //     console.error(
      //       "Error:",
      //       error.response ? error.response.data : error.message,
      //     );
      //   });

      analyzedTranscriptForSentiment = await reviewTranscript(
        payload.data.transcript,
      );
      const isScheduled =
        analyzedTranscriptForSentiment.message.content === "scheduled";
      const isDNC = analyzedTranscriptForSentiment.message.content === "dnc";
      const isCall_Back =
        analyzedTranscriptForSentiment.message.content === "call-back";
      const isNeutral = payload.data.call_analysis.user_sentiment === "Neutral";
      const isUnknown = payload.data.call_analysis.user_sentiment === "Unknown";
      const isPositive =
        payload.data.call_analysis.user_sentiment === "Positive";
      const isNegative =
        payload.data.call_analysis.user_sentiment === "Negative";

      let addressStat;
      if (payload.call.agent_id === "" || payload.call.agent_id === "") {
        addressStat = payload.data.call_analysis.address;
      }

      if (isScheduled) {
        sentimentStatus = callSentimentenum.SCHEDULED;
      } else if (isCall_Back) {
        sentimentStatus = callSentimentenum.CALLBACK;
      } else if (isDNC) {
        sentimentStatus = callSentimentenum.DNC;
      } else if (isNeutral) {
        sentimentStatus = callSentimentenum.NEUTRAL;
      } else if (isPositive) {
        sentimentStatus = callSentimentenum.POSITIVE;
      } else if (isNegative) {
        sentimentStatus = callSentimentenum.NEGATIVE;
      } else if (isUnknown) {
        sentimentStatus = callSentimentenum.UNKNOWN;
      }
      const data = {
        retellCallSummary: payload.data.call_analysis.call_summary,
        analyzedTranscript: sentimentStatus,
        userSentiment: sentimentStatus,
      };
      const results = await EventModel.findOneAndUpdate(
        { callId: payload.call.call_id, agentId: payload.call.agent_id },
        { $set: data },
        { upsert: true, returnOriginal: false },
      );

      //const analyzedTranscript = await reviewTranscript(payload.data.transcript);
      const data2 = {
        callSummary: payload.data.call_analysis.call_summary,
        userSentiment: sentimentStatus,
      };
      await callHistoryModel.findOneAndUpdate(
        { callId: payload.call.call_id, agentId: payload.call.agent_id },
        { $set: data2 },
        { upsert: true, returnOriginal: false },
      );

      try {
        const result = await contactModel.findOne({
          callId: payload.call.call_id,
          agentId: payload.call.agent_id,
        });
        if (
          payload.data.call_analysis.call_successful === false &&
          analyzedTranscriptForSentiment.message.content === "interested"
        ) {
          // await this.retellClient.call.registerPhoneCall({
          //   agent_id: payload.data.agent_id,
          //   from_number: payload.call.from_number,
          //   to_number: payload.call.to_number,
          //   retell_llm_dynamic_variables: {
          //     user_firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
          //     user_email: payload.data.retell_llm_dynamic_variables.user_email,
          //     user_lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
          //     job_id: payload.data.retell_llm_dynamic_variables.job_id,
          //     user_address: payload.data.retell_llm_dynamic_variables.user_address,
          //   },
          // });

          // const registerCallResponse = await this.retellClient.call.createPhoneCall({
          //   from_number: payload.call.from_number,
          //   to_number: payload.call.to_number,
          //   override_agent_id:payload.data.agent_id ,
          //   retell_llm_dynamic_variables: {
          //     user_firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
          //     user_email: payload.data.retell_llm_dynamic_variables.user_email,
          //     user_lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
          //     job_id: payload.data.retell_llm_dynamic_variables.job_id,
          //     user_address: payload.data.retell_llm_dynamic_variables.user_address,
          //   },
          // });

          // await contactModel.findOne({callId: payload.data.call_id, agentId:payload.data.agent_id}, {callId:payload.data.call_id

          // })

          const result = await axios.post(process.env.MAKE_URL, {
            firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
            lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
            email: payload.data.retell_llm_dynamic_variables.user_email,
            phone: payload.call.to_number,
            summary: payload.data.call_analysis.call_summary,
            url: payload.data?.recording_url || null,
            transcript: payload.data.transcript,
          });
        }
      } catch (error) {
        console.log("errror recalling", error);
      }
    } catch (error) {
      console.log(error);
    }
  }
  deleteAll() {
    this.app.patch(
      "/deleteAll",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await contactModel.updateMany(
          { agentId },
          { isDeleted: true },
        );
        res.send(result);
      },
    );
  }
  adminSideLogsToCsv() {
    this.app.post("/call-logs-csv", async (req: Request, res: Response) => {
      try {
        const {
          agentId,
          startDate,
          endDate,
          limit,
          statusOption,
          sentimentOption,
          dateOption,
          tag,
        } = req.body;

        const newlimit = parseInt(limit);
        console.log(sentimentOption, "second");
        const result = await logsToCsv(
          agentId,
          newlimit,
          startDate,
          endDate,
          statusOption,
          sentimentOption,
          dateOption,
          tag,
        );

        if (typeof result === "object" && result.error) {
          console.error(`Error retrieving contacts: ${result.error}`);
          return res.status(result.status || 500).send({ error: result.error });
        }

        if (typeof result === "string") {
          const filePath: string = result;
          if (fs.existsSync(filePath)) {
            res.setHeader(
              "Content-Disposition",
              "attachment; filename=logs.csv",
            );
            res.setHeader("Content-Type", "text/csv");
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            console.error("CSV file does not exist");
            return res.status(404).send("CSV file not found");
          }
        } else {
          console.error(`Unexpected result from logsToCsv: ${result}`);
          return res.status(500).send("Unexpected error retrieving contacts.");
        }
      } catch (error) {
        console.error(`Error retrieving contacts: ${error}`);
        return res.status(500).send(`Error retrieving contacts: ${error}`);
      }
    });
  }
  statsForAgent() {
    this.app.post("/get-stats", async (req: Request, res: Response) => {
      const { agentIds, limit, page, startDate, endDate } = req.body;
      let dateOption;
      dateOption = req.body.dateOption;

      try {
        let dateFilter = {};
        let dateFilter1 = {};
        const skip = (page - 1) * limit;

        const timeZone = "America/Los_Angeles";
        const now = new Date();
        const zonedNow = toZonedTime(now, timeZone);
        const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

        switch (dateOption) {
          case DateOption.Today:
            dateFilter = { datesCalled: today };
            dateFilter1 = { day: today };
            break;
          case DateOption.Yesterday:
            const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
            const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
              timeZone,
            });
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
            console.log(weekdays);
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

          case DateOption.Total:
            dateFilter = {};
            dateFilter1 = {};
            break;
          default:
            const recentJob = await jobModel
              .findOne({ agentId: { $in: agentIds } })
              .sort({ createdAt: -1 })
              .lean();

            if (!recentJob) {
              dateFilter = {};
              dateFilter1 = {};
            } else {
              const dateToCheck = recentJob.scheduledTime.split("T")[0];
              dateFilter = { datesCalled: dateToCheck };
              dateFilter1 = { day: dateToCheck };
            }
            break;
        }

        if (startDate) {
          dateFilter = {
            datesCalled: {
              $gte: startDate,
            },
          };
          dateFilter1 = {
            day: {
              $gte: startDate,
            },
          };
        }

        if (endDate) {
          dateFilter = {
            datesCalled: {
              $lte: endDate,
            },
          };
          dateFilter1 = {
            day: {
              $lte: endDate,
            },
          };
        }
        const foundContacts = await contactModel
          .find({ agentId: { $in: agentIds }, isDeleted: false, ...dateFilter })
          .sort({ createdAt: "desc" })
          .populate("referenceToCallId")
          .limit(limit)
          .skip(skip);

        const totalContactForAgent = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
        });

        const totalCount = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: { $ne: true },
        });

        const totalNotCalledForAgent = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
          dial_status: callstatusenum.NOT_CALLED,
        });
        const totalAnsweredCalls = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
          dial_statusstatus: callstatusenum.CALLED,
          ...dateFilter,
        });

        const stats = await DailyStatsModel.aggregate([
          { $match: { agentId: { $in: agentIds }, ...dateFilter1 } },
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
        const totalPages = Math.ceil(totalCount / limit);
        const statsWithTranscripts = await Promise.all(
          foundContacts.map(async (stat) => {
            const transcript = stat.referenceToCallId?.transcript;
            const analyzedTranscript =
              stat.referenceToCallId?.analyzedTranscript;
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

        res.json({
          totalContactForAgent,
          totalAnsweredCalls,
          totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
          totalAppointment: stats[0]?.totalAppointment || 0,
          totalCallsTransffered: stats[0]?.totalCallsTransffered || 0,
          totalNotCalledForAgent,
          totalCalls: stats[0]?.totalCalls || 0,
          totalFailedCalls: stats[0]?.totalFailedCalls || 0,
          totalAnsweredByIVR: stats[0]?.totalAnsweredByIVR || 0,
          totalDialNoAnswer: stats[0]?.totalDialNoAnswer || 0,
          totalCallInactivity: stats[0]?.totalCallInactivity || 0,
          callDuration: combinedCallDuration,
          totalPages,
          contacts: statsWithTranscripts,
        });
      } catch (error) {
        console.error("Error fetching all contacts:", error);
        return "error getting contact";
      }
    });
  }
  clientSideToCsv() {
    this.app.post("/get-metadata-csv", authmiddleware, async (req, res) => {
      try {
        const { startDate, endDate, agentIds } = req.body;
        const result = await statsToCsv(startDate, endDate, agentIds);
        if (typeof result === "string") {
          const filePath: string = result;
          if (fs.existsSync(filePath)) {
            res.setHeader(
              "Content-Disposition",
              "attachment; filename=logs.csv",
            );
            res.setHeader("Content-Type", "text/csv");
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            console.error("CSV file does not exist");
            res.status(404).send("CSV file not found");
          }
        } else {
          console.error(`Error retrieving contacts: ${result}`);
          res.status(500).send(`Error retrieving contacts: ${result}`);
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
  searchForClient() {
    this.app.post("/search-client", async (req: Request, res: Response) => {
      const {
        searchTerm = "",
        startDate,
        endDate,
        statusOption,
        sentimentOption,
        agentIds,
        tag,
        dateOption,
        page = 1,
        limit = 100,
      } = req.body;

      console.log("req.body is: ", req.body);

      if (!agentIds) {
        return res
          .status(400)
          .json({ error: "Agent IDs is required for the search." });
      }
      
      try {
        const isValidEmail = (email: string): boolean => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };

        const formatDateToDB = (dateString: string): string => {
          const date = new Date(dateString);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        const escapeRegex = (text: string): string => {
          return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        };

        // const searchTerms = searchTerm
        //   .split(",")
        //   .map((term: string) => term.trim())
        //   .filter((term: any) => term.length > 0);
        const searchTerms = searchTerm
          .split(",")
          .map((term: string) => term.trim())
          .filter((term: string) => term.length > 0)
          .map(escapeRegex); // Escape special characters`

        const query: any = {
          agentId: { $in: agentIds },
          isDeleted: false,
        };

        if (searchTerms.length > 0) {
          query.$or = searchTerms.flatMap((term: any) => [
            { firstname: { $regex: term, $options: "i" } },
            { lastname: { $regex: term, $options: "i" } },
            { phone: { $regex: term, $options: "i" } },
            { email: { $regex: term, $options: "i" } },
          ]);
        }

        let statusOptions;
        if (statusOption === "called") {
          statusOptions = callstatusenum.CALLED;
        } else if (statusOption === "not-called") {
          statusOptions = callstatusenum.NOT_CALLED;
        } else if (statusOption === "voicemail") {
          statusOptions = callstatusenum.VOICEMAIL;
        } else if (statusOption === "failed") {
          statusOptions = callstatusenum.FAILED;
        } else if (statusOption === "transffered") {
          statusOptions = callstatusenum.TRANSFERRED;
        } else if (statusOption === "scheduled") {
          statusOptions = callstatusenum.SCHEDULED;
        } else if (statusOption === "ivr") {
          statusOptions = callstatusenum.IVR;
        } else if (statusOption === "inactivity") {
          statusOptions = callstatusenum.INACTIVITY;
        }

        if (statusOption) {
          query.dial_status = statusOptions;
        }
        if (tag) {
          query["tag"] = tag.toLowerCase();
        }

        const sentimentMapping: { [key: string]: string | undefined } = {
          negative: callSentimentenum.NEGATIVE,
          "call-back": callSentimentenum.CALLBACK,
          positive: callSentimentenum.POSITIVE,
          scheduled: callSentimentenum.SCHEDULED,
          neutral: callSentimentenum.NEUTRAL,
          unknown: callSentimentenum.UNKNOWN,
          dnc: callSentimentenum.DNC,
        };

        const sentimentStatus = sentimentOption
          ? sentimentMapping[sentimentOption.toLowerCase()]
          : undefined;

        let results: any[] = [];
        let totalRecords = 0;
        let totalPages = 0;

        const timeZone = "America/Los_Angeles"; // PST time zone
        const now = new Date();
        const zonedNow = toZonedTime(now, timeZone);
        const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
        let dateFilter = {};
        let dateFilter1 = {};
        console.log("hello  there");
        console.log("this is ", dateOption);
        if (dateOption) {
          switch (dateOption) {
            case DateOption.Today:
              query["datesCalled"] = today;
              break;
            case DateOption.Yesterday:
              const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
              const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
                timeZone,
              });
              query["datesCalled"] = yesterday;
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
              query["datesCalled"] = { $in: weekdays };
              break;
            case DateOption.ThisMonth:
              const monthDates: string[] = [];
              for (let i = 0; i < now.getDate(); i++) {
                const day = subDays(now, i);
                monthDates.unshift(format(day, "yyyy-MM-dd", { timeZone }));
              }
              query["datesCalled"] = { $in: monthDates };
              break;
            case DateOption.Total:
              // Don't filter by dates for "Total"
              break;
          }
        } else if (startDate || endDate) {
          query["datesCalled"] = {};

          if (startDate && endDate) {
            query["datesCalled"]["$gte"] = formatDateToDB(startDate);
            query["datesCalled"]["$lte"] = formatDateToDB(endDate);
          } else if (startDate) {
            query["datesCalled"]["eq"] = formatDateToDB(startDate);
          };
          // if (startDate && !endDate) {
          //   query["datesCalled"]["$eq"] = formatDateToDB(startDate);
          // } else if (startDate && endDate) {
          //   query["datesCalled"]["$gte"] = formatDateToDB(startDate);
          //   query["datesCalled"]["$lte"] = formatDateToDB(endDate);
          // }
        }

        //   if(dateOption){
        //     query["datesCalled"] = dateFilter
        // } else if (startDate || endDate) {
        //   query["datesCalled"] = {};
        //   if (startDate && !endDate) {
        //     query["datesCalled"]["$eq"] = formatDateToDB(startDate);
        //   } else if (startDate && endDate) {
        //     query["datesCalled"]["$gte"] = formatDateToDB(startDate);
        //     query["datesCalled"]["$lte"] = formatDateToDB(endDate);
        //   }
        // }
        if (sentimentOption) {
          results = await contactModel
            .find(query)
            .populate("referenceToCallId");
          results = results.filter((contact) => {
            const analyzedTranscript =
              contact.referenceToCallId?.analyzedTranscript;
            return (
              sentimentOption.toLowerCase() === "all" ||
              analyzedTranscript === sentimentStatus
            );
          });

          totalRecords = results.length;
          totalPages = Math.ceil(totalRecords / limit);

          const startIndex = (page - 1) * limit;
          results = results.slice(startIndex, startIndex + limit);
        } else {
          totalRecords = await contactModel.countDocuments(query);
          totalPages = Math.ceil(totalRecords / limit);

          console.log("this is query", query);
          results = await contactModel
            .find(query)
            .populate("referenceToCallId")
            .skip((page - 1) * limit)
            .limit(limit);
        }

        const data = results.map((history) => ({
          firstName: history.firstname || "",
          lastName: history.lastname || "",
          email: history.email || "",
          phone: history.phone || "",
          dial_status: history.dial_status || "",
          agentId: history.referenceToCallId?.agentName || "",
          transcript: history.referenceToCallId?.transcript || "",
          summary: history.referenceToCallId?.retellCallSummary || "",
          sentiment: history.referenceToCallId?.analyzedTranscript || "",
          timestamp: history.referenceToCallId?.timestamp || "",
          duration: history.referenceToCallId?.duration || "",
          status: history.referenceToCallId?.retellCallStatus || "",
          recordingUrl: history.referenceToCallId?.recordingUrl || "",
          address: history.address || "",
          callId: history.callId || "",
        }));
        res.json({
          page,
          limit,
          totalRecords,
          totalPages,
          results: data,
        });
      } catch (error) {
        console.error("Error in searchForAdmin:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  }
  searchForAdmin() {
    this.app.post("/search", async (req: Request, res: Response) => {
      const {
        searchTerm = "",
        startDate,
        endDate,
        statusOption,
        sentimentOption,
        agentId,
        tag,
        page = 1,
        limit = 100,
      } = req.body;

      if (!agentId) {
        return res
          .status(400)
          .json({ error: "Agent ID is required for the search." });
      }

      try {
        const isValidEmail = (email: string): boolean => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };

        const formatDateToDB = (dateString: string): string => {
          const date = new Date(dateString);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // const searchTerms = searchTerm
        //   .split(",")
        //   .map((term: string) => term.trim())
        //   .filter((term: any) => term.length > 0);

        const query: any = {
          agentId,
          isDeleted: false,
        };

        const escapeRegex = (text: string): string => {
          return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        };

        const searchTerms = searchTerm
          .split(",")
          .map((term: string) => term.trim())
          .filter((term: string) => term.length > 0)
          .map(escapeRegex); // Escape special characters`
        // if (searchTerms.length > 0) {
        //   query.$or = searchTerms.flatMap((term: any) => [
        //     { firstname: { $regex: term, $options: "i" } },
        //     { lastname: { $regex: term, $options: "i" } },
        //     { phone: { $regex: term, $options: "i" } },
        //     { email: { $regex: term, $options: "i" } },
        //   ]);
        // }
        if (searchTerms.length > 0) {
          query.$or = searchTerms.flatMap((term: string) => [
            { firstname: { $regex: term, $options: "i" } },
            { lastname: { $regex: term, $options: "i" } },
            { phone: { $regex: term, $options: "i" } },
            { email: { $regex: term, $options: "i" } },
          ]);
        }

        if (startDate || endDate) {
          query["datesCalled"] = {};
          if (startDate && !endDate) {
            query["datesCalled"]["$eq"] = formatDateToDB(startDate);
          } else if (startDate && endDate) {
            query["datesCalled"]["$gte"] = formatDateToDB(startDate);
            query["datesCalled"]["$lte"] = formatDateToDB(endDate);
          }
        }
        let statusOptions;
        if (statusOption === "called") {
          statusOptions = callstatusenum.CALLED;
        } else if (statusOption === "not-called") {
          statusOptions = callstatusenum.NOT_CALLED;
        } else if (statusOption === "voicemail") {
          statusOptions = callstatusenum.VOICEMAIL;
        } else if (statusOption === "failed") {
          statusOptions = callstatusenum.FAILED;
        } else if (statusOption === "transffered") {
          statusOptions = callstatusenum.TRANSFERRED;
        } else if (statusOption === "scheduled") {
          statusOptions = callstatusenum.SCHEDULED;
        } else if (statusOption === "ivr") {
          statusOptions = callstatusenum.IVR;
        } else if (statusOption === "inactivity") {
          statusOptions = callstatusenum.INACTIVITY;
        }

        if (statusOption) {
          query.dial_status = statusOptions;
        }
        if (tag) {
          query["tag"] = tag.toLowerCase();
        }

        const sentimentMapping: { [key: string]: string | undefined } = {
          negative: callSentimentenum.NEGATIVE,
          "call-back": callSentimentenum.CALLBACK,
          positive: callSentimentenum.POSITIVE,
          scheduled: callSentimentenum.SCHEDULED,
          neutral: callSentimentenum.NEUTRAL,
          unknown: callSentimentenum.UNKNOWN,
          dnc: callSentimentenum.DNC,
        };

        const sentimentStatus = sentimentOption
          ? sentimentMapping[sentimentOption.toLowerCase()]
          : undefined;

        let results: any[] = [];
        let totalRecords = 0;
        let totalPages = 0;

        if (sentimentOption) {
          results = await contactModel
            .find(query)
            .populate("referenceToCallId");
          results = results.filter((contact) => {
            const analyzedTranscript =
              contact.referenceToCallId?.analyzedTranscript;
            return (
              sentimentOption.toLowerCase() === "all" ||
              analyzedTranscript === sentimentStatus
            );
          });

          totalRecords = results.length;
          totalPages = Math.ceil(totalRecords / limit);

          const startIndex = (page - 1) * limit;
          results = results.slice(startIndex, startIndex + limit);
        } else {
          totalRecords = await contactModel.countDocuments(query);
          totalPages = Math.ceil(totalRecords / limit);

          console.log(query);
          results = await contactModel
            .find(query)
            .populate("referenceToCallId")
            .skip((page - 1) * limit)
            .limit(limit)
            .sort();
        }

        res.json({
          page,
          limit,
          totalRecords,
          totalPages,
          results,
        });
      } catch (error) {
        console.error("Error in searchForAdmin:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  }
  batchDeleteUser() {
    this.app.post(
      "/batch-delete-users",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const { contactsToDelete } = req.body;

        if (
          !contactsToDelete ||
          !Array.isArray(contactsToDelete) ||
          contactsToDelete.length === 0
        ) {
          return res.status(400).json({
            error: "Invalid input. An array of contact IDs is required.",
          });
        }

        try {
          const result = await contactModel.updateMany(
            { _id: { $in: contactsToDelete } },
            { $set: { isDeleted: true } },
          );

          if (result.modifiedCount === 0) {
            return res
              .status(200)
              .json({ message: "No contacts found to update." });
          }

          res.json({ message: "Contacts sucefully deleted.", result });
        } catch (error) {
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }
  getNotCalledUsersAndDelete() {
    this.app.post(
      "/delete-uncalled",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const { agentId } = req.body;
          if (!agentId) {
            throw new Error("Please provide an agent ID");
          }
          const result = await contactModel.updateMany(
            { agentId, dial_status: callstatusenum.NOT_CALLED },
            { isDeleted: true },
          );
          res.json({
            message: "Deleted All contacts that are not called",
            result,
          });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }
  loginUser() {
    this.app.post("/user/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: "Provide the login details" });
        }

        const userInDb = await userModel.findOne(
          { username },
          {
            "agents.agentId": 1,
            passwordHash: 1,
            isAdmin: 1,
            username: 1,
            group: 1,
            name: 1,
          },
        );

        if (!userInDb) {
          return res.status(400).json({ message: "User not found" });
        }

        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Incorrect password" });
        }

        // Log successful login attempt
        await userModel.updateOne(
          { username },
          {
            $push: {
              loginDetails: {
                ipAddress: req.ip,
                successful: true,
              },
            },
          },
        );

        let result;
        if (userInDb.isAdmin === true) {
          const payload = await userModel.aggregate([
            {
              $project: { agents: 1 },
            },
            {
              $unwind: "$agents",
            },
            {
              $group: { _id: null, allAgentIds: { $push: "$agents.agentId" } },
            },
            {
              $project: { _id: 0, allAgentIds: 1 },
            },
          ]);
          result = payload.length > 0 ? payload[0].allAgentIds : [];
        } else {
          result = userInDb?.agents?.map((agent) => agent.agentId) || [];
        }

        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "6d" },
        );

        // make trigger
        const user = {
          token,
          username: userInDb.username,
          userId: userInDb._id,
          group: userInDb.group,
          name: userInDb.name,
          agentIds: result,
          isUserAdmin: userInDb.isAdmin,
        };

        try {
          const hello = await axios.post('https://hook.us1.make.com/upftnnyhgxdefrdmntjpawa9gcrmdbz7', { user });

          console.log("make data: ", hello.data);

        } catch (e) {
          console.error("Error triggering make url");
          return res.status(200).json({
            message: "Login successfult but make trigger failed",
            user
          });
        };

        res.json({
          payload: {
            message: "Logged in successfully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
            name: userInDb.name,
            agentIds: result,
            isUserAdmin: userInDb.isAdmin,
          },
        });
      } catch (error) {
        console.log(error);
        if (!res.headersSent) {
          // Check if headers have not been sent before sending response
          return res
            .status(500)
            .json({ message: "Error happened during login" });
        }
      }
    });
  }
  loginAdmin() {
    this.app.post("/admin/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: "Provide the login details" });
        }

        const userInDb = await userModel.findOne({ username });
        if (!userInDb) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  device: "Unknown", // Improve this as needed
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Invalid login credentials" });
        }

        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  device: "Unknown", // Improve this as needed
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Incorrect password" });
        }

        if (userInDb.isAdmin === false) {
          return res
            .status(401)
            .json({ message: "Only admins can access here" });
        }

        // Log successful login attempt
        await userModel.updateOne(
          { username },
          {
            $push: {
              loginDetails: {
                ipAddress: req.ip,
                device: "Unknown", // Improve this as needed
                successful: true,
              },
            },
          },
        );

        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );

        const result = await userModel.aggregate([
          { $project: { agents: 1 } },
          { $unwind: "$agents" },
          { $group: { _id: null, allAgentIds: { $push: "$agents.agentId" } } },
          { $project: { _id: 0, allAgentIds: 1 } },
        ]);

        return res.status(200).json({
          payload: {
            message: "Logged in successfully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
            agentIds: result,
            isUserAdmin: userInDb.isAdmin,
          },
        });
      } catch (error) {
        console.log(error);
        if (!res.headersSent) {
          return res
            .status(500)
            .json({ message: "Error happened during login" });
        }
      }
    });
  }
  signUpUser() {
    this.app.post("/user/signup", async (req: Request, res: Response) => {
      try {
        const { username, email, password, group, name } = req.body;
        if (!username || !email || !password || !group) {
          return res
            .status(400)
            .json({ message: "Please provide all needed details" });
        }
        const savedUser = await userModel.create({
          username,
          email,
          password,
          group,
          name,
        });
        const token = jwt.sign(
          { userId: savedUser._id, email: savedUser.email },
          process.env.JWT_SECRET,
          { expiresIn: "6h" },
        );
        return res.json({
          payload: { message: "User created sucessfully", token },
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "error while signing up" });
      }
    });
  }
  testingMake() {
    this.app.post("/make", async (req: Request, res: Response) => {
      try {
        // Fetch data from the ContactModel
        const contacts = await contactModel.find({agentId:"agent_07ff7f6c39540e4e71a5c71385", isDeleted:false, isOnDNCList:false, dial_status:"connected-user"}).populate("referenceToCallId").limit(10) // Fetch all contacts
        if (!contacts || contacts.length === 0) {
          return res.status(404).send("No contacts found in the database.");
        }
        

        // Prepare data for Make.com
        const data = contacts.map((contact) => ({
          firstname: contact.firstname,
          lastname: contact?.lastname ||"",
          email: contact.email,
          phone: contact.phone,
          summary: contact.referenceToCallId?.retellCallSummary || "",
          url: contact.referenceToCallId?.recordingUrl ||"",
          transcript: contact.referenceToCallId?.transcript||"",
        }));

        // Ensure the Make webhook URL is defined
        const webhookUrl = process.env.MAKE_URL_FOR_GHL;
        if (!webhookUrl) {
          return res.status(500).send("Make URL is not defined in the environment variables.");
        }

        // Send data to Make
        const result = await axios.post(webhookUrl, { data }, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log("Response from Make:", result.data);

        // Respond to the client
        res.status(200).send("Data sent to Make successfully!");
      } catch (error) {
        console.error("Error sending data to Make:", error);
        res.status(500).send("Failed to send data to Make.");
      }
    });
  }

  testingCalendly() {
    this.app.post("/test-calender", async (req: Request, res: Response) => {
      const eventTypeSlug = "test-event-type";
      const dateTime = "2024-08-10T03:00:00+01:00";

      const schedulingLink = `https://calendly.com/hydradaboss06/${eventTypeSlug}/${dateTime}?month=2024-08&date=2024-08-10`;

      try {
        const response = await axios.post(
          "https://calendly.com/api/booking/invitees",
          {
            analytics: {
              invitee_landed_at: "2024-07-01T15:52:27.987Z",
              browser: "Chrome 126",
              device: "undefined Windows 10",
              fields_filled: 1,
              fields_presented: 1,
              booking_flow: "v3",
              seconds_to_convert: 45,
            },
            embed: {},
            event: {
              start_time: "2024-07-21T09:30:00+01:00",
              location_configuration: {
                location: "",
                phone_number: "",
                additional_info: "",
              },
              guests: {},
            },
            event_fields: [
              {
                id: 86536438,
                name: "Please share anything that will help prepare for our meeting.",
                format: "text",
                required: false,
                position: 0,
                answer_choices: null,
                include_other: false,
                value: "",
              },
            ],
            invitee: {
              timezone: "Africa/Lagos",
              time_notation: "24h",
              full_name: "Ganiyu Olamide Idris",
              email: "golamide27@tike.tz",
            },
            payment_token: {},
            recaptcha_token:
              "03AFcWeA4zspINFzCwvHId56h0v4T4cB1kpuPxBdEQGyMXD7E3s916-TFbrQCgoJkKul1-mUqgajgrHCFzaXZ23A3tCtxq9zIZ0ute14K06_rEVmPxFFObWHoTO796QZ40QTCvwaRY--AqYK7Ww8fhvDeSfc2LLaRuh4pTXfw0UBqJevTDVyH7_qD29MoaRpIotTJwrJVIHs3UpECzl4ekSHBHyZP_nJ2jJ_IXU1sPq4v-m2qJuzD8ZDDgP8VO3tXt_xpVP9Xo8Nvl4fAhhUqVuGo0xje45xCrRfsjdOyNCAxE-0-tUNdxGsQhzxZmVHZNXSv3K4DjAvoAaPtFGhq70vKexP-Xj8zdccMO_FDtoD3oN1zFIF9oK5yjSisX81B7CoUEwlBk8R6OCTICrN7kwd_oAgSvLDHFNMvZAk6ZA-RO6flsDhzOWa5WQkAjMLCe3Ne-TbJx_8H_aJy5aO20HHM-B-Jq5bVgfGXvU3ZAYYoR6rshwcfdg6BvhdDeT7m_XK9vvm7695kaS5y5QQxHaDKo5i2fbXS-EOosBNqy0cdBUDdZtDz5Exu_Mqv5ZASma0AhNsRQZik04EdkNL9rgLIHbCS8rQGnE3X4WBT70FpmJ2Ip5uRWeE0rj8Go5M3EfliI82p37e122FPsb_pkrBJmLWGiIWwPZy4Wgp80NFCbLvSbh_A4qYDHH8MBTe1-Jya76mR0XhEQI7PwxpdZAb_r3oQStmz4qdO0EpUP21Ul_1S_r3Ww2cdki29oC0SrfTGGIfWl22pi33sGaNhcJvtvpkNtqn7WhXL-umdMLlwOMH_RVwJznQzZZm1cSvc9Xl1EnBcmKqjDT0_gHvKBGQ6jIn0IS9sL1b_2EuOx8i_Bikh_MNxx8s9TlX5VFMLWgY0U7KuCIQu98liDK-6rJ0SG9SHSrurEqje-s2dYZE-44SegpFcdzZB_0QZ4PJZWvGc-R4mXfNvP0XeS55fVAFCZeThYxdzAYPJtyMTBmHIgZi-GlD5WFZq-uQQkj3IshH7ANqCMBVehQzwEQfBxIWZDyb-rTtlpzIIrscxYa750Sm0zvL3AGg9bsURtHnRb8MnECPtOqFQjYZh-W4qqSh0uGXKHttMN1xkxCBbSMW_NpPI4V_IXe50YdEhqXbJd8XlpAJe0IkRZban2_9UFeS7mldZzUfuyQ0Y9Uxo0msRl_DcMFRD3HCLUAe6sVV1IFSB6KXLoXVkTojpz6Ct16R1tfb2riylze1G4lZhb1yFIwAty5IKSvrsmLD5E9W6kLLdCMAtBJOpVNMurA3sKKHROOLHYyPkmc5MEWGTpKgMSI5PJJUraLteh92r2KSATJftX0F3ABsbCCaHqAC6QjzZYk7m5KRS0CYsg2PtrWkRGbfWCE0eJH_DZLLjirlNdx4E457q0Hqfq-YHm1kMEoGizIN65PS62hQQrG42Fg0HJXRWU1neYCtKzqnFEKFrLPtZU7QQf4JY1quD3fTXK5R0VpF4BpRVFYUzKJXnJdRNMJrw7EsXayhcOGsmxU_ds7tJPa207_nHZt0_J8sUpDIMEtIPZOtGjYEiHaLudm9rYbrUruo2SarK0BqpFeAeekRr-pY6bUU-bFNAYTttzLQaUNsuJsqQaOO_hHZ74M0PDt7zWr8IyCugMPawxZdvF29e1k5xeoFcf_NgSI0QS6vHr_jIQzUxRxKOBdzr_x6rQBBjJFVH3XiWC-is_JAiiPTv7HNyjkWd-keM59WHWyH60y9nWd2Xtp9QkfQu71qp6YMdXeV8LGueoBht6CIxnhbrTW0zJLaUpkdx4gYHsjWP0lT4OuFO3-GOMGblSB5PqYzU-rTmqmht49eNfF0ULyr98EhCqRNpBVuzXaOM8zBavBMlKV6CpE4q3uQJ2-7mxagLGEycJ5XvEKMzDLnKIlncvps2q7RNMxNVcteGxqBhiTR0u1wPMPdyuspZmd1GZGeieDuzzz4_m5mnAxs3H0rXgnGKB",
            tracking: {
              fingerprint: "16a55c03835bdf03c0414b62df7413a9",
            },
            scheduling_link_uuid: "pwm-pwm-235",
            locale: "en",
          },
        );

        console.log("Invitee added successfully:", response.data);
        res.send(response.data);
      } catch (error) {
        console.error("Error adding invitee:", error);
        throw error;
      }
    });
  }
  getFullStat() {
    this.app.post(
      "/get-daily-report",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const foundContacts = await contactModel.find({
          dial_status: { $ne: callstatusenum.NOT_CALLED },
          isDeleted: false,
        });
        const totalCount = await contactModel.countDocuments({
          agentId,
          isDeleted: { $ne: true },
        });
        const totalContactForAgent = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
        });
        const totalAnsweredCalls = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          dial_status: callstatusenum.CALLED,
        });
        const totalNotCalledForAgent = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          dial_status: callstatusenum.NOT_CALLED,
        });
        const totalAnsweredByVm = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          dial_status: callstatusenum.VOICEMAIL,
        });
        const totalCalls = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          dial_status: {
            $in: [
              callstatusenum.CALLED,
              callstatusenum.VOICEMAIL,
              callstatusenum.FAILED,
            ],
          },
        });
        const totalCallsTransffered = await contactModel.aggregate([
          {
            $match: {
              agentId,
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: "transcripts",
              localField: "referenceToCallId",
              foreignField: "_id",
              as: "callDetails",
            },
          },
          {
            $match: {
              "callDetails.disconnectionReason": "call_transfer",
            },
          },
          {
            $count: "result",
          },
        ]);
        const totalAppointment = await contactModel.aggregate([
          {
            $match: {
              agentId,
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: "transcripts",
              localField: "referenceToCallId",
              foreignField: "_id",
              as: "callDetails",
            },
          },
          {
            $match: {
              "callDetails.analyzedTranscript": "Scheduled",
            },
          },
          {
            $count: "result",
          },
        ]);
        const statsWithTranscripts = await Promise.all(
          foundContacts.map(async (stat) => {
            const transcript = stat.referenceToCallId?.transcript;
            const analyzedTranscript =
              stat.referenceToCallId?.analyzedTranscript;
            return {
              ...stat.toObject(),
              originalTranscript: transcript,
              analyzedTranscript,
            };
          }),
        );
        const data = {
          totalContactForAgent,
          totalAnsweredCalls,
          totalNotCalledForAgent,
          totalAnsweredByVm,
          totalAppointment:
            totalAppointment.length > 0 ? totalAppointment[0].result : 0,
          totalCallsTransffered:
            totalCallsTransffered.length > 0
              ? totalCallsTransffered[0].result
              : 0,
          totalCalls,
          contacts: statsWithTranscripts,
        };
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=contacts.txt",
        );
        res.setHeader("Content-Type", "text/plain");

        res.send(data);
      },
    );
  }
  getAllDbTags() {
    this.app.post("/get-tags", async (req: Request, res: Response) => {
      const { agentId } = req.body;

      try {
        // Validate the input
        // if (!Array.isArray(agentIds) || agentIds.length === 0) {
        //   return res
        //     .status(400)
        //     .send({ error: "agentIds must be a non-empty array." });
        // }

        // Fetch users with matching agent IDs
        const users = await userModel.find(
          { "agents.agentId": agentId },
          { agents: 1 }, // Only fetch the `agents` field
        );

        // Aggregate all tags into a single array
        const allTags = new Set<string>(); // Use a Set to ensure uniqueness

        users.forEach((user) => {
          user.agents.forEach((agent) => {
            if (agentId.includes(agent.agentId)) {
              agent.tag.forEach((tag: string) => allTags.add(tag)); // Add tags to the Set
            }
          });
        });

        // Convert Set to an array for the response
        const uniqueTagsArray = Array.from(allTags);

        // Send the response
        res.send({ tags: uniqueTagsArray });
      } catch (error) {
        console.error("Error fetching tags:", error);
        return res.status(500).send({ error: "Error fetching tags" });
      }
    });
  }
  getAllDbTagsClient() {
    this.app.post("/get-tags-client", async (req: Request, res: Response) => {
      const { agentIds } = req.body;

      try {
        // Validate the input
        if (!Array.isArray(agentIds) || agentIds.length === 0) {
          return res
            .status(400)
            .send({ error: "agentIds must be a non-empty array." });
        }

        // Fetch users with matching agent IDs
        const users = await userModel.find(
          { "agents.agentId": { $in: agentIds } },
          { agents: 1 }, // Only fetch the `agents` field
        );

        // Aggregate all tags into a single array
        const allTags = new Set<string>(); // Use a Set to ensure uniqueness

        users.forEach((user) => {
          user.agents.forEach((agent) => {
            if (agentIds.includes(agent.agentId)) {
              agent.tag.forEach((tag: string) => allTags.add(tag)); // Add tags to the Set
            }
          });
        });

        // Convert Set to an array for the response
        const uniqueTagsArray = Array.from(allTags);

        // Send the response
        res.send({ tags: uniqueTagsArray });
      } catch (error) {
        console.error("Error fetching tags:", error);
        return res.status(500).send({ error: "Error fetching tags" });
      }
    });
  }
  syncStatWithMake() {
    this.app.post("/api/make", async (req: Request, res: Response) => {
      const foundContacts: IContact[] = await contactModel
        .find({
          isDeleted: false,
        })
        .populate("referenceToCallId");

      const mappedContacts = await Promise.all(
        foundContacts.map(async (contact) => {
          let date: string | undefined;

          if (contact.referenceToCallId?.analyzedTranscript === "Call back") {
            date = await reviewCallback(contact.referenceToCallId.transcript);
          }

          const firstname = contact.firstname ? contact.firstname : ".";
          const lastname = contact.lastname ? contact.lastname : ".";

          return {
            firstname: firstname,
            lastname: lastname,
            fullName: `${firstname} ${lastname}`,
            phone: contact.phone ? contact.phone : ".",
            email: contact.email ? contact.email : ".",
            company: "",
            summary: contact.referenceToCallId?.retellCallSummary
              ? contact.referenceToCallId.retellCallSummary
              : ".",
            recordingAudioLink: contact.referenceToCallId?.recordingUrl
              ? contact.referenceToCallId.recordingUrl
              : ".",
            timeToCallback: date ? "." : date,
          };
        }),
      );

      res.json(mappedContacts);
    });
  }
  testingZoom() {
    this.app.post("/test/zoom", async (req: Request, res: Response) => {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const userEmail = process.env.ZOOM_EMAIL;
      const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
      // const userId = process.env.ZOOM_USER_ID;
      const { start_time, invitee } = req.body;
      try {
        await generateZoomAccessToken(clientId, clientSecret, accountId);

        const userId = await getUserId(
          userEmail,
          clientId,
          clientSecret,
          accountId,
        );
        console.log("userID is : ", userId);

        await getAllSchedulesWithAvailabilityId(
          clientId,
          clientSecret,
          accountId,
        );

        const availableTimes = await checkAvailability(
          clientId,
          clientSecret,
          accountId,
          availabilityId,
        );
        console.log("Availablle times are : ", availableTimes);
        // const firstname = "Testing";

        // const scheduledMeeting = await scheduleMeeting(
        //   clientId,
        //   clientSecret,
        //   accountId,
        //   userId,
        //   start_time,
        //   45,
        //   "Important Meeting with retell",
        //   "Discuss important matters for 45 minutes",
        //   invitee,
        //   firstname,
        // );
        // console.log("Meeting scheduled:", scheduledMeeting);
        res.send("done");
      } catch (error) {
        console.error("An error occurred:", error);
      }
    });
  }
  updateUserTag() {
    this.app.post("/update/metadata", async (req: Request, res: Response) => {
      try {
        const { updates } = req.body;
        const result = await updateContactAndTranscript(updates);
        res.json({ message: result });
      } catch (error) {
        console.error("Error updating events:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
  }
  updateUserTagForClient() {
    this.app.post(
      "/update/metadata-client",
      async (req: Request, res: Response) => {
        try {
          const { updates } = req.body;
          const result = await updateContactAndTranscriptForClient(updates);
          res.json({ message: result });
        } catch (error) {
          console.error("Error updating events:", error);
          res.status(500).json({ error: "Internal server error." });
        }
      },
    );
  }
  checkAvailabiltyWithZoom() {
    this.app.post("/zoom/availabilty", async (req: Request, res: Response) => {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
      const availableTimes = await checkAvailability(
        clientId,
        clientSecret,
        accountId,
        availabilityId,
      );
      res.send(availableTimes);
    });
  }
  bookAppointmentWithZoom() {
    this.app.post("/zoom/appointment", async (req: Request, res: Response) => {
      let lastname;
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const userId = process.env.ZOOM_USER_ID;
      const invitee = req.body.args.email;
      const start_time = req.body.args.startTime;
      const firstname =
        req.body.call.retell_llm_dynamic_variables.user_firstname;
      lastname = req.body.call.retell_llm_dynamic_variables.user_lastname;

      if (!lastname) {
        lastname = ".";
      }
      const scheduledMeeting = await scheduleMeeting(
        clientId,
        clientSecret,
        accountId,
        userId,
        start_time,
        45,
        "Important Meeting",
        "Discuss important matters",
        invitee,
        firstname,
        lastname,
      );
      res.send("Schduled");
    });
  }
  script() {
    this.app.post("/script", async (req: Request, res: Response) => {
      try {
        interface Contact {
          email: string;
          firstname: string;
          phone: string;
          [key: string]: string;
        }

        async function processCSV(
          mainCSV: string,
          compareCSV: string,
          nonDuplicateCSV: string,
          duplicateCSV: string,
        ): Promise<void> {
          return new Promise((resolve, reject) => {
            const mainContacts: Contact[] = [];
            const compareContacts: Contact[] = [];

            // Read the main CSV (main contacts)
            fs.createReadStream(mainCSV)
              .pipe(csv())
              .on("data", (data: Contact) => mainContacts.push(data))
              .on("end", () => {
                // Read the compare CSV (DNC or similar contacts)
                fs.createReadStream(compareCSV)
                  .pipe(csv())
                  .on("data", (data: Contact) => compareContacts.push(data))
                  .on("end", async () => {
                    try {
                      // Create a set of formatted phone numbers and emails from the main list
                      const mainSet = new Set<string>(
                        mainContacts.map((contact) => {
                          const formattedPhone = contact.phone
                            ? formatPhoneNumber(contact.phone)
                            : null;
                          return formattedPhone || contact.email; // Use formatted phone if available, otherwise use email
                        }),
                      );

                      // Filter compare contacts based on the main set
                      const duplicateContacts = compareContacts.filter(
                        (contact) => {
                          const formattedPhone = contact.phone
                            ? formatPhoneNumber(contact.phone)
                            : null;
                          const key = formattedPhone; // Use formatted phone if available, otherwise use email
                          console.log(`Checking for duplicate: ${key}`);
                          return mainSet.has(key);
                        },
                      );

                      const nonDuplicateContacts = compareContacts.filter(
                        (contact) => {
                          const formattedPhone = contact.phone
                            ? formatPhoneNumber(contact.phone)
                            : null;
                          const key = formattedPhone; // Use formatted phone if available, otherwise use email
                          return !mainSet.has(key);
                        },
                      );

                      // Write non-duplicate contacts to a CSV
                      if (nonDuplicateContacts.length > 0) {
                        const nonDuplicateWriter = createObjectCsvWriter({
                          path: nonDuplicateCSV,
                          header: Object.keys(nonDuplicateContacts[0]).map(
                            (key) => ({
                              id: key,
                              title: key,
                            }),
                          ),
                        });
                        await nonDuplicateWriter.writeRecords(
                          nonDuplicateContacts,
                        );
                        console.log(
                          `Non-duplicate contacts saved to ${nonDuplicateCSV}`,
                        );
                      } else {
                        console.log("No non-duplicate contacts to write.");
                      }

                      // Write duplicate contacts to a CSV
                      if (duplicateContacts.length > 0) {
                        const duplicateWriter = createObjectCsvWriter({
                          path: duplicateCSV,
                          header: Object.keys(duplicateContacts[0]).map(
                            (key) => ({
                              id: key,
                              title: key,
                            }),
                          ),
                        });
                        await duplicateWriter.writeRecords(duplicateContacts);
                        console.log(
                          `Duplicate contacts saved to ${duplicateCSV}`,
                        );
                      } else {
                        console.log("No duplicate contacts to write.");
                      }

                      resolve();
                    } catch (err) {
                      console.error("Error writing CSV:", err);
                      reject(err);
                    }
                  })
                  .on("error", (err) => reject(err));
              })
              .on("error", (err) => reject(err));
          });
        }

        // Paths to CSV files
        const mainCSVPath = path.join(__dirname, "../public", "main.csv");
        const compareCSVPath = path.join(__dirname, "../public", "compare.csv");
        const nonDuplicateCSVPath = path.join(
          __dirname,
          "../public",
          "non_duplicate.csv",
        );
        const duplicateCSVPath = path.join(
          __dirname,
          "../public",
          "duplicate.csv",
        );

        // Call the function to process the CSV files
        await processCSV(
          mainCSVPath,
          compareCSVPath,
          nonDuplicateCSVPath,
          duplicateCSVPath,
        );

        res.status(200).json({
          message: "Contacts have been filtered and saved successfully",
        });
      } catch (error) {
        res.status(500).json({
          message: "An error occurred while processing the CSVs",
        });
      }
    });
  }
  populateUserGet() {
    this.app.post("/user/populate", async (req: Request, res: Response) => {
      try {
        const { agentId, dateOption, status, jobId } = req.body;
        const timeZone = "America/Los_Angeles"; // PST time zone
        const now = new Date();
        const zonedNow = toZonedTime(now, timeZone);
        const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
        let dateFilter = {};
        let dateFilter1 = {};
        let tag = {};

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
        } else if (dateOption || dateOption === "") {
          switch (dateOption) {
            case DateOption.Today:
              dateFilter = { datesCalled: today };
              dateFilter1 = { day: today };
              break;
            case DateOption.Yesterday:
              const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
              const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
                timeZone,
              });
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
            case DateOption.Total:
              dateFilter = {};
              dateFilter1 = {};
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
          }
        }
        console.log(dateFilter);
        let query: any = {
          agentId,
          isDeleted: false,
          ...dateFilter,
          ...tag,
        };

        // Only add status to the query if it's provided
        if (status) {
          switch (status) {
            case "failed":
              query.dial_status = callstatusenum.FAILED;
              break;
            case "called":
              query.dial_status = { $ne: callstatusenum.NOT_CALLED };
              break;
            case "not-called":
              query.dial_status = callstatusenum.NOT_CALLED;
              break;
            case "answered":
              query.dial_status = callstatusenum.CALLED;
              break;
            case "transferred":
              query.dial_status = callstatusenum.TRANSFERRED;
              break;
            case "voicemail":
              query.dial_status = callstatusenum.VOICEMAIL;
              break;
            case "appointment":
              query.dial_status = callstatusenum.SCHEDULED;
              break;
            case "ivr":
              query.dial_status = callstatusenum.IVR;
              break;
            case "inactivity":
              query.dial_status = callstatusenum.INACTIVITY;
              break;
          }
        }

        console.log("Final query:", query);

        const result = await contactModel
          .find(query)
          .populate("referenceToCallId");

        res.json(result);
      } catch (error) {
        console.error("Error in populateUserGet:", error);
        res.status(500).send("An error occurred while processing the request.");
      }
    });
  }
  resetPassword() {
    this.app.post(
      "/user/reset-password",
      async (req: Request, res: Response) => {
        try {
          const { email, newPassword } = req.body;

          // Validate input
          if (!email || !newPassword) {
            return res
              .status(400)
              .json({ message: "Please provide email and new password" });
          }

          // Find the user by email
          const user = await userModel.findOne({ email });
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }

          // Hash the new password
          const newPasswordHash = await argon2.hash(newPassword);

          // Update the user's passwordHash
          user.password = newPassword;
          user.passwordHash = newPasswordHash;
          await user.save();

          return res.json({ message: "Password reset successfully" });
        } catch (error) {
          console.log(error);
          return res
            .status(500)
            .json({ message: "Error while resetting password" });
        }
      },
    );
  }
  testingZap() {
    this.app.post("/zapTest", async (req: Request, res: Response) => {
      try {
        const data = {"leads":[{
          firstname: "Nick",
          lastname: "Bernadini",
          email: "info@ixperience.io",
          phone: "+1727262723",
          AI_Voice_Agent: {
            call_recording_url:
              "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
            status: "call-ended",
            transcript: "This is test data fron intuitiveagent",
            duration: "00:00;05",
            timestamp: "2024-12-09",
          }
        }, {
          firstname: "Jane",
          lastname: "Doe",
          email: "janedoe@gmail.com",
          phone: "+1727223723",
          AI_Voice_Agent: {
            call_recording_url:
              "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
            status: "call-ended",
            transcript: "This is test data fron intuitiveagent",
            duration: "00:00;05",
            timestamp: "2024-12-09",
          }
        },
        {
          firstname:"Micheal",
          lastname: "Doe",
          email: "michealdoe@gmail.com",
          phone: "+1727223723",
          AI_Voice_Agent: {
            call_recording_url:
              "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
            status: "call-ended",
            transcript: "This is test data fron intuitiveagent",
            duration: "00:00;05",
            timestamp: "2024-12-09",
          }
        },
      ]}

        const result = axios.post(process.env.ZAP_URL, data);
        console.log("don3");
        res.send("done");
      } catch (error) {
        console.log(error);
      }
    });
  }
  getCallHistoryClient() {
    this.app.post(
      "/call-history-client",
      async (req: Request, res: Response) => {
        try {
          const { agentIds, dateOption } = req.body;
          const page = parseInt(req.body.page) || 1;
          const pageSize = 100;
          const skip = (page - 1) * pageSize;

          let dateFilter;
          let dateFilter1;
          const timeZone = "America/Los_Angeles";
          const now = new Date();
          const zonedNow = toZonedTime(now, timeZone);
          const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
          switch (dateOption) {
            case DateOption.Today:
              dateFilter = { date: today };
              dateFilter1 = { day: today };
              break;
            case DateOption.Yesterday:
              const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
              const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
                timeZone,
              });
              dateFilter = { date: yesterday };
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
              dateFilter = { date: { $in: weekdays } };
              dateFilter1 = { day: { $in: weekdays } };
              break;
            case DateOption.ThisMonth:
              const monthDates: string[] = [];
              for (let i = 0; i < now.getDate(); i++) {
                const day = subDays(now, i);
                monthDates.unshift(format(day, "yyyy-MM-dd", { timeZone }));
              }
              dateFilter = { date: { $in: monthDates } };
              dateFilter1 = { day: { $in: monthDates } };
              break;
            default:
              const recentJob = await callHistoryModel
                .findOne({ agentId: { $in: agentIds } })
                .sort({ createdAt: -1 })
                .lean();

              if (recentJob) {
                dateFilter = { date: recentJob.date };
                dateFilter1 = { day: recentJob.date };
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
          console.log(dateFilter);
          const callHistory = await callHistoryModel
            .find({ agentId: { $in: agentIds }, ...dateFilter })
            .sort({ startTimestamp: -1 })
            .skip(skip)
            .limit(pageSize);

          const callHistories = callHistory.map((history) => ({
            firstname: history.userFirstname || "",
            lastname: history.userLastname || "",
            email: history.userEmail || "",
            phone: history.toNumber || "",
            agentId: history.agentName || "",
            transcript: history.transcript || "",
            summary: history.callSummary || "",
            sentiment: history.userSentiment || "",
            timestamp: history.endTimestamp || "",
            duration: history.durationMs || "",
            status: history.callStatus || "",
            recordingUrl: history.recordingUrl || "",
            address: history.address || "",
            callId: history.callId || "",
            dial_status: history.dial_status || "",
          }));

          const totalCount = await callHistoryModel.countDocuments({
            agentId: { $in: agentIds },
            ...dateFilter,
          });
          const totalPages = Math.ceil(totalCount / pageSize);

          res.json({
            success: true,
            page,
            totalPages,
            totalCount,
            callHistories,
          });
        } catch (error) {
          console.error("Error fetching call history:", error);
          res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        }
      },
    );
  }
  getCallHistoryAdmin() {
    this.app.post(
      "/call-history-admin",
      async (req: Request, res: Response) => {
        try {
          const { agentId, dateOption } = req.body;
          const page = parseInt(req.body.page) || 1;
          const pageSize = 100;
          const skip = (page - 1) * pageSize;

          let dateFilter;
          let dateFilter1;
          const timeZone = "America/Los_Angeles";
          const now = new Date();
          const zonedNow = toZonedTime(now, timeZone);
          const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
          switch (dateOption) {
            case DateOption.Today:
              dateFilter = { date: today };
              dateFilter1 = { day: today };
              break;
            case DateOption.Yesterday:
              const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
              const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
                timeZone,
              });
              dateFilter = { date: yesterday };
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
              dateFilter = { date: { $in: weekdays } };
              dateFilter1 = { day: { $in: weekdays } };
              break;
            case DateOption.ThisMonth:
              const monthDates: string[] = [];
              for (let i = 0; i < now.getDate(); i++) {
                const day = subDays(now, i);
                monthDates.unshift(format(day, "yyyy-MM-dd", { timeZone }));
              }
              dateFilter = { date: { $in: monthDates } };
              dateFilter1 = { day: { $in: monthDates } };
              break;
            default:
              const recentJob = await callHistoryModel
                .findOne({ agentId })
                .sort({ createdAt: -1 })
                .lean();

              if (recentJob) {
                dateFilter = { date: recentJob.date };
                dateFilter1 = { day: recentJob.date };
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
          const callHistory = await callHistoryModel
            .find({ agentId, ...dateFilter }, { callId: 0 })
            .sort({ startTimestamp: -1 })
            .skip(skip)
            .limit(pageSize);

          const totalCount = await callHistoryModel.countDocuments({
            agentId,
            ...dateFilter,
          });
          const totalPages = Math.ceil(totalCount / pageSize);

          res.json({
            success: true,
            page,
            totalPages,
            totalCount,
            callHistory,
          });
        } catch (error) {
          console.error("Error fetching call history:", error);
          res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        }
      },
    );
  }
  secondscript() {
    this.app.post("/script1", async (req: Request, res: Response) => {
      const result = await script(req.body.jobid);
      res.send(result);
    });
  }
  sendReportToClient() {
    this.app.get(
      "/send-report-to-client",
      async (req: Request, res: Response) => {
        try {
          const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
          //const today  = "2024-10-31"
          const dailyStats = await DailyStatsModel.find({ day: today }).exec();

          // Transform the data into an object of objects
          const result: Record<string, Ilogs> = {};

          dailyStats.forEach((stat) => {
            const agentKey: string =
              typeof stat.agentId === "string" ? stat.agentId : "unknown";

            if (!result[agentKey]) {
              result[agentKey] = {
                day: today, // Adding required properties
                agentId: agentKey, // Use the validated agentKey
                jobProcessedBy: stat.jobProcessedBy || "unknown",
                totalCalls: 0,
                totalTransffered: 0,
                totalAnsweredByVm: 0,
                totalFailed: 0,
                totalAppointment: 0,
                totalCallAnswered: 0,
                totalDialNoAnswer: 0,
                totalAnsweredByIVR: 0,
                totalCallInactivity: 0,
                totalCallDuration: 0,
              };
            }

            result[agentKey].totalCalls += stat.totalCalls || 0;
            result[agentKey].totalTransffered += stat.totalTransffered || 0;
            result[agentKey].totalAnsweredByVm += stat.totalAnsweredByVm || 0;
            result[agentKey].totalFailed += stat.totalFailed || 0;
            result[agentKey].totalAppointment += stat.totalAppointment || 0;
            result[agentKey].totalCallAnswered += stat.totalCallAnswered || 0;
            result[agentKey].totalDialNoAnswer += stat.totalDialNoAnswer || 0;
          });

          // Filter results to include only those with totalCalls > 2
          const filteredResults = Object.values(result).filter(
            (agentStats) => agentStats.totalCalls > 2,
          );

          res.json(filteredResults); // Send the filtered results back to the client
        } catch (error) {
          console.error("Error fetching daily stats:", error);
          res.status(500).send("Internal Server Error"); // Send an error response
        }
      },
    );
  }
  getDatesAgentsHaveBeenCalled() {
    this.app.post("/agent/date", async (req: Request, res: Response) => {
      try {
        const { agentId } = req.body;

        // Fetch jobs for the given agentId
        const results = await jobModel.find({ agentId });

        // Map each result to an object containing 'date' and 'tag'
        const dateTagArray = results.map((job: any) => {
          const createdAt = new Date(job.createdAt).toISOString().split("T")[0]; // Format date as YYYY-MM-DD
          const tag = job.tagProcessedFor || "unknown"; // Default to 'unknown' if tag is missing

          return {
            date: createdAt,
            tag: tag,
            jobId: job.jobId,
          };
        });

        // Send the array of objects as the response
        res.status(200).json({ dateTagArray });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ message: "An error occurred while fetching data." });
      }
    });
  }
  getOneLLM() {
    this.app.post("/get-llm", async (req: Request, res: Response) => {
      const { llm_id } = req.body;

      // Validate if LLM ID is provided
      if (!llm_id) {
        return res.status(400).json({
          success: false,
          message: "LLM ID is required.",
        });
      }

      try {
        const result = await getOneLLM(llm_id);

        if (result.success) {
          return res.status(200).json({
            success: true,
            data: result.data,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        console.error("Error fetching LLM from Retell:", error);
        return res.status(500).json({
          success: false,
          message: "An unexpected error occurred while fetching LLM data.",
        });
      }
    });
  }
  getAllLLM() {
    this.app.get("/list-llm", async (req: Request, res: Response) => {
      try {
        const result: any = await getAllLLM();

        if (result.success) {
          return res.status(200).json({
            success: true,
            data: result.data,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        console.error("Error fetching all LLMs from Retell:", error);
        return res.status(500).json({
          success: false,
          message: "An unexpected error occurred while fetching all LLM data.",
        });
      }
    });
  }
  updateAgent() {
    this.app.post("/update-agent", async (req: Request, res: Response) => {
      const { agentId, payload } = req.body;
      if (!agentId) {
        return res.status(400).json({
          success: false,
          message: "Agent ID is required.",
        });
      }
      const result = await updateAgent(agentId, payload);
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    });
  }
  updateLLM() {
    this.app.post("/update-llm", async (req: Request, res: Response) => {
      const { llm_id, payload } = req.body;

      // Validate input
      if (!llm_id) {
        return res.status(400).json({
          success: false,
          message: "LLM ID is required.",
        });
      }

      if (!payload || typeof payload !== "object") {
        return res.status(400).json({
          success: false,
          message: "A valid payload is required.",
        });
      }

      try {
        const result = await updateLLM(llm_id, payload);

        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        console.error("Error updating LLM:", error);

        return res.status(500).json({
          success: false,
          message: "An unexpected error occurred while updating the LLM.",
        });
      }
    });
  }
  revertLLM() {
    this.app.post("/revert-llm", async (req: Request, res: Response) => {
      const { llm_id, update_index } = req.body;

      console;

      if (!llm_id || typeof llm_id !== "string") {
        return res.status(400).json({
          success: false,
          message: "LLM ID is required and must be a string.",
        });
      }

      if (!update_index || typeof update_index !== "number") {
        return res.status(400).json({
          success: false,
          message: "A valid update index is required and must be a number.",
        });
      }

      try {
        const result = await revertLLM(llm_id, update_index);

        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        console.error("Error in /revert-llm endpoint:", error);

        return res.status(500).json({
          success: false,
          message: "An unexpected error occurred while reverting the LLM.",
        });
      }
    });
  }
  revertAgent() {
    this.app.post("/revert-agent", async (req: Request, res: Response) => {
      const { agentId, update_index } = req.body;

      console;

      if (!agentId || typeof agentId !== "string") {
        return res.status(400).json({
          success: false,
          message: "LLM ID is required and must be a string.",
        });
      }

      if (!update_index || typeof update_index !== "number") {
        return res.status(400).json({
          success: false,
          message: "A valid update index is required and must be a number.",
        });
      }

      try {
        const result = await revertAgent(agentId, update_index);

        if (result.success) {
          return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        console.error("Error in /revert-llm endpoint:", error);

        return res.status(500).json({
          success: false,
          message: "An unexpected error occurred while reverting the LLM.",
        });
      }
    });
  }
  graphChartAdmin() {
    this.app.post("/graph-stats-admin", async (req: Request, res: Response) => {
      try {
        const {
          agentId,
          dateOption,
        }: { agentId: string; dateOption?: string } = req.body;

        if (!agentId) {
          return res.status(400).json({ error: "agentId is required" });
        }

        // Default to "last-schedule" if dateOption is not provided
        const selectedDateOption = dateOption || DateOption.LAST_SCHEDULE;

        // Get today's date in PST
        const todays = DateTime.now()
          .setZone("America/Los_Angeles")
          .startOf("day");
        const todayString = todays.toISODate(); // Format as YYYY-MM-DD

        let stats: any;
        let response: any;

        // Generate a template for hours from 09:00 to 15:00
        const createHourlyTemplate = () => {
          return Array.from({ length: 7 }, (_, index) => ({
            x: `${(9 + index).toString().padStart(2, "0")}:00`,
            y: 0,
          }));
        };

        if (selectedDateOption === DateOption.Today) {
          stats = await dailyGraphModel.findOne({ agentId, date: todayString });

          // Initialize response with hourly template
          response = createHourlyTemplate();

          if (stats) {
            const hourlyCalls: Map<string, number> =
              stats.hourlyCalls || new Map();

            // Update the response with actual data
            hourlyCalls.forEach((count, hour) => {
              const hourIndex = parseInt(hour.split(":")[0], 10) - 9; // 9 AM is the first index
              if (hourIndex >= 0 && hourIndex < 7) {
                response[hourIndex].y = count; // Update the count for the corresponding hour
              }
            });
          }
        } else if (selectedDateOption === DateOption.ThisWeek) {
          const weekDays: string[] = [];
          const currentDay = DateTime.now().setZone("America/Los_Angeles");

          // Generate the rolling 7-day period starting from the current day
          for (let i = 0; i < 7; i++) {
            const day = currentDay.minus({ days: i }).toISODate();
            weekDays.push(day);
          }

          // Fetch stats for the collected weekDays
          stats = await dailyGraphModel.find({
            agentId,
            date: { $in: weekDays },
          });

          // Predefined structure for the rolling 7 days
          const predefinedStructure = weekDays.map((day) => {
            const dayName = DateTime.fromISO(day, {
              zone: "America/Los_Angeles",
            }).toLocaleString({ weekday: "long" });
            return { x: dayName, y: 0 }; // Initialize with 0
          });

          // Populate the predefined structure with actual data
          weekDays.forEach((day) => {
            const dayName = DateTime.fromISO(day, {
              zone: "America/Los_Angeles",
            }).toLocaleString({ weekday: "long" });

            const dayStats = stats.find((s: any) => s.date === day);
            const hourlyCalls: Map<string, number> = dayStats
              ? dayStats.hourlyCalls
              : new Map();

            const hourlySum = Array.from(hourlyCalls.entries())
              .filter(([hour]: [string, number]) => {
                const hourInt = parseInt(hour.split(":")[0], 10);
                return hourInt >= 9 && hourInt < 15; // Only count calls between 9 AM and 3 PM
              })
              .reduce((sum, [, count]: [string, number]) => sum + count, 0);

            // Update the corresponding day in the predefined structure
            const dayEntry = predefinedStructure.find(
              (entry) => entry.x === dayName,
            );
            if (dayEntry) {
              dayEntry.y = hourlySum; // Update the count
            }
          });

          response = predefinedStructure.reverse(); // Reverse to display from today to 7 days ago
        } else if (selectedDateOption === DateOption.ThisMonth) {
          stats = await dailyGraphModel.find({ agentId });

          const monthlyData = Array(12)
            .fill(0)
            .map((_, monthIndex) => {
              const monthStats = stats.filter(
                (s: any) => DateTime.fromISO(s.date).month === monthIndex + 1,
              );

              const monthlySum = monthStats.reduce((sum: number, stat: any) => {
                const hourlyCalls: Map<string, number> = stat.hourlyCalls;

                const hourlyCallsSum = Array.from(hourlyCalls.entries())
                  .filter(([hour]: [string, number]) => {
                    const hourInt = parseInt(hour.split(":")[0], 10);
                    return hourInt >= 9 && hourInt < 15;
                  })
                  .reduce((sum, [, count]: [string, number]) => sum + count, 0);

                return sum + hourlyCallsSum;
              }, 0);

              const monthName = DateTime.fromObject({
                month: monthIndex + 1,
              }).toLocaleString({ month: "long" });

              return { x: monthName, y: monthlySum };
            });

          response = monthlyData;
        } else if (selectedDateOption === DateOption.LAST_SCHEDULE) {
          // Find the most recent schedule date
          const lastStat = await dailyGraphModel
            .find({ agentId })
            .sort({ date: -1 })
            .limit(1);

          // Check if no stats were found
          if (!lastStat || lastStat.length === 0) {
            // Return a predefined structure with all values set to 0
            response = createHourlyTemplate();
          } else {
            const lastScheduleDate = lastStat[0].date;

            // Fetch stats for the last schedule date
            stats = await dailyGraphModel.find({
              agentId,
              date: lastScheduleDate,
            });

            // Initialize response with hourly template
            response = createHourlyTemplate();

            if (stats && stats.length > 0) {
              const hourlyCalls: Map<string, number> =
                stats[0].hourlyCalls || new Map();

              // Update the response with actual data
              hourlyCalls.forEach((count, hour) => {
                const hourIndex = parseInt(hour.split(":")[0], 10) - 9; // 9 AM is the first index
                if (hourIndex >= 0 && hourIndex < 7) {
                  response[hourIndex].y = count; // Update the count for the corresponding hour
                }
              });
            }
          }
        } else {
          return res.status(400).json({ error: "Invalid dateOption" });
        }

        res.json(response);
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: "An error occurred" });
      }
    });
  }
  getSpecificScheduleAdmin() {
    this.app.post(
      "/get-schedule-admin",
      async (req: Request, res: Response) => {
        try {
          const { agentId } = req.body;
          if (!agentId) {
            return res
              .status(400)
              .json({ message: "Please provide an agentId" });
          }
          const result = await jobModel.findOne({
            agentId,
            callstatus: jobstatus.ON_CALL,
          });
          if (!result) {
            return res.status(404).json({ message: "No Running job found" });
          }

          res.json({ result });
        } catch (error) {
          console.error("Error fetching schedule:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }
  getSpecificScheduleClient() {
    this.app.post(
      "/get-schedule-client",
      async (req: Request, res: Response) => {
        try {
          const { agentIds } = req.body;

          if (!agentIds) {
            return res.status(400).json({ message: "Please provide agentIds" });
          }
          const result = await jobModel.findOne({
            agentId: { $in: agentIds },
            callstatus: jobstatus.ON_CALL,
          });

          if (!result) {
            return res.status(404).json({ message: "No job found" });
          }

          res.json({ result });
        } catch (error) {
          console.error("Error fetching schedule:", error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }
  graphChartClient() {
    this.app.post(
      "/graph-stats-client",
      async (req: Request, res: Response) => {
        try {
          const { agentIds, dateOption } = req.body;

          if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
            return res.status(400).json({
              error: "agentIds are required",
            });
          }

          // Default to "lastSchedule" if dateOption is not provided
          const selectedDateOption = dateOption || DateOption.LAST_SCHEDULE;

          let stats: any[];
          let response: any[];

          const createHourlyTemplate = () => {
            return Array.from({ length: 7 }, (_, index) => ({
              x: `${(9 + index).toString().padStart(2, "0")}:00`,
              y: 0,
            }));
          };

          if (selectedDateOption === DateOption.Today) {
            const todays = DateTime.now()
              .setZone("America/Los_Angeles")
              .startOf("day");
            const todayString = todays.toISODate(); // Format as YYYY-MM-DD

            stats = await dailyGraphModel.find({
              agentId: { $in: agentIds },
              date: todayString,
            });

            // Initialize response with hourly template
            response = createHourlyTemplate();

            if (stats.length === 0) {
              return res.status(404).json({
                message: "No stats found for the given agents and day",
              });
            }

            const aggregatedCalls: { [hour: string]: number } = {};

            stats.forEach((stat) => {
              const hourlyCalls = stat.hourlyCalls as Map<string, number>;

              hourlyCalls.forEach((count: number, hour: string) => {
                const hourInt = parseInt(hour.split(":")[0], 10);
                if (hourInt >= 9 && hourInt < 15) {
                  if (!aggregatedCalls[hour]) {
                    aggregatedCalls[hour] = 0;
                  }
                  aggregatedCalls[hour] += count;
                }
              });
            });

            // Update response with aggregated data
            response.forEach((entry) => {
              if (aggregatedCalls[entry.x]) {
                entry.y = aggregatedCalls[entry.x];
              }
            });
          } else if (selectedDateOption === DateOption.ThisWeek) {
            const selectedDay = DateTime.now()
              .setZone("America/Los_Angeles")
              .startOf("day"); // Get the current day at the start of the day

            // Create an array of the last 7 days, including the selected day
            const weekDays: string[] = Array.from({ length: 7 }, (_, index) =>
              selectedDay.minus({ days: index }).toISODate(),
            ).reverse(); // Reverse to get them in chronological order (today to 6 days ago)

            // Query for stats in the last 7 days
            stats = await dailyGraphModel.find({
              agentId: { $in: agentIds },
              date: { $in: weekDays },
            });

            // Initialize response with all 7 days having y = 0
            const weeklyData = weekDays.map((day) => {
              const dayName = DateTime.fromISO(day, {
                zone: "America/Los_Angeles",
              }).toLocaleString({ weekday: "long" }); // Get the localized weekday name

              // Find the stats for the current day
              const dailyStats = stats.filter((s) => s.date === day);

              // Sum up hourly calls for the day
              const dailySum = dailyStats.reduce((sum, stat) => {
                const hourlyCalls = stat.hourlyCalls as Map<string, number>;

                // Filter and sum hourly calls between 9 AM and 3 PM
                const hourlySum = Array.from(hourlyCalls.entries())
                  .filter(([hour]) => {
                    const hourInt = parseInt(hour.split(":")[0], 10);
                    return hourInt >= 9 && hourInt < 15;
                  })
                  .reduce((sum, [, count]) => sum + count, 0);

                return sum + hourlySum;
              }, 0);

              return { x: dayName, y: dailySum || 0 }; // Ensure 0 for missing stats
            });

            response = weeklyData;
          } else if (selectedDateOption === DateOption.ThisMonth) {
            stats = await dailyGraphModel.find({
              agentId: { $in: agentIds },
            });

            console.log("stats: ", stats);

            const monthlyData = Array(12)
              .fill(0)
              .map((_, monthIndex) => {
                const monthStats = stats.filter(
                  (s) => DateTime.fromISO(s.date).month === monthIndex + 1,
                );

                const monthlySum = monthStats.reduce((sum, stat) => {
                  const hourlyCalls = stat.hourlyCalls as Map<string, number>;

                  const hourlySum = Array.from(hourlyCalls.entries())
                    .filter(([hour]) => {
                      const hourInt = parseInt(hour.split(":")[0], 10);
                      return hourInt >= 9 && hourInt < 15;
                    })
                    .reduce((sum, [, count]) => sum + count, 0);

                  return sum + hourlySum;
                }, 0);

                const monthName = DateTime.fromObject({
                  month: monthIndex + 1,
                }).toLocaleString({ month: "long" });

                return { x: monthName, y: monthlySum };
              });

            response = monthlyData;
          } else if (selectedDateOption === DateOption.LAST_SCHEDULE) {
            // Find the most recent schedule date
            const lastStat = await dailyGraphModel
              .find({ agentId: { $in: agentIds } })
              .sort({ date: -1 })
              .limit(1);

            // If no last schedule exists, return default hourly template
            if (!lastStat || lastStat.length === 0) {
              response = createHourlyTemplate();
            } else {
              const lastScheduleDate = lastStat[0].date;

              // Fetch stats for the last schedule date
              stats = await dailyGraphModel.find({
                agentId: { $in: agentIds },
                date: lastScheduleDate,
              });

              // Initialize response with hourly template
              response = createHourlyTemplate();

              if (stats.length > 0) {
                const aggregatedCalls: { [hour: string]: number } = {};

                stats.forEach((stat) => {
                  const hourlyCalls = stat.hourlyCalls as Map<string, number>;

                  hourlyCalls.forEach((count: number, hour: string) => {
                    const hourInt = parseInt(hour.split(":")[0], 10);
                    if (hourInt >= 9 && hourInt < 15) {
                      if (!aggregatedCalls[hour]) {
                        aggregatedCalls[hour] = 0;
                      }
                      aggregatedCalls[hour] += count;
                    }
                  });
                });

                // Update response with aggregated data
                response.forEach((entry) => {
                  if (aggregatedCalls[entry.x]) {
                    entry.y = aggregatedCalls[entry.x];
                  }
                });
              }
            }
          } else {
            return res.status(400).json({ error: "Invalid dateOption" });
          }

          res.json(response);
        } catch (error) {
          console.error("Error fetching stats:", error);
          res.status(500).json({ error: "An error occurred" });
        }
      },
    );
  }
  takeAgentId() {
    this.app.post("/agents-data", async (req: Request, res: Response) => {
      try {
        const { agentIds }: { agentIds: string[] } = req.body;

        if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
          return res.status(400).json({
            error: "agentIds is required and should be a non-empty array",
          });
        }

        // Find users where any agentId matches the provided array
        const usersWithAgents = await userModel
          .find({
            "agents.agentId": { $in: agentIds },
          })
          .select("agents");

        // Extract matching agents for each user
        const result = usersWithAgents.flatMap((user: any) =>
          user.agents.filter((agent: any) => agentIds.includes(agent.agentId)),
        );

        res.json({ result });
      } catch (error) {
        console.error("Error fetching agent data:", error);
        res
          .status(500)
          .json({ error: "An error occurred while fetching agent data" });
      }
    });
  }
 
  
  zap() {
    this.app.post("/zap", async (req, res) => {
      try {
        // Fetch all contacts with a valid referenceToCallId
        const contacts = await contactModel.find({
          agentId: "agent_1852d8aa89c3999f70ecba92b8",
          referenceToCallId: { $ne: null }, // Skip null or undefined referenceToCallId
        });
  
        // Initialize an array to store the mapped leads
        const leads = [];
  
        // Loop through each contact and fetch the corresponding record
        for (const contact of contacts) {
          const record = await recordModel.findOne({ callId: contact.referenceToCallId });
  
          // If the record exists and has the desired sentiment, map the data
          if (record && record.sentiment === "scheduled") {
            leads.push({
              firstname: contact.firstname || "",
              lastname: contact.lastname || "",
              email: contact.email || "",
              phone: contact.phone || "",
              AI_Voice_Agent: {
                call_recording_url: record.recordingUrl || "",
                status: record.status || "",
                transcript: record.transcript || "",
                duration: record.duration || "",
                timestamp: record.starttimestamp || "",
              },
            });
          }
        }
  
        // Prepare the response data
        const data = { leads };
  
        // Send the response
        res.status(200).json(data);
      } catch (error) {
        console.error("Error: ", error);
        res.status(500).send("An error occurred while processing your request.");
      }
    });
  }
  
}
