"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
process.env.TZ = "America/Los_Angeles";
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const cors_1 = __importDefault(require("cors"));
const date_fns_tz_1 = require("date-fns-tz");
const express_1 = __importDefault(require("express"));
const express_ws_1 = __importDefault(require("express-ws"));
const retell_sdk_1 = require("retell-sdk");
const csv_writer_1 = require("csv-writer");
const contact_controller_1 = require("./controllers/contact_controller");
const csv_parser_1 = __importDefault(require("csv-parser"));
const contact_model_1 = require("./models/contact_model");
const axios_1 = __importDefault(require("axios"));
const argon2_1 = __importDefault(require("argon2"));
// import { TwilioClient } from "./twilio_api";
const types_1 = require("./utils/types");
const types_2 = require("./utils/types");
const Papa = __importStar(require("papaparse"));
const date_fns_1 = require("date-fns");
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const node_schedule_1 = __importDefault(require("node-schedule"));
const path_1 = __importDefault(require("path"));
const logModel_1 = require("./models/logModel");
const adminExportToCsv_1 = require("./controllers/adminExportToCsv");
const statsToCsv_1 = require("./controllers/statsToCsv");
const scheduleJob_1 = require("./controllers/scheduleJob");
const openai_1 = __importDefault(require("openai"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userModel_1 = require("./models/userModel");
const protect_1 = __importDefault(require("./middleware/protect"));
const isAdmin_1 = require("./middleware/isAdmin");
const zoom_1 = require("./utils/zoom");
const historyModel_1 = __importDefault(require("./models/historyModel"));
const formatter_1 = require("./utils/formatter");
const llm_fuctions_1 = require("./LLM/llm-fuctions");
const graphModel_1 = require("./models/graphModel");
const graphController_1 = require("./controllers/graphController");
const luxon_1 = require("luxon");
const transcript_review_1 = require("./utils/transcript-review");
const script_1 = require("./utils/script");
const handler_1 = __importDefault(require("./middleware/handler"));
const routes_1 = __importDefault(require("./routes"));
const recordModel_1 = require("./models/recordModel");
const eodScheduler_1 = require("./utils/eodScheduler");
const jobRecovery_1 = require("./utils/jobRecovery");
(0, contact_model_1.connectDb)();
(0, eodScheduler_1.DailyReport)();
(0, eodScheduler_1.WeeklyReport)();
(0, jobRecovery_1.restartScheduledJobs)();
// const smee = new SmeeClient({
//   source: process.env.SMEE_URL,
//   target: "https://api.intuitiveagents.ai/webhook",
//   logger: console,
// });
// smee.start();
// redisConnection();
class Server {
    constructor() {
        this.storage = multer_1.default.diskStorage({
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
        this.upload = (0, multer_1.default)({ storage: this.storage });
        this.app = (0, express_ws_1.default)((0, express_1.default)()).app;
        this.app.use(express_1.default.json());
        this.app.use((0, cors_1.default)({
            origin: "*",
        }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
        this.client = new openai_1.default({
            apiKey: process.env.OPENAI_APIKEY,
        });
        this.app.get("/", (req, res) => {
            res.send("Hello World");
        });
        this.app.use(handler_1.default.setupRequest);
        this.app.use(routes_1.default);
        this.app.use(handler_1.default.processResponse);
        this.app.use(handler_1.default.handle404);
        this.app.use(handler_1.default.handleError);
        this.updateAgent();
        this.getFullStat();
        // this.handleRetellLlmWebSocket();
        this.getAllDbTags();
        this.takeAgentId();
        this.handleContactSaving();
        this.zap();
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
        this.retellClient = new retell_sdk_1.Retell({
            apiKey: process.env.RETELL_API_KEY,
        });
        // this.twilioClient = new TwilioClient(this.retellClient);
        // this.twilioClient.ListenTwilioVoiceWebhook(this.app);
    }
    listen(port) {
        this.app.listen(port);
        console.log("Listening on " + port);
    }
    createPhoneCall2() {
        this.app.post("/create-llm-phone-call", async (req, res) => {
            const { fromNumber, toNumber, userId, agentId, address } = req.body;
            const result = await contact_model_1.contactModel.findById(userId);
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
                const registerCallResponse2 = await this.retellClient.call.createPhoneCall({
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
                await contact_model_1.contactModel.findByIdAndUpdate(userId, {
                    callId: registerCallResponse2.call_id,
                    isusercalled: true,
                });
                res.send({ callCreation: registerCallResponse2, callRegister });
            }
            catch (error) {
                console.log("This is the error:", error);
            }
        });
    }
    handleContactSaving() {
        this.app.post("/users/create", protect_1.default, isAdmin_1.isAdmin, async (req, res) => {
            const { firstname, lastname, email, phone, agentId, tag, dayToBeProcessed, address, } = req.body;
            const lowerCaseTags = typeof tag === "string" ? tag.toLowerCase() : "";
            try {
                const result = await (0, contact_controller_1.createContact)(firstname, lastname, email, phone, agentId, lowerCaseTags, dayToBeProcessed, address);
                res.json({ result });
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    handlecontactGet() {
        this.app.post("/users/:agentId", async (req, res) => {
            const agentId = req.params.agentId;
            const { page, limit, dateOption, jobId } = req.body;
            const newPage = parseInt(page);
            const newLimit = parseInt(limit);
            // Validate dateOption
            let validDateOption;
            // Validate dateOption
            if (dateOption) {
                if (!Object.values(types_1.DateOption).includes(dateOption)) {
                    return res.status(400).json({ error: "Invalid date option" });
                }
                validDateOption = dateOption;
            }
            else {
                validDateOption = types_1.DateOption.LAST_SCHEDULE;
            }
            try {
                const result = await (0, contact_controller_1.getAllContact)(agentId, newPage, newLimit, jobId, validDateOption);
                res.json({ result });
            }
            catch (error) {
                console.log(error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
    handlecontactDelete() {
        this.app.patch("/users/delete", isAdmin_1.isAdmin, protect_1.default, async (req, res) => {
            const { id } = req.body;
            try {
                const result = await (0, contact_controller_1.deleteOneContact)(id);
                res.json({ result });
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    handleContactUpdate() {
        this.app.patch("/users/update", isAdmin_1.isAdmin, protect_1.default, async (req, res) => {
            try {
                const { id, fields } = req.body;
                if (!fields) {
                    return res
                        .status(400)
                        .json({ error: "No fields to update provided." });
                }
                const result = await (0, contact_controller_1.updateOneContact)(id, fields);
                res.json({ result });
            }
            catch (error) {
                console.log(error);
                res
                    .status(500)
                    .json({ error: "An error occurred while updating contact." });
            }
        });
    }
    uploadcsvToDb() {
        this.app.post("/upload/:agentId", this.upload.single("csvFile"), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ message: "No file uploaded" });
                }
                const csvFile = req.file;
                const tag = req.query.tag;
                const lowerCaseTag = typeof tag === "string" ? tag.toLowerCase() : "";
                const csvData = fs_1.default.readFileSync(csvFile.path, "utf8");
                Papa.parse(csvData, {
                    header: true,
                    complete: async (results) => {
                        const jsonArrayObj = results.data;
                        const headers = results.meta.fields.map((header) => header.trim());
                        const requiredHeaders = [
                            "firstname",
                            "lastname",
                            "phone",
                            "email",
                        ];
                        const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
                        if (missingHeaders.length > 0) {
                            return res.status(400).json({
                                message: `CSV must contain the following headers: ${missingHeaders.join(", ")}`,
                            });
                        }
                        const agentId = req.params.agentId;
                        console.log("agentId:", agentId);
                        const uniqueRecordsMap = new Map();
                        const duplicateKeys = new Set();
                        const failedContacts = [];
                        // Process each user from the CSV
                        for (const user of jsonArrayObj) {
                            if (user.firstname && user.phone) {
                                const formattedPhone = (0, formatter_1.formatPhoneNumber)(user.phone);
                                user.phone = formattedPhone;
                                if (uniqueRecordsMap.has(formattedPhone)) {
                                    duplicateKeys.add(formattedPhone);
                                    failedContacts.push({ user, reason: "duplicate" });
                                }
                                else {
                                    uniqueRecordsMap.set(formattedPhone, user);
                                }
                            }
                            else {
                                failedContacts.push({
                                    user,
                                    reason: "missing required fields",
                                });
                            }
                        }
                        const uniqueUsersToInsert = Array.from(uniqueRecordsMap.values()).filter((user) => !duplicateKeys.has(user.phone));
                        const dncList = [""];
                        // Check against the DNC list and prepare users for insertion
                        const usersWithAgentId = uniqueUsersToInsert.map((user) => (Object.assign(Object.assign({}, user), { agentId: agentId, tag, address: user.address || "", isOnDNCList: dncList.includes(user.phone) })));
                        // Batch query to find existing users
                        const phoneNumbersToCheck = usersWithAgentId.map((user) => user.phone);
                        const existingUsers = await contact_model_1.contactModel.find({
                            isDeleted: false,
                            phone: { $in: phoneNumbersToCheck },
                        });
                        const dbDuplicates = existingUsers;
                        const existingPhoneNumbers = new Set(existingUsers.map((user) => user.phone));
                        const finalUsersToInsert = usersWithAgentId.filter((user) => !existingPhoneNumbers.has(user.phone) && user.phone);
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
                            await contact_model_1.contactModel.bulkWrite(finalUsersToInsert.map((user) => ({
                                insertOne: { document: user },
                            })));
                            await userModel_1.userModel.updateOne({ "agents.agentId": agentId }, { $addToSet: { "agents.$.tag": lowerCaseTag } });
                        }
                        else {
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
                    error: async (err) => {
                        console.error("Error parsing CSV:", err);
                        res.status(500).json({ message: "Failed to parse CSV data" });
                    },
                });
            }
            catch (err) {
                console.error("Error:", err);
                res
                    .status(500)
                    .json({ message: "Failed to upload CSV data to database" });
            }
        });
    }
    getjobstatus() {
        this.app.post("/schedules/status", protect_1.default, async (req, res) => {
            const { jobId } = req.body;
            const result = await contact_model_1.jobModel.findOne({ jobId });
            res.json({ result });
        });
    }
    getAllJobSchedule() {
        this.app.get("/schedules/get", protect_1.default, isAdmin_1.isAdmin, async (req, res) => {
            const result = await contact_model_1.jobModel.find().sort({ createdAt: "desc" });
            res.json({ result });
        });
    }
    resetAgentStatus() {
        this.app.post("/users/status/reset", async (req, res) => {
            const { agentId, tag } = req.body;
            const query = {
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
                $ne: types_2.callstatusenum.SCHEDULED,
            };
            const result = await contact_model_1.contactModel.updateMany(query, {
                dial_status: types_2.callstatusenum.NOT_CALLED,
                answeredByVM: false,
                isusercalled: false,
                timesCalled: "",
                // callId: "",
                isTaken: false,
                referenceToCallId: null,
                linktocallLogModel: null,
                datesCalled: [],
                dayToBeProcessed: "",
                jobProcessedWithId: [],
                isOnDNCList: false,
                calledTimes: 0
            });
            res.json({ result });
        });
    }
    schedulemycall() {
        this.app.post("/schedule", async (req, res) => {
            const { hour, minute, agentId, limit, fromNumber, tag, address } = req.body;
            const scheduledTimePST = moment_timezone_1.default
                .tz("America/Los_Angeles")
                .set({
                hour,
                minute,
                second: 0,
                millisecond: 0,
            })
                .toDate();
            const formattedDate = (0, moment_timezone_1.default)(scheduledTimePST).format("YYYY-MM-DDTHH:mm:ss");
            if (!tag) {
                return res.send("Please provide a tag");
            }
            const lowerCaseTag = tag.toLowerCase();
            const { jobId, scheduledTime, contacts } = await (0, scheduleJob_1.scheduleCronJob)(scheduledTimePST, agentId, limit, fromNumber, formattedDate, lowerCaseTag, address);
            res.send({ jobId, scheduledTime, contacts });
        });
    }
    stopSpecificJob() {
        this.app.post("/stop-job", protect_1.default, isAdmin_1.isAdmin, async (req, res) => {
            try {
                const { jobId } = req.body;
                if (!jobId) {
                    console.log("No jobId provided.");
                    return res.status(400).send("No jobId provided.");
                }
                const job = await contact_model_1.jobModel.findOneAndUpdate({ jobId }, {
                    shouldContinueProcessing: false,
                    callstatus: types_2.jobstatus.CANCELLED,
                });
                if (!job) {
                    console.log("No job found with the provided jobId:", jobId);
                    return res
                        .status(404)
                        .send("No job found with the provided jobId.");
                }
                console.log(`Processing stopped for job ${jobId}.`);
                return res.send("Processing stopped for job.");
            }
            catch (error) {
                console.error("Error stopping job:", error);
                return res
                    .status(500)
                    .send("Error stopping job: " + (error.message || error));
            }
        });
    }
    stopSpecificSchedule() {
        this.app.post("/cancel-schedule", isAdmin_1.isAdmin, protect_1.default, async (req, res) => {
            const { jobId } = req.body;
            const scheduledJobs = node_schedule_1.default.scheduledJobs;
            if (!jobId) {
                return res.status(404).send(`Please provide an ID`);
            }
            // Check if the specified job exists
            if (!scheduledJobs.hasOwnProperty(jobId)) {
                return res.status(404).send(`Job with ID ${jobId} not found.`);
            }
            const isCancelled = node_schedule_1.default.cancelJob(jobId);
            if (isCancelled) {
                await contact_model_1.jobModel.findOneAndUpdate({ jobId }, {
                    callstatus: types_2.jobstatus.CANCELLED,
                    shouldContinueProcessing: false,
                });
                res.send(`Job with ID ${jobId} cancelled successfully.`);
            }
            else {
                res.status(500).send(`Failed to cancel job with ID ${jobId}.`);
            }
        });
    }
    getAllJob() {
        this.app.get("/get-jobs", protect_1.default, async (req, res) => {
            const scheduledJobs = node_schedule_1.default.scheduledJobs;
            let responseString = "";
            for (const jobId in scheduledJobs) {
                if (scheduledJobs.hasOwnProperty(jobId)) {
                    const job = scheduledJobs[jobId];
                    responseString += `Job ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n`;
                }
            }
            res.send({ responseString });
        });
    }
    getCallLogs() {
        this.app.post("/call-logs", protect_1.default, async (req, res) => {
            const { agentId } = req.body;
            const result = await contact_model_1.jobModel.find({ agentId });
            res.json({ result });
        });
    }
    async getTranscriptAfterCallEnded() {
        this.app.post("/webhook", async (request, response) => {
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
                }
                else if (payload.event === "call_ended") {
                    await this.handleCallEnded(payload, todayString, todayStringWithTime, time);
                }
                else if (payload.event === "call_analyzed") {
                    await this.handleCallAnalyzed(payload);
                }
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    async handleCallStarted(data) {
        try {
            const { call_id, agent_id } = data;
            await contact_model_1.contactModel.findOneAndUpdate({ callId: call_id, agentId: agent_id }, { dial_status: types_2.callstatusenum.IN_PROGRESS });
        }
        catch (error) {
            console.error("Error in handleCallStarted:", error);
        }
    }
    async handleCallEnded(payload, todayString, todaysDateForDatesCalled, time) {
        try {
            const { call_id, agent_id, disconnection_reason, start_timestamp, end_timestamp, transcript, recording_url, public_log_url, cost_metadata, call_cost, call_analysis, retell_llm_dynamic_variables, from_number, to_number, direction, } = payload.data;
            let analyzedTranscriptForStatus;
            let callStatus;
            let sentimentStatus;
            let statsUpdate = { $inc: {} };
            //console.log("here")
            console.log({
                firstname: payload.retell_llm_dynamic_variables.user_firstname,
            });
            function convertMsToHourMinSec(ms) {
                const totalSeconds = Math.floor(ms / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            if (payload.event === "call_ended") {
                let agentNameEnum;
                if (agent_id === "agent_1852d8aa89c3999f70ecba92b8") {
                    agentNameEnum = "ARS";
                }
                else if (agent_id === "agent_6beffabb9adf0ef5bbab8e0bb2") {
                    agentNameEnum = "LQR";
                }
                else if (agent_id === "agent_155d747175559aa33eee83a976") {
                    agentNameEnum = "SDR";
                }
                else if (agent_id === "214e92da684138edf44368d371da764c") {
                    agentNameEnum = "TVAG";
                }
                const isCallFailed = disconnection_reason === "dial_failed";
                const isCallTransferred = disconnection_reason === "call_transfer";
                // const isMachine = disconnection_reason === "voicemail_reached";
                const isDialNoAnswer = disconnection_reason === "dial_no_answer";
                const isCallInactivity = disconnection_reason === "inactivity";
                const isCallAnswered = disconnection_reason === "user_hangup" ||
                    disconnection_reason === "agent_hangup";
                analyzedTranscriptForStatus = await (0, transcript_review_1.reviewTranscript)(transcript);
                const isCallScheduled = analyzedTranscriptForStatus.message.content === "scheduled";
                const isMachine = analyzedTranscriptForStatus.message.content === "voicemail";
                const isIVR = analyzedTranscriptForStatus.message.content === "ivr";
                const callbackdate = await (0, transcript_review_1.reviewCallback)(transcript);
                const newDuration = convertMsToHourMinSec(payload.call.duration_ms);
                const callEndedUpdateData = Object.assign({ callId: call_id, agentId: payload.call.agent_id, recordingUrl: recording_url, callDuration: newDuration, disconnectionReason: disconnection_reason, callBackDate: callbackdate, retellCallStatus: payload.data.call_status, agentName: agentNameEnum, duration: convertMsToHourMinSec(end_timestamp - start_timestamp) || 0, timestamp: end_timestamp }, (transcript && { transcript }));
                const results = await contact_model_1.EventModel.findOneAndUpdate({ callId: call_id, agentId: payload.call.agent_id }, { $set: callEndedUpdateData }, { upsert: true, returnOriginal: false });
                statsUpdate.$inc.totalCalls = 1;
                statsUpdate.$inc.totalCallDuration = payload.call.duration_ms;
                if (isMachine) {
                    statsUpdate.$inc.totalAnsweredByVm = 1;
                    callStatus = types_2.callstatusenum.VOICEMAIL;
                }
                else if (isIVR) {
                    statsUpdate.$inc.totalAnsweredByIVR = 1;
                    callStatus = types_2.callstatusenum.IVR;
                }
                else if (isCallScheduled) {
                    statsUpdate.$inc.totalAppointment = 1;
                    callStatus = types_2.callstatusenum.SCHEDULED;
                }
                else if (isCallFailed) {
                    statsUpdate.$inc.totalFailed = 1;
                    callStatus = types_2.callstatusenum.FAILED;
                }
                else if (isCallTransferred) {
                    statsUpdate.$inc.totalTransffered = 1;
                    callStatus = types_2.callstatusenum.TRANSFERRED;
                }
                else if (isDialNoAnswer) {
                    statsUpdate.$inc.totalDialNoAnswer = 1;
                    callStatus = types_2.callstatusenum.NO_ANSWER;
                }
                else if (isCallInactivity) {
                    statsUpdate.$inc.totalCallInactivity = 1;
                    callStatus = types_2.callstatusenum.INACTIVITY;
                }
                else if (isCallAnswered) {
                    statsUpdate.$inc.totalCallAnswered = 1;
                    callStatus = types_2.callstatusenum.CALLED;
                }
                const callData = {
                    callId: call_id,
                    agentId: agent_id,
                    userFirstname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_firstname) || null,
                    userLastname: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_lastname) || null,
                    userEmail: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_email) || null,
                    recordingUrl: recording_url || null,
                    disconnectionReason: disconnection_reason || null,
                    callStatus: payload.data.call_status,
                    startTimestamp: start_timestamp || null,
                    endTimestamp: end_timestamp || null,
                    durationMs: convertMsToHourMinSec(end_timestamp - start_timestamp) || 0,
                    transcript: transcript || null,
                    transcriptObject: payload.data.transcript_object || [],
                    transcriptWithToolCalls: payload.data.transcript_with_tool_calls || [],
                    publicLogUrl: public_log_url || null,
                    callType: payload.data.call_type || null,
                    customAnalysisData: payload.event === "call_analyzed" ? call_analysis : null,
                    fromNumber: from_number || null,
                    toNumber: to_number || null,
                    direction: direction || null,
                    agentName: agentNameEnum,
                    date: todayString,
                    address: (retell_llm_dynamic_variables === null || retell_llm_dynamic_variables === void 0 ? void 0 : retell_llm_dynamic_variables.user_address) || null,
                    dial_status: callStatus,
                };
                await historyModel_1.default.findOneAndUpdate({ callId: call_id, agentId: agent_id }, { $set: callData }, { upsert: true, returnOriginal: false });
                const jobidfromretell = retell_llm_dynamic_variables.job_id
                    ? retell_llm_dynamic_variables.job_id
                    : null;
                // const resultforcheck = await contactModel.findOne({callId: payload.call.call_id, agentId: payload.call.agent_id})
                let statsResults;
                // if(resultforcheck.calledTimes < 0){
                statsResults = await logModel_1.DailyStatsModel.findOneAndUpdate({
                    day: todayString,
                    agentId: agent_id,
                    jobProcessedBy: jobidfromretell,
                }, statsUpdate, { upsert: true, returnOriginal: false });
                const timestamp = new Date();
                await (0, graphController_1.updateStatsByHour)(agent_id, todayString, timestamp);
                // }
                //const linkToCallLogModelId = statsResults ? statsResults._id : null;
                const updateData = {
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
                const resultForUserUpdate = await contact_model_1.contactModel.findOneAndUpdate({ callId: call_id, agentId: payload.call.agent_id }, updateData);
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
        }
        catch (error) {
            console.error("Error in handleCallAnalyyzedOrEnded:", error);
        }
    }
    async handleCallAnalyzed(payload) {
        var _a;
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
            analyzedTranscriptForSentiment = await (0, transcript_review_1.reviewTranscript)(payload.data.transcript);
            const isScheduled = analyzedTranscriptForSentiment.message.content === "scheduled";
            const isDNC = analyzedTranscriptForSentiment.message.content === "dnc";
            const isCall_Back = analyzedTranscriptForSentiment.message.content === "call-back";
            const isNeutral = payload.data.call_analysis.user_sentiment === "Neutral";
            const isUnknown = payload.data.call_analysis.user_sentiment === "Unknown";
            const isPositive = payload.data.call_analysis.user_sentiment === "Positive";
            const isNegative = payload.data.call_analysis.user_sentiment === "Negative";
            let addressStat;
            if (payload.call.agent_id === "" || payload.call.agent_id === "") {
                addressStat = payload.data.call_analysis.address;
            }
            if (isScheduled) {
                sentimentStatus = types_1.callSentimentenum.SCHEDULED;
            }
            else if (isCall_Back) {
                sentimentStatus = types_1.callSentimentenum.CALLBACK;
            }
            else if (isDNC) {
                sentimentStatus = types_1.callSentimentenum.DNC;
            }
            else if (isNeutral) {
                sentimentStatus = types_1.callSentimentenum.NEUTRAL;
            }
            else if (isPositive) {
                sentimentStatus = types_1.callSentimentenum.POSITIVE;
            }
            else if (isNegative) {
                sentimentStatus = types_1.callSentimentenum.NEGATIVE;
            }
            else if (isUnknown) {
                sentimentStatus = types_1.callSentimentenum.UNKNOWN;
            }
            const data = {
                retellCallSummary: payload.data.call_analysis.call_summary,
                analyzedTranscript: sentimentStatus,
                userSentiment: sentimentStatus,
            };
            const results = await contact_model_1.EventModel.findOneAndUpdate({ callId: payload.call.call_id, agentId: payload.call.agent_id }, { $set: data }, { upsert: true, returnOriginal: false });
            //const analyzedTranscript = await reviewTranscript(payload.data.transcript);
            const data2 = {
                callSummary: payload.data.call_analysis.call_summary,
                userSentiment: sentimentStatus,
            };
            await historyModel_1.default.findOneAndUpdate({ callId: payload.call.call_id, agentId: payload.call.agent_id }, { $set: data2 }, { upsert: true, returnOriginal: false });
            try {
                const result = await contact_model_1.contactModel.findOne({
                    callId: payload.call.call_id,
                    agentId: payload.call.agent_id,
                });
                if (payload.data.call_analysis.call_successful === false &&
                    analyzedTranscriptForSentiment.message.content === "interested") {
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
                    const result = await axios_1.default.post(process.env.MAKE_URL, {
                        firstname: payload.data.retell_llm_dynamic_variables.user_firstname,
                        lastname: payload.data.retell_llm_dynamic_variables.user_lastname,
                        email: payload.data.retell_llm_dynamic_variables.user_email,
                        phone: payload.call.to_number,
                        summary: payload.data.call_analysis.call_summary,
                        url: ((_a = payload.data) === null || _a === void 0 ? void 0 : _a.recording_url) || null,
                        transcript: payload.data.transcript,
                    });
                }
            }
            catch (error) {
                console.log("errror recalling", error);
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    deleteAll() {
        this.app.patch("/deleteAll", isAdmin_1.isAdmin, protect_1.default, async (req, res) => {
            const { agentId } = req.body;
            const result = await contact_model_1.contactModel.updateMany({ agentId }, { isDeleted: true });
            res.send(result);
        });
    }
    adminSideLogsToCsv() {
        this.app.post("/call-logs-csv", async (req, res) => {
            try {
                const { agentId, startDate, endDate, limit, statusOption, sentimentOption, dateOption, tag, } = req.body;
                const newlimit = parseInt(limit);
                console.log(sentimentOption, "second");
                const result = await (0, adminExportToCsv_1.logsToCsv)(agentId, newlimit, startDate, endDate, statusOption, sentimentOption, dateOption, tag);
                if (typeof result === "object" && result.error) {
                    console.error(`Error retrieving contacts: ${result.error}`);
                    return res.status(result.status || 500).send({ error: result.error });
                }
                if (typeof result === "string") {
                    const filePath = result;
                    if (fs_1.default.existsSync(filePath)) {
                        res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
                        res.setHeader("Content-Type", "text/csv");
                        const fileStream = fs_1.default.createReadStream(filePath);
                        fileStream.pipe(res);
                    }
                    else {
                        console.error("CSV file does not exist");
                        return res.status(404).send("CSV file not found");
                    }
                }
                else {
                    console.error(`Unexpected result from logsToCsv: ${result}`);
                    return res.status(500).send("Unexpected error retrieving contacts.");
                }
            }
            catch (error) {
                console.error(`Error retrieving contacts: ${error}`);
                return res.status(500).send(`Error retrieving contacts: ${error}`);
            }
        });
    }
    statsForAgent() {
        this.app.post("/get-stats", async (req, res) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const { agentIds, limit, page, startDate, endDate } = req.body;
            let dateOption;
            dateOption = req.body.dateOption;
            try {
                let dateFilter = {};
                let dateFilter1 = {};
                const skip = (page - 1) * limit;
                const timeZone = "America/Los_Angeles";
                const now = new Date();
                const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
                const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
                switch (dateOption) {
                    case types_1.DateOption.Today:
                        dateFilter = { datesCalled: today };
                        dateFilter1 = { day: today };
                        break;
                    case types_1.DateOption.Yesterday:
                        const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                        const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", {
                            timeZone,
                        });
                        dateFilter = { datesCalled: yesterday };
                        dateFilter1 = { day: yesterday };
                        break;
                    case types_1.DateOption.ThisWeek:
                        const weekdays = [];
                        for (let i = 0; i < 7; i++) {
                            const day = (0, date_fns_1.subDays)(zonedNow, i);
                            const dayOfWeek = day.getDay();
                            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                            }
                        }
                        console.log(weekdays);
                        dateFilter = { datesCalled: { $in: weekdays } };
                        dateFilter1 = { day: { $in: weekdays } };
                        break;
                    case types_1.DateOption.ThisMonth:
                        const monthDates = [];
                        for (let i = 0; i < now.getDate(); i++) {
                            const day = (0, date_fns_1.subDays)(now, i);
                            monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                        }
                        dateFilter = { datesCalled: { $in: monthDates } };
                        dateFilter1 = { day: { $in: monthDates } };
                        break;
                    case types_1.DateOption.Total:
                        dateFilter = {};
                        dateFilter1 = {};
                        break;
                    default:
                        const recentJob = await contact_model_1.jobModel
                            .findOne({ agentId: { $in: agentIds } })
                            .sort({ createdAt: -1 })
                            .lean();
                        if (!recentJob) {
                            dateFilter = {};
                            dateFilter1 = {};
                        }
                        else {
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
                const foundContacts = await contact_model_1.contactModel
                    .find(Object.assign({ agentId: { $in: agentIds }, isDeleted: false }, dateFilter))
                    .sort({ createdAt: "desc" })
                    .populate("referenceToCallId")
                    .limit(limit)
                    .skip(skip);
                const totalContactForAgent = await contact_model_1.contactModel.countDocuments({
                    agentId: { $in: agentIds },
                    isDeleted: false,
                });
                const totalCount = await contact_model_1.contactModel.countDocuments({
                    agentId: { $in: agentIds },
                    isDeleted: { $ne: true },
                });
                const totalNotCalledForAgent = await contact_model_1.contactModel.countDocuments({
                    agentId: { $in: agentIds },
                    isDeleted: false,
                    dial_status: types_2.callstatusenum.NOT_CALLED,
                });
                const totalAnsweredCalls = await contact_model_1.contactModel.countDocuments(Object.assign({ agentId: { $in: agentIds }, isDeleted: false, dial_statusstatus: types_2.callstatusenum.CALLED }, dateFilter));
                const stats = await logModel_1.DailyStatsModel.aggregate([
                    { $match: Object.assign({ agentId: { $in: agentIds } }, dateFilter1) },
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
                const statsWithTranscripts = await Promise.all(foundContacts.map(async (stat) => {
                    var _a, _b;
                    const transcript = (_a = stat.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript;
                    const analyzedTranscript = (_b = stat.referenceToCallId) === null || _b === void 0 ? void 0 : _b.analyzedTranscript;
                    return Object.assign(Object.assign({}, stat.toObject()), { originalTranscript: transcript, analyzedTranscript });
                }));
                function convertMsToHourMinSec(ms) {
                    const totalSeconds = Math.floor(ms / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                }
                const combinedCallDuration = convertMsToHourMinSec(((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.totalCallDuration) || 0);
                res.json({
                    totalContactForAgent,
                    totalAnsweredCalls,
                    totalAnsweredByVm: ((_b = stats[0]) === null || _b === void 0 ? void 0 : _b.totalAnsweredByVm) || 0,
                    totalAppointment: ((_c = stats[0]) === null || _c === void 0 ? void 0 : _c.totalAppointment) || 0,
                    totalCallsTransffered: ((_d = stats[0]) === null || _d === void 0 ? void 0 : _d.totalCallsTransffered) || 0,
                    totalNotCalledForAgent,
                    totalCalls: ((_e = stats[0]) === null || _e === void 0 ? void 0 : _e.totalCalls) || 0,
                    totalFailedCalls: ((_f = stats[0]) === null || _f === void 0 ? void 0 : _f.totalFailedCalls) || 0,
                    totalAnsweredByIVR: ((_g = stats[0]) === null || _g === void 0 ? void 0 : _g.totalAnsweredByIVR) || 0,
                    totalDialNoAnswer: ((_h = stats[0]) === null || _h === void 0 ? void 0 : _h.totalDialNoAnswer) || 0,
                    totalCallInactivity: ((_j = stats[0]) === null || _j === void 0 ? void 0 : _j.totalCallInactivity) || 0,
                    callDuration: combinedCallDuration,
                    totalPages,
                    contacts: statsWithTranscripts,
                });
            }
            catch (error) {
                console.error("Error fetching all contacts:", error);
                return "error getting contact";
            }
        });
    }
    clientSideToCsv() {
        this.app.post("/get-metadata-csv", protect_1.default, async (req, res) => {
            try {
                const { startDate, endDate, agentIds } = req.body;
                const result = await (0, statsToCsv_1.statsToCsv)(startDate, endDate, agentIds);
                if (typeof result === "string") {
                    const filePath = result;
                    if (fs_1.default.existsSync(filePath)) {
                        res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
                        res.setHeader("Content-Type", "text/csv");
                        const fileStream = fs_1.default.createReadStream(filePath);
                        fileStream.pipe(res);
                    }
                    else {
                        console.error("CSV file does not exist");
                        res.status(404).send("CSV file not found");
                    }
                }
                else {
                    console.error(`Error retrieving contacts: ${result}`);
                    res.status(500).send(`Error retrieving contacts: ${result}`);
                }
            }
            catch (error) {
                console.error(error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    searchForClient() {
        this.app.post("/search-client", async (req, res) => {
            const { searchTerm = "", startDate, endDate, statusOption, sentimentOption, agentIds, tag, dateOption, page = 1, limit = 100, } = req.body;
            console.log("req.body is: ", req.body);
            if (!agentIds) {
                return res
                    .status(400)
                    .json({ error: "Agent IDs is required for the search." });
            }
            try {
                const isValidEmail = (email) => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return emailRegex.test(email.trim());
                };
                const formatDateToDB = (dateString) => {
                    const date = new Date(dateString);
                    const year = date.getUTCFullYear();
                    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
                    const day = String(date.getUTCDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                };
                const escapeRegex = (text) => {
                    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                };
                // const searchTerms = searchTerm
                //   .split(",")
                //   .map((term: string) => term.trim())
                //   .filter((term: any) => term.length > 0);
                const searchTerms = searchTerm
                    .split(",")
                    .map((term) => term.trim())
                    .filter((term) => term.length > 0)
                    .map(escapeRegex); // Escape special characters`
                const query = {
                    agentId: { $in: agentIds },
                    isDeleted: false,
                };
                if (searchTerms.length > 0) {
                    query.$or = searchTerms.flatMap((term) => [
                        { firstname: { $regex: term, $options: "i" } },
                        { lastname: { $regex: term, $options: "i" } },
                        { phone: { $regex: term, $options: "i" } },
                        { email: { $regex: term, $options: "i" } },
                    ]);
                }
                let statusOptions;
                if (statusOption === "called") {
                    statusOptions = types_2.callstatusenum.CALLED;
                }
                else if (statusOption === "not-called") {
                    statusOptions = types_2.callstatusenum.NOT_CALLED;
                }
                else if (statusOption === "voicemail") {
                    statusOptions = types_2.callstatusenum.VOICEMAIL;
                }
                else if (statusOption === "failed") {
                    statusOptions = types_2.callstatusenum.FAILED;
                }
                else if (statusOption === "transffered") {
                    statusOptions = types_2.callstatusenum.TRANSFERRED;
                }
                else if (statusOption === "scheduled") {
                    statusOptions = types_2.callstatusenum.SCHEDULED;
                }
                else if (statusOption === "ivr") {
                    statusOptions = types_2.callstatusenum.IVR;
                }
                else if (statusOption === "inactivity") {
                    statusOptions = types_2.callstatusenum.INACTIVITY;
                }
                if (statusOption) {
                    query.dial_status = statusOptions;
                }
                if (tag) {
                    query["tag"] = tag.toLowerCase();
                }
                const sentimentMapping = {
                    negative: types_1.callSentimentenum.NEGATIVE,
                    "call-back": types_1.callSentimentenum.CALLBACK,
                    positive: types_1.callSentimentenum.POSITIVE,
                    scheduled: types_1.callSentimentenum.SCHEDULED,
                    neutral: types_1.callSentimentenum.NEUTRAL,
                    unknown: types_1.callSentimentenum.UNKNOWN,
                    dnc: types_1.callSentimentenum.DNC,
                };
                const sentimentStatus = sentimentOption
                    ? sentimentMapping[sentimentOption.toLowerCase()]
                    : undefined;
                let results = [];
                let totalRecords = 0;
                let totalPages = 0;
                const timeZone = "America/Los_Angeles"; // PST time zone
                const now = new Date();
                const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
                const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
                let dateFilter = {};
                let dateFilter1 = {};
                console.log("hello  there");
                console.log("this is ", dateOption);
                if (dateOption) {
                    switch (dateOption) {
                        case types_1.DateOption.Today:
                            query["datesCalled"] = today;
                            break;
                        case types_1.DateOption.Yesterday:
                            const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                            const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", {
                                timeZone,
                            });
                            query["datesCalled"] = yesterday;
                            break;
                        case types_1.DateOption.ThisWeek:
                            const weekdays = [];
                            for (let i = 0; i < 7; i++) {
                                const day = (0, date_fns_1.subDays)(zonedNow, i);
                                const dayOfWeek = day.getDay();
                                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                    weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                                }
                            }
                            query["datesCalled"] = { $in: weekdays };
                            break;
                        case types_1.DateOption.ThisMonth:
                            const monthDates = [];
                            for (let i = 0; i < now.getDate(); i++) {
                                const day = (0, date_fns_1.subDays)(now, i);
                                monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                            }
                            query["datesCalled"] = { $in: monthDates };
                            break;
                        case types_1.DateOption.Total:
                            // Don't filter by dates for "Total"
                            break;
                    }
                }
                else if (startDate || endDate) {
                    query["datesCalled"] = {};
                    if (startDate && endDate) {
                        query["datesCalled"]["$gte"] = formatDateToDB(startDate);
                        query["datesCalled"]["$lte"] = formatDateToDB(endDate);
                    }
                    else if (startDate) {
                        query["datesCalled"]["eq"] = formatDateToDB(startDate);
                    }
                    ;
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
                    results = await contact_model_1.contactModel
                        .find(query)
                        .populate("referenceToCallId");
                    results = results.filter((contact) => {
                        var _a;
                        const analyzedTranscript = (_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.analyzedTranscript;
                        return (sentimentOption.toLowerCase() === "all" ||
                            analyzedTranscript === sentimentStatus);
                    });
                    totalRecords = results.length;
                    totalPages = Math.ceil(totalRecords / limit);
                    const startIndex = (page - 1) * limit;
                    results = results.slice(startIndex, startIndex + limit);
                }
                else {
                    totalRecords = await contact_model_1.contactModel.countDocuments(query);
                    totalPages = Math.ceil(totalRecords / limit);
                    console.log("this is query", query);
                    results = await contact_model_1.contactModel
                        .find(query)
                        .populate("referenceToCallId")
                        .skip((page - 1) * limit)
                        .limit(limit);
                }
                const data = results.map((history) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h;
                    return ({
                        firstName: history.firstname || "",
                        lastName: history.lastname || "",
                        email: history.email || "",
                        phone: history.phone || "",
                        dial_status: history.dial_status || "",
                        agentId: ((_a = history.referenceToCallId) === null || _a === void 0 ? void 0 : _a.agentName) || "",
                        transcript: ((_b = history.referenceToCallId) === null || _b === void 0 ? void 0 : _b.transcript) || "",
                        summary: ((_c = history.referenceToCallId) === null || _c === void 0 ? void 0 : _c.retellCallSummary) || "",
                        sentiment: ((_d = history.referenceToCallId) === null || _d === void 0 ? void 0 : _d.analyzedTranscript) || "",
                        timestamp: ((_e = history.referenceToCallId) === null || _e === void 0 ? void 0 : _e.timestamp) || "",
                        duration: ((_f = history.referenceToCallId) === null || _f === void 0 ? void 0 : _f.duration) || "",
                        status: ((_g = history.referenceToCallId) === null || _g === void 0 ? void 0 : _g.retellCallStatus) || "",
                        recordingUrl: ((_h = history.referenceToCallId) === null || _h === void 0 ? void 0 : _h.recordingUrl) || "",
                        address: history.address || "",
                        callId: history.callId || "",
                    });
                });
                res.json({
                    page,
                    limit,
                    totalRecords,
                    totalPages,
                    results: data,
                });
            }
            catch (error) {
                console.error("Error in searchForAdmin:", error);
                return res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    searchForAdmin() {
        this.app.post("/search", async (req, res) => {
            const { searchTerm = "", startDate, endDate, statusOption, sentimentOption, agentId, tag, page = 1, limit = 100, } = req.body;
            if (!agentId) {
                return res
                    .status(400)
                    .json({ error: "Agent ID is required for the search." });
            }
            try {
                const isValidEmail = (email) => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return emailRegex.test(email.trim());
                };
                const formatDateToDB = (dateString) => {
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
                const query = {
                    agentId,
                    isDeleted: false,
                };
                const escapeRegex = (text) => {
                    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                };
                const searchTerms = searchTerm
                    .split(",")
                    .map((term) => term.trim())
                    .filter((term) => term.length > 0)
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
                    query.$or = searchTerms.flatMap((term) => [
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
                    }
                    else if (startDate && endDate) {
                        query["datesCalled"]["$gte"] = formatDateToDB(startDate);
                        query["datesCalled"]["$lte"] = formatDateToDB(endDate);
                    }
                }
                let statusOptions;
                if (statusOption === "called") {
                    statusOptions = types_2.callstatusenum.CALLED;
                }
                else if (statusOption === "not-called") {
                    statusOptions = types_2.callstatusenum.NOT_CALLED;
                }
                else if (statusOption === "voicemail") {
                    statusOptions = types_2.callstatusenum.VOICEMAIL;
                }
                else if (statusOption === "failed") {
                    statusOptions = types_2.callstatusenum.FAILED;
                }
                else if (statusOption === "transffered") {
                    statusOptions = types_2.callstatusenum.TRANSFERRED;
                }
                else if (statusOption === "scheduled") {
                    statusOptions = types_2.callstatusenum.SCHEDULED;
                }
                else if (statusOption === "ivr") {
                    statusOptions = types_2.callstatusenum.IVR;
                }
                else if (statusOption === "inactivity") {
                    statusOptions = types_2.callstatusenum.INACTIVITY;
                }
                if (statusOption) {
                    query.dial_status = statusOptions;
                }
                if (tag) {
                    query["tag"] = tag.toLowerCase();
                }
                const sentimentMapping = {
                    negative: types_1.callSentimentenum.NEGATIVE,
                    "call-back": types_1.callSentimentenum.CALLBACK,
                    positive: types_1.callSentimentenum.POSITIVE,
                    scheduled: types_1.callSentimentenum.SCHEDULED,
                    neutral: types_1.callSentimentenum.NEUTRAL,
                    unknown: types_1.callSentimentenum.UNKNOWN,
                    dnc: types_1.callSentimentenum.DNC,
                };
                const sentimentStatus = sentimentOption
                    ? sentimentMapping[sentimentOption.toLowerCase()]
                    : undefined;
                let results = [];
                let totalRecords = 0;
                let totalPages = 0;
                if (sentimentOption) {
                    results = await contact_model_1.contactModel
                        .find(query)
                        .populate("referenceToCallId");
                    results = results.filter((contact) => {
                        var _a;
                        const analyzedTranscript = (_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.analyzedTranscript;
                        return (sentimentOption.toLowerCase() === "all" ||
                            analyzedTranscript === sentimentStatus);
                    });
                    totalRecords = results.length;
                    totalPages = Math.ceil(totalRecords / limit);
                    const startIndex = (page - 1) * limit;
                    results = results.slice(startIndex, startIndex + limit);
                }
                else {
                    totalRecords = await contact_model_1.contactModel.countDocuments(query);
                    totalPages = Math.ceil(totalRecords / limit);
                    console.log(query);
                    results = await contact_model_1.contactModel
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
            }
            catch (error) {
                console.error("Error in searchForAdmin:", error);
                return res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    batchDeleteUser() {
        this.app.post("/batch-delete-users", protect_1.default, isAdmin_1.isAdmin, async (req, res) => {
            const { contactsToDelete } = req.body;
            if (!contactsToDelete ||
                !Array.isArray(contactsToDelete) ||
                contactsToDelete.length === 0) {
                return res.status(400).json({
                    error: "Invalid input. An array of contact IDs is required.",
                });
            }
            try {
                const result = await contact_model_1.contactModel.updateMany({ _id: { $in: contactsToDelete } }, { $set: { isDeleted: true } });
                if (result.modifiedCount === 0) {
                    return res
                        .status(200)
                        .json({ message: "No contacts found to update." });
                }
                res.json({ message: "Contacts sucefully deleted.", result });
            }
            catch (error) {
                res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    getNotCalledUsersAndDelete() {
        this.app.post("/delete-uncalled", isAdmin_1.isAdmin, protect_1.default, async (req, res) => {
            try {
                const { agentId } = req.body;
                if (!agentId) {
                    throw new Error("Please provide an agent ID");
                }
                const result = await contact_model_1.contactModel.updateMany({ agentId, dial_status: types_2.callstatusenum.NOT_CALLED }, { isDeleted: true });
                res.json({
                    message: "Deleted All contacts that are not called",
                    result,
                });
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    loginUser() {
        this.app.post("/user/login", async (req, res) => {
            var _a;
            try {
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ message: "Provide the login details" });
                }
                const userInDb = await userModel_1.userModel.findOne({ username }, { loginDetails: 0 });
                if (!userInDb) {
                    return res.status(400).json({ message: "User not found" });
                }
                const verifyPassword = await argon2_1.default.verify(userInDb.passwordHash, password);
                if (!verifyPassword) {
                    // Log unsuccessful login attempt
                    await userModel_1.userModel.updateOne({ username }, {
                        $push: {
                            loginDetails: {
                                ipAddress: req.ip,
                                successful: false,
                            },
                        },
                    });
                    return res.status(400).json({ message: "Incorrect password" });
                }
                // Log successful login attempt
                await userModel_1.userModel.updateOne({ username }, {
                    $push: {
                        loginDetails: {
                            ipAddress: req.ip,
                            successful: true,
                        },
                    },
                });
                let result;
                if (userInDb.isAdmin === true) {
                    const payload = await userModel_1.userModel.aggregate([
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
                }
                else {
                    result = ((_a = userInDb === null || userInDb === void 0 ? void 0 : userInDb.agents) === null || _a === void 0 ? void 0 : _a.map((agent) => agent.agentId)) || [];
                }
                const token = jsonwebtoken_1.default.sign({ userId: userInDb._id, isAdmin: userInDb.isAdmin }, process.env.JWT_SECRET, { expiresIn: "30d" });
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
                    const hello = await axios_1.default.post('https://hook.us1.make.com/upftnnyhgxdefrdmntjpawa9gcrmdbz7', { user });
                    console.log("make data: ", hello.data);
                }
                catch (e) {
                    console.error("Error triggering make url");
                    return res.status(200).json({
                        message: "Login successfult but make trigger failed",
                        user
                    });
                }
                ;
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
                        logo: userInDb.svgUrl || ""
                    },
                });
            }
            catch (error) {
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
        this.app.post("/admin/login", async (req, res) => {
            try {
                const { username, password } = req.body;
                if (!username || !password) {
                    return res.status(400).json({ message: "Provide the login details" });
                }
                const userInDb = await userModel_1.userModel.findOne({ username });
                if (!userInDb) {
                    // Log unsuccessful login attempt
                    await userModel_1.userModel.updateOne({ username }, {
                        $push: {
                            loginDetails: {
                                ipAddress: req.ip,
                                device: "Unknown", // Improve this as needed
                                successful: false,
                            },
                        },
                    });
                    return res.status(400).json({ message: "Invalid login credentials" });
                }
                const verifyPassword = await argon2_1.default.verify(userInDb.passwordHash, password);
                if (!verifyPassword) {
                    // Log unsuccessful login attempt
                    await userModel_1.userModel.updateOne({ username }, {
                        $push: {
                            loginDetails: {
                                ipAddress: req.ip,
                                device: "Unknown", // Improve this as needed
                                successful: false,
                            },
                        },
                    });
                    return res.status(400).json({ message: "Incorrect password" });
                }
                if (userInDb.isAdmin === false) {
                    return res
                        .status(401)
                        .json({ message: "Only admins can access here" });
                }
                // Log successful login attempt
                await userModel_1.userModel.updateOne({ username }, {
                    $push: {
                        loginDetails: {
                            ipAddress: req.ip,
                            device: "Unknown", // Improve this as needed
                            successful: true,
                        },
                    },
                });
                const token = jsonwebtoken_1.default.sign({ userId: userInDb._id, isAdmin: userInDb.isAdmin }, process.env.JWT_SECRET, { expiresIn: "1d" });
                const result = await userModel_1.userModel.aggregate([
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
            }
            catch (error) {
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
        this.app.post("/user/signup", async (req, res) => {
            try {
                const { username, email, password, group, name } = req.body;
                if (!username || !email || !password || !group) {
                    return res
                        .status(400)
                        .json({ message: "Please provide all needed details" });
                }
                const savedUser = await userModel_1.userModel.create({
                    username,
                    email,
                    password,
                    group,
                    name,
                });
                const token = jsonwebtoken_1.default.sign({ userId: savedUser._id, email: savedUser.email }, process.env.JWT_SECRET, { expiresIn: "6h" });
                return res.json({
                    payload: { message: "User created sucessfully", token },
                });
            }
            catch (error) {
                console.log(error);
                return res.status(500).json({ message: "error while signing up" });
            }
        });
    }
    testingMake() {
        this.app.post("/make", async (req, res) => {
            try {
                // Fetch data from the ContactModel
                const contacts = await contact_model_1.contactModel.find({ agentId: "agent_07ff7f6c39540e4e71a5c71385", isDeleted: false, isOnDNCList: false, dial_status: "connected-user" }).populate("referenceToCallId").limit(10); // Fetch all contacts
                if (!contacts || contacts.length === 0) {
                    return res.status(404).send("No contacts found in the database.");
                }
                // Prepare data for Make.com
                const data = contacts.map((contact) => {
                    var _a, _b, _c;
                    return ({
                        firstname: contact.firstname,
                        lastname: (contact === null || contact === void 0 ? void 0 : contact.lastname) || "",
                        email: contact.email,
                        phone: contact.phone,
                        summary: ((_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.retellCallSummary) || "",
                        url: ((_b = contact.referenceToCallId) === null || _b === void 0 ? void 0 : _b.recordingUrl) || "",
                        transcript: ((_c = contact.referenceToCallId) === null || _c === void 0 ? void 0 : _c.transcript) || "",
                    });
                });
                // Ensure the Make webhook URL is defined
                const webhookUrl = process.env.MAKE_URL_FOR_GHL;
                if (!webhookUrl) {
                    return res.status(500).send("Make URL is not defined in the environment variables.");
                }
                // Send data to Make
                const result = await axios_1.default.post(webhookUrl, { data }, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                console.log("Response from Make:", result.data);
                // Respond to the client
                res.status(200).send("Data sent to Make successfully!");
            }
            catch (error) {
                console.error("Error sending data to Make:", error);
                res.status(500).send("Failed to send data to Make.");
            }
        });
    }
    testingCalendly() {
        this.app.post("/test-calender", async (req, res) => {
            const eventTypeSlug = "test-event-type";
            const dateTime = "2024-08-10T03:00:00+01:00";
            const schedulingLink = `https://calendly.com/hydradaboss06/${eventTypeSlug}/${dateTime}?month=2024-08&date=2024-08-10`;
            try {
                const response = await axios_1.default.post("https://calendly.com/api/booking/invitees", {
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
                    recaptcha_token: "03AFcWeA4zspINFzCwvHId56h0v4T4cB1kpuPxBdEQGyMXD7E3s916-TFbrQCgoJkKul1-mUqgajgrHCFzaXZ23A3tCtxq9zIZ0ute14K06_rEVmPxFFObWHoTO796QZ40QTCvwaRY--AqYK7Ww8fhvDeSfc2LLaRuh4pTXfw0UBqJevTDVyH7_qD29MoaRpIotTJwrJVIHs3UpECzl4ekSHBHyZP_nJ2jJ_IXU1sPq4v-m2qJuzD8ZDDgP8VO3tXt_xpVP9Xo8Nvl4fAhhUqVuGo0xje45xCrRfsjdOyNCAxE-0-tUNdxGsQhzxZmVHZNXSv3K4DjAvoAaPtFGhq70vKexP-Xj8zdccMO_FDtoD3oN1zFIF9oK5yjSisX81B7CoUEwlBk8R6OCTICrN7kwd_oAgSvLDHFNMvZAk6ZA-RO6flsDhzOWa5WQkAjMLCe3Ne-TbJx_8H_aJy5aO20HHM-B-Jq5bVgfGXvU3ZAYYoR6rshwcfdg6BvhdDeT7m_XK9vvm7695kaS5y5QQxHaDKo5i2fbXS-EOosBNqy0cdBUDdZtDz5Exu_Mqv5ZASma0AhNsRQZik04EdkNL9rgLIHbCS8rQGnE3X4WBT70FpmJ2Ip5uRWeE0rj8Go5M3EfliI82p37e122FPsb_pkrBJmLWGiIWwPZy4Wgp80NFCbLvSbh_A4qYDHH8MBTe1-Jya76mR0XhEQI7PwxpdZAb_r3oQStmz4qdO0EpUP21Ul_1S_r3Ww2cdki29oC0SrfTGGIfWl22pi33sGaNhcJvtvpkNtqn7WhXL-umdMLlwOMH_RVwJznQzZZm1cSvc9Xl1EnBcmKqjDT0_gHvKBGQ6jIn0IS9sL1b_2EuOx8i_Bikh_MNxx8s9TlX5VFMLWgY0U7KuCIQu98liDK-6rJ0SG9SHSrurEqje-s2dYZE-44SegpFcdzZB_0QZ4PJZWvGc-R4mXfNvP0XeS55fVAFCZeThYxdzAYPJtyMTBmHIgZi-GlD5WFZq-uQQkj3IshH7ANqCMBVehQzwEQfBxIWZDyb-rTtlpzIIrscxYa750Sm0zvL3AGg9bsURtHnRb8MnECPtOqFQjYZh-W4qqSh0uGXKHttMN1xkxCBbSMW_NpPI4V_IXe50YdEhqXbJd8XlpAJe0IkRZban2_9UFeS7mldZzUfuyQ0Y9Uxo0msRl_DcMFRD3HCLUAe6sVV1IFSB6KXLoXVkTojpz6Ct16R1tfb2riylze1G4lZhb1yFIwAty5IKSvrsmLD5E9W6kLLdCMAtBJOpVNMurA3sKKHROOLHYyPkmc5MEWGTpKgMSI5PJJUraLteh92r2KSATJftX0F3ABsbCCaHqAC6QjzZYk7m5KRS0CYsg2PtrWkRGbfWCE0eJH_DZLLjirlNdx4E457q0Hqfq-YHm1kMEoGizIN65PS62hQQrG42Fg0HJXRWU1neYCtKzqnFEKFrLPtZU7QQf4JY1quD3fTXK5R0VpF4BpRVFYUzKJXnJdRNMJrw7EsXayhcOGsmxU_ds7tJPa207_nHZt0_J8sUpDIMEtIPZOtGjYEiHaLudm9rYbrUruo2SarK0BqpFeAeekRr-pY6bUU-bFNAYTttzLQaUNsuJsqQaOO_hHZ74M0PDt7zWr8IyCugMPawxZdvF29e1k5xeoFcf_NgSI0QS6vHr_jIQzUxRxKOBdzr_x6rQBBjJFVH3XiWC-is_JAiiPTv7HNyjkWd-keM59WHWyH60y9nWd2Xtp9QkfQu71qp6YMdXeV8LGueoBht6CIxnhbrTW0zJLaUpkdx4gYHsjWP0lT4OuFO3-GOMGblSB5PqYzU-rTmqmht49eNfF0ULyr98EhCqRNpBVuzXaOM8zBavBMlKV6CpE4q3uQJ2-7mxagLGEycJ5XvEKMzDLnKIlncvps2q7RNMxNVcteGxqBhiTR0u1wPMPdyuspZmd1GZGeieDuzzz4_m5mnAxs3H0rXgnGKB",
                    tracking: {
                        fingerprint: "16a55c03835bdf03c0414b62df7413a9",
                    },
                    scheduling_link_uuid: "pwm-pwm-235",
                    locale: "en",
                });
                console.log("Invitee added successfully:", response.data);
                res.send(response.data);
            }
            catch (error) {
                console.error("Error adding invitee:", error);
                throw error;
            }
        });
    }
    getFullStat() {
        this.app.post("/get-daily-report", protect_1.default, isAdmin_1.isAdmin, async (req, res) => {
            const { agentId } = req.body;
            const foundContacts = await contact_model_1.contactModel.find({
                dial_status: { $ne: types_2.callstatusenum.NOT_CALLED },
                isDeleted: false,
            });
            const totalCount = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: { $ne: true },
            });
            const totalContactForAgent = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: false,
            });
            const totalAnsweredCalls = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: false,
                dial_status: types_2.callstatusenum.CALLED,
            });
            const totalNotCalledForAgent = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: false,
                dial_status: types_2.callstatusenum.NOT_CALLED,
            });
            const totalAnsweredByVm = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: false,
                dial_status: types_2.callstatusenum.VOICEMAIL,
            });
            const totalCalls = await contact_model_1.contactModel.countDocuments({
                agentId,
                isDeleted: false,
                dial_status: {
                    $in: [
                        types_2.callstatusenum.CALLED,
                        types_2.callstatusenum.VOICEMAIL,
                        types_2.callstatusenum.FAILED,
                    ],
                },
            });
            const totalCallsTransffered = await contact_model_1.contactModel.aggregate([
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
            const totalAppointment = await contact_model_1.contactModel.aggregate([
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
            const statsWithTranscripts = await Promise.all(foundContacts.map(async (stat) => {
                var _a, _b;
                const transcript = (_a = stat.referenceToCallId) === null || _a === void 0 ? void 0 : _a.transcript;
                const analyzedTranscript = (_b = stat.referenceToCallId) === null || _b === void 0 ? void 0 : _b.analyzedTranscript;
                return Object.assign(Object.assign({}, stat.toObject()), { originalTranscript: transcript, analyzedTranscript });
            }));
            const data = {
                totalContactForAgent,
                totalAnsweredCalls,
                totalNotCalledForAgent,
                totalAnsweredByVm,
                totalAppointment: totalAppointment.length > 0 ? totalAppointment[0].result : 0,
                totalCallsTransffered: totalCallsTransffered.length > 0
                    ? totalCallsTransffered[0].result
                    : 0,
                totalCalls,
                contacts: statsWithTranscripts,
            };
            res.setHeader("Content-Disposition", "attachment; filename=contacts.txt");
            res.setHeader("Content-Type", "text/plain");
            res.send(data);
        });
    }
    getAllDbTags() {
        this.app.post("/get-tags", async (req, res) => {
            const { agentId } = req.body;
            try {
                // Validate the input
                // if (!Array.isArray(agentIds) || agentIds.length === 0) {
                //   return res
                //     .status(400)
                //     .send({ error: "agentIds must be a non-empty array." });
                // }
                // Fetch users with matching agent IDs
                const users = await userModel_1.userModel.find({ "agents.agentId": agentId }, { agents: 1 });
                // Aggregate all tags into a single array
                const allTags = new Set(); // Use a Set to ensure uniqueness
                users.forEach((user) => {
                    user.agents.forEach((agent) => {
                        if (agentId.includes(agent.agentId)) {
                            agent.tag.forEach((tag) => allTags.add(tag)); // Add tags to the Set
                        }
                    });
                });
                // Convert Set to an array for the response
                const uniqueTagsArray = Array.from(allTags);
                // Send the response
                res.send({ tags: uniqueTagsArray });
            }
            catch (error) {
                console.error("Error fetching tags:", error);
                return res.status(500).send({ error: "Error fetching tags" });
            }
        });
    }
    getAllDbTagsClient() {
        this.app.post("/get-tags-client", async (req, res) => {
            const { agentIds } = req.body;
            try {
                // Validate the input
                if (!Array.isArray(agentIds) || agentIds.length === 0) {
                    return res
                        .status(400)
                        .send({ error: "agentIds must be a non-empty array." });
                }
                // Fetch users with matching agent IDs
                const users = await userModel_1.userModel.find({ "agents.agentId": { $in: agentIds } }, { agents: 1 });
                // Aggregate all tags into a single array
                const allTags = new Set(); // Use a Set to ensure uniqueness
                users.forEach((user) => {
                    user.agents.forEach((agent) => {
                        if (agentIds.includes(agent.agentId)) {
                            agent.tag.forEach((tag) => allTags.add(tag)); // Add tags to the Set
                        }
                    });
                });
                // Convert Set to an array for the response
                const uniqueTagsArray = Array.from(allTags);
                // Send the response
                res.send({ tags: uniqueTagsArray });
            }
            catch (error) {
                console.error("Error fetching tags:", error);
                return res.status(500).send({ error: "Error fetching tags" });
            }
        });
    }
    syncStatWithMake() {
        this.app.post("/api/make", async (req, res) => {
            const foundContacts = await contact_model_1.contactModel
                .find({
                isDeleted: false,
            })
                .populate("referenceToCallId");
            const mappedContacts = await Promise.all(foundContacts.map(async (contact) => {
                var _a, _b, _c;
                let date;
                if (((_a = contact.referenceToCallId) === null || _a === void 0 ? void 0 : _a.analyzedTranscript) === "Call back") {
                    date = await (0, transcript_review_1.reviewCallback)(contact.referenceToCallId.transcript);
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
                    summary: ((_b = contact.referenceToCallId) === null || _b === void 0 ? void 0 : _b.retellCallSummary)
                        ? contact.referenceToCallId.retellCallSummary
                        : ".",
                    recordingAudioLink: ((_c = contact.referenceToCallId) === null || _c === void 0 ? void 0 : _c.recordingUrl)
                        ? contact.referenceToCallId.recordingUrl
                        : ".",
                    timeToCallback: date ? "." : date,
                };
            }));
            res.json(mappedContacts);
        });
    }
    testingZoom() {
        this.app.post("/test/zoom", async (req, res) => {
            const clientId = process.env.ZOOM_CLIENT_ID;
            const clientSecret = process.env.ZOOM_CLIENT_SECRET;
            const accountId = process.env.ZOOM_ACC_ID;
            const userEmail = process.env.ZOOM_EMAIL;
            const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
            // const userId = process.env.ZOOM_USER_ID;
            const { start_time, invitee } = req.body;
            try {
                await (0, zoom_1.generateZoomAccessToken)(clientId, clientSecret, accountId);
                const userId = await (0, zoom_1.getUserId)(userEmail, clientId, clientSecret, accountId);
                console.log("userID is : ", userId);
                await (0, zoom_1.getAllSchedulesWithAvailabilityId)(clientId, clientSecret, accountId);
                const availableTimes = await (0, zoom_1.checkAvailability)(clientId, clientSecret, accountId, availabilityId);
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
            }
            catch (error) {
                console.error("An error occurred:", error);
            }
        });
    }
    updateUserTag() {
        this.app.post("/update/metadata", async (req, res) => {
            try {
                const { updates } = req.body;
                const result = await (0, contact_controller_1.updateContactAndTranscript)(updates);
                res.json({ message: result });
            }
            catch (error) {
                console.error("Error updating events:", error);
                res.status(500).json({ error: "Internal server error." });
            }
        });
    }
    updateUserTagForClient() {
        this.app.post("/update/metadata-client", async (req, res) => {
            try {
                const { updates } = req.body;
                const result = await (0, contact_controller_1.updateContactAndTranscriptForClient)(updates);
                res.json({ message: result });
            }
            catch (error) {
                console.error("Error updating events:", error);
                res.status(500).json({ error: "Internal server error." });
            }
        });
    }
    checkAvailabiltyWithZoom() {
        this.app.post("/zoom/availabilty", async (req, res) => {
            const clientId = process.env.ZOOM_CLIENT_ID;
            const clientSecret = process.env.ZOOM_CLIENT_SECRET;
            const accountId = process.env.ZOOM_ACC_ID;
            const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
            const availableTimes = await (0, zoom_1.checkAvailability)(clientId, clientSecret, accountId, availabilityId);
            res.send(availableTimes);
        });
    }
    bookAppointmentWithZoom() {
        this.app.post("/zoom/appointment", async (req, res) => {
            let lastname;
            const clientId = process.env.ZOOM_CLIENT_ID;
            const clientSecret = process.env.ZOOM_CLIENT_SECRET;
            const accountId = process.env.ZOOM_ACC_ID;
            const userId = process.env.ZOOM_USER_ID;
            const invitee = req.body.args.email;
            const start_time = req.body.args.startTime;
            const firstname = req.body.call.retell_llm_dynamic_variables.user_firstname;
            lastname = req.body.call.retell_llm_dynamic_variables.user_lastname;
            if (!lastname) {
                lastname = ".";
            }
            const scheduledMeeting = await (0, zoom_1.scheduleMeeting)(clientId, clientSecret, accountId, userId, start_time, 45, "Important Meeting", "Discuss important matters", invitee, firstname, lastname);
            res.send("Schduled");
        });
    }
    script() {
        this.app.post("/script", async (req, res) => {
            try {
                async function processCSV(mainCSV, compareCSV, nonDuplicateCSV, duplicateCSV) {
                    return new Promise((resolve, reject) => {
                        const mainContacts = [];
                        const compareContacts = [];
                        // Read the main CSV (main contacts)
                        fs_1.default.createReadStream(mainCSV)
                            .pipe((0, csv_parser_1.default)())
                            .on("data", (data) => mainContacts.push(data))
                            .on("end", () => {
                            // Read the compare CSV (DNC or similar contacts)
                            fs_1.default.createReadStream(compareCSV)
                                .pipe((0, csv_parser_1.default)())
                                .on("data", (data) => compareContacts.push(data))
                                .on("end", async () => {
                                try {
                                    // Create a set of formatted phone numbers and emails from the main list
                                    const mainSet = new Set(mainContacts.map((contact) => {
                                        const formattedPhone = contact.phone
                                            ? (0, formatter_1.formatPhoneNumber)(contact.phone)
                                            : null;
                                        return formattedPhone || contact.email; // Use formatted phone if available, otherwise use email
                                    }));
                                    // Filter compare contacts based on the main set
                                    const duplicateContacts = compareContacts.filter((contact) => {
                                        const formattedPhone = contact.phone
                                            ? (0, formatter_1.formatPhoneNumber)(contact.phone)
                                            : null;
                                        const key = formattedPhone; // Use formatted phone if available, otherwise use email
                                        console.log(`Checking for duplicate: ${key}`);
                                        return mainSet.has(key);
                                    });
                                    const nonDuplicateContacts = compareContacts.filter((contact) => {
                                        const formattedPhone = contact.phone
                                            ? (0, formatter_1.formatPhoneNumber)(contact.phone)
                                            : null;
                                        const key = formattedPhone; // Use formatted phone if available, otherwise use email
                                        return !mainSet.has(key);
                                    });
                                    // Write non-duplicate contacts to a CSV
                                    if (nonDuplicateContacts.length > 0) {
                                        const nonDuplicateWriter = (0, csv_writer_1.createObjectCsvWriter)({
                                            path: nonDuplicateCSV,
                                            header: Object.keys(nonDuplicateContacts[0]).map((key) => ({
                                                id: key,
                                                title: key,
                                            })),
                                        });
                                        await nonDuplicateWriter.writeRecords(nonDuplicateContacts);
                                        console.log(`Non-duplicate contacts saved to ${nonDuplicateCSV}`);
                                    }
                                    else {
                                        console.log("No non-duplicate contacts to write.");
                                    }
                                    // Write duplicate contacts to a CSV
                                    if (duplicateContacts.length > 0) {
                                        const duplicateWriter = (0, csv_writer_1.createObjectCsvWriter)({
                                            path: duplicateCSV,
                                            header: Object.keys(duplicateContacts[0]).map((key) => ({
                                                id: key,
                                                title: key,
                                            })),
                                        });
                                        await duplicateWriter.writeRecords(duplicateContacts);
                                        console.log(`Duplicate contacts saved to ${duplicateCSV}`);
                                    }
                                    else {
                                        console.log("No duplicate contacts to write.");
                                    }
                                    resolve();
                                }
                                catch (err) {
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
                const mainCSVPath = path_1.default.join(__dirname, "../public", "main.csv");
                const compareCSVPath = path_1.default.join(__dirname, "../public", "compare.csv");
                const nonDuplicateCSVPath = path_1.default.join(__dirname, "../public", "non_duplicate.csv");
                const duplicateCSVPath = path_1.default.join(__dirname, "../public", "duplicate.csv");
                // Call the function to process the CSV files
                await processCSV(mainCSVPath, compareCSVPath, nonDuplicateCSVPath, duplicateCSVPath);
                res.status(200).json({
                    message: "Contacts have been filtered and saved successfully",
                });
            }
            catch (error) {
                res.status(500).json({
                    message: "An error occurred while processing the CSVs",
                });
            }
        });
    }
    populateUserGet() {
        this.app.post("/user/populate", async (req, res) => {
            try {
                const { agentId, dateOption, status, jobId } = req.body;
                const timeZone = "America/Los_Angeles"; // PST time zone
                const now = new Date();
                const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
                const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
                let dateFilter = {};
                let dateFilter1 = {};
                let tag = {};
                if (jobId) {
                    const job = await contact_model_1.jobModel.findOne({ jobId, agentId }).lean();
                    if (job && job.createdAt) {
                        const createdAtDate = new Date(job.createdAt)
                            .toISOString()
                            .split("T")[0];
                        dateFilter = { datesCalled: createdAtDate };
                        dateFilter1 = { day: createdAtDate };
                        tag = { tag: job.tagProcessedFor };
                    }
                }
                else if (dateOption || dateOption === "") {
                    switch (dateOption) {
                        case types_1.DateOption.Today:
                            dateFilter = { datesCalled: today };
                            dateFilter1 = { day: today };
                            break;
                        case types_1.DateOption.Yesterday:
                            const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                            const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", {
                                timeZone,
                            });
                            dateFilter = { datesCalled: yesterday };
                            dateFilter1 = { day: yesterday };
                            break;
                        case types_1.DateOption.ThisWeek:
                            const weekdays = [];
                            for (let i = 0; i < 7; i++) {
                                const day = (0, date_fns_1.subDays)(zonedNow, i);
                                const dayOfWeek = day.getDay();
                                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                    weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                                }
                            }
                            dateFilter = { datesCalled: { $in: weekdays } };
                            dateFilter1 = { day: { $in: weekdays } };
                            break;
                        case types_1.DateOption.ThisMonth:
                            const monthDates = [];
                            for (let i = 0; i < now.getDate(); i++) {
                                const day = (0, date_fns_1.subDays)(now, i);
                                monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                            }
                            dateFilter = { datesCalled: { $in: monthDates } };
                            dateFilter1 = { day: { $in: monthDates } };
                            break;
                        case types_1.DateOption.Total:
                            dateFilter = {};
                            dateFilter1 = {};
                            break;
                        default:
                            const recentJob = await contact_model_1.jobModel
                                .findOne({ agentId })
                                .sort({ createdAt: -1 })
                                .lean();
                            if (recentJob) {
                                const dateToCheck = recentJob.scheduledTime.split("T")[0];
                                dateFilter = { datesCalled: dateToCheck };
                                dateFilter1 = { day: dateToCheck };
                            }
                            else {
                                dateFilter = {};
                                dateFilter1 = {};
                            }
                            break;
                    }
                }
                console.log(dateFilter);
                let query = Object.assign(Object.assign({ agentId, isDeleted: false }, dateFilter), tag);
                // Only add status to the query if it's provided
                if (status) {
                    switch (status) {
                        case "failed":
                            query.dial_status = types_2.callstatusenum.FAILED;
                            break;
                        case "called":
                            query.dial_status = { $ne: types_2.callstatusenum.NOT_CALLED };
                            break;
                        case "not-called":
                            query.dial_status = types_2.callstatusenum.NOT_CALLED;
                            break;
                        case "answered":
                            query.dial_status = types_2.callstatusenum.CALLED;
                            break;
                        case "transferred":
                            query.dial_status = types_2.callstatusenum.TRANSFERRED;
                            break;
                        case "voicemail":
                            query.dial_status = types_2.callstatusenum.VOICEMAIL;
                            break;
                        case "appointment":
                            query.dial_status = types_2.callstatusenum.SCHEDULED;
                            break;
                        case "ivr":
                            query.dial_status = types_2.callstatusenum.IVR;
                            break;
                        case "inactivity":
                            query.dial_status = types_2.callstatusenum.INACTIVITY;
                            break;
                    }
                }
                console.log("Final query:", query);
                const result = await contact_model_1.contactModel
                    .find(query)
                    .populate("referenceToCallId");
                res.json(result);
            }
            catch (error) {
                console.error("Error in populateUserGet:", error);
                res.status(500).send("An error occurred while processing the request.");
            }
        });
    }
    resetPassword() {
        this.app.post("/user/reset-password", async (req, res) => {
            try {
                const { email, newPassword } = req.body;
                // Validate input
                if (!email || !newPassword) {
                    return res
                        .status(400)
                        .json({ message: "Please provide email and new password" });
                }
                // Find the user by email
                const user = await userModel_1.userModel.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                // Hash the new password
                const newPasswordHash = await argon2_1.default.hash(newPassword);
                // Update the user's passwordHash
                user.password = newPassword;
                user.passwordHash = newPasswordHash;
                await user.save();
                return res.json({ message: "Password reset successfully" });
            }
            catch (error) {
                console.log(error);
                return res
                    .status(500)
                    .json({ message: "Error while resetting password" });
            }
        });
    }
    testingZap() {
        this.app.post("/zapTest", async (req, res) => {
            try {
                const data = { "leads": [{
                            firstname: "Nick",
                            lastname: "Bernadini",
                            email: "info@ixperience.io",
                            phone: "+1727262723",
                            AI_Voice_Agent: {
                                call_recording_url: "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
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
                                call_recording_url: "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
                                status: "call-ended",
                                transcript: "This is test data fron intuitiveagent",
                                duration: "00:00;05",
                                timestamp: "2024-12-09",
                            }
                        },
                        {
                            firstname: "Micheal",
                            lastname: "Doe",
                            email: "michealdoe@gmail.com",
                            phone: "+1727223723",
                            AI_Voice_Agent: {
                                call_recording_url: "https://dxc03zgurdly9.cloudfront.net/call_decee1f115d524a67bcbe8f2a6/recording.wav",
                                status: "call-ended",
                                transcript: "This is test data fron intuitiveagent",
                                duration: "00:00;05",
                                timestamp: "2024-12-09",
                            }
                        },
                    ] };
                const result = axios_1.default.post(process.env.ZAP_URL, data);
                console.log("don3");
                res.send("done");
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    getCallHistoryClient() {
        this.app.post("/call-history-client", async (req, res) => {
            try {
                const { agentIds, dateOption } = req.body;
                const page = parseInt(req.body.page) || 1;
                const pageSize = 100;
                const skip = (page - 1) * pageSize;
                let dateFilter;
                let dateFilter1;
                const timeZone = "America/Los_Angeles";
                const now = new Date();
                const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
                const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
                switch (dateOption) {
                    case types_1.DateOption.Today:
                        dateFilter = { date: today };
                        dateFilter1 = { day: today };
                        break;
                    case types_1.DateOption.Yesterday:
                        const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                        const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", {
                            timeZone,
                        });
                        dateFilter = { date: yesterday };
                        dateFilter1 = { day: yesterday };
                        break;
                    case types_1.DateOption.ThisWeek:
                        const weekdays = [];
                        for (let i = 0; i < 7; i++) {
                            const day = (0, date_fns_1.subDays)(zonedNow, i);
                            const dayOfWeek = day.getDay();
                            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                            }
                        }
                        dateFilter = { date: { $in: weekdays } };
                        dateFilter1 = { day: { $in: weekdays } };
                        break;
                    case types_1.DateOption.ThisMonth:
                        const monthDates = [];
                        for (let i = 0; i < now.getDate(); i++) {
                            const day = (0, date_fns_1.subDays)(now, i);
                            monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                        }
                        dateFilter = { date: { $in: monthDates } };
                        dateFilter1 = { day: { $in: monthDates } };
                        break;
                    default:
                        const recentJob = await historyModel_1.default
                            .findOne({ agentId: { $in: agentIds } })
                            .sort({ createdAt: -1 })
                            .lean();
                        if (recentJob) {
                            dateFilter = { date: recentJob.date };
                            dateFilter1 = { day: recentJob.date };
                        }
                        else {
                            dateFilter = {};
                            dateFilter1 = {};
                        }
                        break;
                    case types_1.DateOption.Total:
                        dateFilter = {};
                        dateFilter1 = {};
                        break;
                }
                console.log(dateFilter);
                const callHistory = await historyModel_1.default
                    .find(Object.assign({ agentId: { $in: agentIds } }, dateFilter))
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
                const totalCount = await historyModel_1.default.countDocuments(Object.assign({ agentId: { $in: agentIds } }, dateFilter));
                const totalPages = Math.ceil(totalCount / pageSize);
                res.json({
                    success: true,
                    page,
                    totalPages,
                    totalCount,
                    callHistories,
                });
            }
            catch (error) {
                console.error("Error fetching call history:", error);
                res
                    .status(500)
                    .json({ success: false, message: "Internal Server Error" });
            }
        });
    }
    getCallHistoryAdmin() {
        this.app.post("/call-history-admin", async (req, res) => {
            try {
                const { agentId, dateOption } = req.body;
                const page = parseInt(req.body.page) || 1;
                const pageSize = 100;
                const skip = (page - 1) * pageSize;
                let dateFilter;
                let dateFilter1;
                const timeZone = "America/Los_Angeles";
                const now = new Date();
                const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
                const today = (0, date_fns_tz_1.format)(zonedNow, "yyyy-MM-dd", { timeZone });
                switch (dateOption) {
                    case types_1.DateOption.Today:
                        dateFilter = { date: today };
                        dateFilter1 = { day: today };
                        break;
                    case types_1.DateOption.Yesterday:
                        const zonedYesterday = (0, date_fns_tz_1.toZonedTime)((0, date_fns_1.subDays)(now, 1), timeZone);
                        const yesterday = (0, date_fns_tz_1.format)(zonedYesterday, "yyyy-MM-dd", {
                            timeZone,
                        });
                        dateFilter = { date: yesterday };
                        dateFilter1 = { day: yesterday };
                        break;
                    case types_1.DateOption.ThisWeek:
                        const weekdays = [];
                        for (let i = 0; i < 7; i++) {
                            const day = (0, date_fns_1.subDays)(zonedNow, i);
                            const dayOfWeek = day.getDay();
                            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                weekdays.push((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                            }
                        }
                        dateFilter = { date: { $in: weekdays } };
                        dateFilter1 = { day: { $in: weekdays } };
                        break;
                    case types_1.DateOption.ThisMonth:
                        const monthDates = [];
                        for (let i = 0; i < now.getDate(); i++) {
                            const day = (0, date_fns_1.subDays)(now, i);
                            monthDates.unshift((0, date_fns_tz_1.format)(day, "yyyy-MM-dd", { timeZone }));
                        }
                        dateFilter = { date: { $in: monthDates } };
                        dateFilter1 = { day: { $in: monthDates } };
                        break;
                    default:
                        const recentJob = await historyModel_1.default
                            .findOne({ agentId })
                            .sort({ createdAt: -1 })
                            .lean();
                        if (recentJob) {
                            dateFilter = { date: recentJob.date };
                            dateFilter1 = { day: recentJob.date };
                        }
                        else {
                            dateFilter = {};
                            dateFilter1 = {};
                        }
                        break;
                    case types_1.DateOption.Total:
                        dateFilter = {};
                        dateFilter1 = {};
                        break;
                }
                const callHistory = await historyModel_1.default
                    .find(Object.assign({ agentId }, dateFilter), { callId: 0 })
                    .sort({ startTimestamp: -1 })
                    .skip(skip)
                    .limit(pageSize);
                const totalCount = await historyModel_1.default.countDocuments(Object.assign({ agentId }, dateFilter));
                const totalPages = Math.ceil(totalCount / pageSize);
                res.json({
                    success: true,
                    page,
                    totalPages,
                    totalCount,
                    callHistory,
                });
            }
            catch (error) {
                console.error("Error fetching call history:", error);
                res
                    .status(500)
                    .json({ success: false, message: "Internal Server Error" });
            }
        });
    }
    secondscript() {
        this.app.post("/script1", async (req, res) => {
            const result = await (0, script_1.script)(req.body.jobid);
            res.send(result);
        });
    }
    sendReportToClient() {
        this.app.get("/send-report-to-client", async (req, res) => {
            try {
                const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
                //const today  = "2024-10-31"
                const dailyStats = await logModel_1.DailyStatsModel.find({ day: today }).exec();
                // Transform the data into an object of objects
                const result = {};
                dailyStats.forEach((stat) => {
                    const agentKey = typeof stat.agentId === "string" ? stat.agentId : "unknown";
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
                const filteredResults = Object.values(result).filter((agentStats) => agentStats.totalCalls > 2);
                res.json(filteredResults); // Send the filtered results back to the client
            }
            catch (error) {
                console.error("Error fetching daily stats:", error);
                res.status(500).send("Internal Server Error"); // Send an error response
            }
        });
    }
    getDatesAgentsHaveBeenCalled() {
        this.app.post("/agent/date", async (req, res) => {
            try {
                const { agentId } = req.body;
                // Fetch jobs for the given agentId
                const results = await contact_model_1.jobModel.find({ agentId });
                // Map each result to an object containing 'date' and 'tag'
                const dateTagArray = results.map((job) => {
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
            }
            catch (error) {
                console.error(error);
                res
                    .status(500)
                    .json({ message: "An error occurred while fetching data." });
            }
        });
    }
    getOneLLM() {
        this.app.post("/get-llm", async (req, res) => {
            const { llm_id } = req.body;
            // Validate if LLM ID is provided
            if (!llm_id) {
                return res.status(400).json({
                    success: false,
                    message: "LLM ID is required.",
                });
            }
            try {
                const result = await (0, llm_fuctions_1.getOneLLM)(llm_id);
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        data: result.data,
                    });
                }
                else {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error fetching LLM from Retell:", error);
                return res.status(500).json({
                    success: false,
                    message: "An unexpected error occurred while fetching LLM data.",
                });
            }
        });
    }
    getAllLLM() {
        this.app.get("/list-llm", async (req, res) => {
            try {
                const result = await (0, llm_fuctions_1.getAllLLM)();
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        data: result.data,
                    });
                }
                else {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error fetching all LLMs from Retell:", error);
                return res.status(500).json({
                    success: false,
                    message: "An unexpected error occurred while fetching all LLM data.",
                });
            }
        });
    }
    updateAgent() {
        this.app.post("/update-agent", async (req, res) => {
            const { agentId, payload } = req.body;
            if (!agentId) {
                return res.status(400).json({
                    success: false,
                    message: "Agent ID is required.",
                });
            }
            const result = await (0, llm_fuctions_1.updateAgent)(agentId, payload);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(400).json(result);
            }
        });
    }
    updateLLM() {
        this.app.post("/update-llm", async (req, res) => {
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
                const result = await (0, llm_fuctions_1.updateLLM)(llm_id, payload);
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        message: result.message,
                        data: result.data,
                    });
                }
                else {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error updating LLM:", error);
                return res.status(500).json({
                    success: false,
                    message: "An unexpected error occurred while updating the LLM.",
                });
            }
        });
    }
    revertLLM() {
        this.app.post("/revert-llm", async (req, res) => {
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
                const result = await (0, llm_fuctions_1.revertLLM)(llm_id, update_index);
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        message: result.message,
                        data: result.data,
                    });
                }
                else {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error in /revert-llm endpoint:", error);
                return res.status(500).json({
                    success: false,
                    message: "An unexpected error occurred while reverting the LLM.",
                });
            }
        });
    }
    revertAgent() {
        this.app.post("/revert-agent", async (req, res) => {
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
                const result = await (0, llm_fuctions_1.revertAgent)(agentId, update_index);
                if (result.success) {
                    return res.status(200).json({
                        success: true,
                        message: result.message,
                        data: result.data,
                    });
                }
                else {
                    return res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error in /revert-llm endpoint:", error);
                return res.status(500).json({
                    success: false,
                    message: "An unexpected error occurred while reverting the LLM.",
                });
            }
        });
    }
    graphChartAdmin() {
        this.app.post("/graph-stats-admin", async (req, res) => {
            try {
                const { agentId, dateOption, } = req.body;
                if (!agentId) {
                    return res.status(400).json({ error: "agentId is required" });
                }
                // Default to "last-schedule" if dateOption is not provided
                const selectedDateOption = dateOption || types_1.DateOption.LAST_SCHEDULE;
                // Get today's date in PST
                const todays = luxon_1.DateTime.now()
                    .setZone("America/Los_Angeles")
                    .startOf("day");
                const todayString = todays.toISODate(); // Format as YYYY-MM-DD
                let stats;
                let response;
                // Generate a template for hours from 09:00 to 15:00
                const createHourlyTemplate = () => {
                    return Array.from({ length: 7 }, (_, index) => ({
                        x: `${(9 + index).toString().padStart(2, "0")}:00`,
                        y: 0,
                    }));
                };
                if (selectedDateOption === types_1.DateOption.Today) {
                    stats = await graphModel_1.dailyGraphModel.findOne({ agentId, date: todayString });
                    // Initialize response with hourly template
                    response = createHourlyTemplate();
                    if (stats) {
                        const hourlyCalls = stats.hourlyCalls || new Map();
                        // Update the response with actual data
                        hourlyCalls.forEach((count, hour) => {
                            const hourIndex = parseInt(hour.split(":")[0], 10) - 9; // 9 AM is the first index
                            if (hourIndex >= 0 && hourIndex < 7) {
                                response[hourIndex].y = count; // Update the count for the corresponding hour
                            }
                        });
                    }
                }
                else if (selectedDateOption === types_1.DateOption.ThisWeek) {
                    const weekDays = [];
                    const currentDay = luxon_1.DateTime.now().setZone("America/Los_Angeles");
                    // Generate the rolling 7-day period starting from the current day
                    for (let i = 0; i < 7; i++) {
                        const day = currentDay.minus({ days: i }).toISODate();
                        weekDays.push(day);
                    }
                    // Fetch stats for the collected weekDays
                    stats = await graphModel_1.dailyGraphModel.find({
                        agentId,
                        date: { $in: weekDays },
                    });
                    // Predefined structure for the rolling 7 days
                    const predefinedStructure = weekDays.map((day) => {
                        const dayName = luxon_1.DateTime.fromISO(day, {
                            zone: "America/Los_Angeles",
                        }).toLocaleString({ weekday: "long" });
                        return { x: dayName, y: 0 }; // Initialize with 0
                    });
                    // Populate the predefined structure with actual data
                    weekDays.forEach((day) => {
                        const dayName = luxon_1.DateTime.fromISO(day, {
                            zone: "America/Los_Angeles",
                        }).toLocaleString({ weekday: "long" });
                        const dayStats = stats.find((s) => s.date === day);
                        const hourlyCalls = dayStats
                            ? dayStats.hourlyCalls
                            : new Map();
                        const hourlySum = Array.from(hourlyCalls.entries())
                            .filter(([hour]) => {
                            const hourInt = parseInt(hour.split(":")[0], 10);
                            return hourInt >= 9 && hourInt < 15; // Only count calls between 9 AM and 3 PM
                        })
                            .reduce((sum, [, count]) => sum + count, 0);
                        // Update the corresponding day in the predefined structure
                        const dayEntry = predefinedStructure.find((entry) => entry.x === dayName);
                        if (dayEntry) {
                            dayEntry.y = hourlySum; // Update the count
                        }
                    });
                    response = predefinedStructure.reverse(); // Reverse to display from today to 7 days ago
                }
                else if (selectedDateOption === types_1.DateOption.ThisMonth) {
                    stats = await graphModel_1.dailyGraphModel.find({ agentId });
                    const monthlyData = Array(12)
                        .fill(0)
                        .map((_, monthIndex) => {
                        const monthStats = stats.filter((s) => luxon_1.DateTime.fromISO(s.date).month === monthIndex + 1);
                        const monthlySum = monthStats.reduce((sum, stat) => {
                            const hourlyCalls = stat.hourlyCalls;
                            const hourlyCallsSum = Array.from(hourlyCalls.entries())
                                .filter(([hour]) => {
                                const hourInt = parseInt(hour.split(":")[0], 10);
                                return hourInt >= 9 && hourInt < 15;
                            })
                                .reduce((sum, [, count]) => sum + count, 0);
                            return sum + hourlyCallsSum;
                        }, 0);
                        const monthName = luxon_1.DateTime.fromObject({
                            month: monthIndex + 1,
                        }).toLocaleString({ month: "long" });
                        return { x: monthName, y: monthlySum };
                    });
                    response = monthlyData;
                }
                else if (selectedDateOption === types_1.DateOption.LAST_SCHEDULE) {
                    // Find the most recent schedule date
                    const lastStat = await graphModel_1.dailyGraphModel
                        .find({ agentId })
                        .sort({ date: -1 })
                        .limit(1);
                    // Check if no stats were found
                    if (!lastStat || lastStat.length === 0) {
                        // Return a predefined structure with all values set to 0
                        response = createHourlyTemplate();
                    }
                    else {
                        const lastScheduleDate = lastStat[0].date;
                        // Fetch stats for the last schedule date
                        stats = await graphModel_1.dailyGraphModel.find({
                            agentId,
                            date: lastScheduleDate,
                        });
                        // Initialize response with hourly template
                        response = createHourlyTemplate();
                        if (stats && stats.length > 0) {
                            const hourlyCalls = stats[0].hourlyCalls || new Map();
                            // Update the response with actual data
                            hourlyCalls.forEach((count, hour) => {
                                const hourIndex = parseInt(hour.split(":")[0], 10) - 9; // 9 AM is the first index
                                if (hourIndex >= 0 && hourIndex < 7) {
                                    response[hourIndex].y = count; // Update the count for the corresponding hour
                                }
                            });
                        }
                    }
                }
                else {
                    return res.status(400).json({ error: "Invalid dateOption" });
                }
                res.json(response);
            }
            catch (error) {
                console.error("Error fetching stats:", error);
                res.status(500).json({ error: "An error occurred" });
            }
        });
    }
    getSpecificScheduleAdmin() {
        this.app.post("/get-schedule-admin", async (req, res) => {
            try {
                const { agentId } = req.body;
                if (!agentId) {
                    return res
                        .status(400)
                        .json({ message: "Please provide an agentId" });
                }
                const result = await contact_model_1.jobModel.findOne({
                    agentId,
                    callstatus: types_2.jobstatus.ON_CALL,
                });
                if (!result) {
                    return res.status(404).json({ message: "No Running job found" });
                }
                res.json({ result });
            }
            catch (error) {
                console.error("Error fetching schedule:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    getSpecificScheduleClient() {
        this.app.post("/get-schedule-client", async (req, res) => {
            try {
                const { agentIds } = req.body;
                if (!agentIds) {
                    return res.status(400).json({ message: "Please provide agentIds" });
                }
                const result = await contact_model_1.jobModel.findOne({
                    agentId: { $in: agentIds },
                    callstatus: types_2.jobstatus.ON_CALL,
                });
                if (!result) {
                    return res.status(404).json({ message: "No job found" });
                }
                res.json({ result });
            }
            catch (error) {
                console.error("Error fetching schedule:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
    }
    graphChartClient() {
        this.app.post("/graph-stats-client", async (req, res) => {
            try {
                const { agentIds, dateOption } = req.body;
                if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
                    return res.status(400).json({
                        error: "agentIds are required",
                    });
                }
                // Default to "lastSchedule" if dateOption is not provided
                const selectedDateOption = dateOption || types_1.DateOption.LAST_SCHEDULE;
                let stats;
                let response;
                const createHourlyTemplate = () => {
                    return Array.from({ length: 7 }, (_, index) => ({
                        x: `${(9 + index).toString().padStart(2, "0")}:00`,
                        y: 0,
                    }));
                };
                if (selectedDateOption === types_1.DateOption.Today) {
                    const todays = luxon_1.DateTime.now()
                        .setZone("America/Los_Angeles")
                        .startOf("day");
                    const todayString = todays.toISODate(); // Format as YYYY-MM-DD
                    stats = await graphModel_1.dailyGraphModel.find({
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
                    const aggregatedCalls = {};
                    stats.forEach((stat) => {
                        const hourlyCalls = stat.hourlyCalls;
                        hourlyCalls.forEach((count, hour) => {
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
                else if (selectedDateOption === types_1.DateOption.ThisWeek) {
                    const selectedDay = luxon_1.DateTime.now()
                        .setZone("America/Los_Angeles")
                        .startOf("day"); // Get the current day at the start of the day
                    // Create an array of the last 7 days, including the selected day
                    const weekDays = Array.from({ length: 7 }, (_, index) => selectedDay.minus({ days: index }).toISODate()).reverse(); // Reverse to get them in chronological order (today to 6 days ago)
                    // Query for stats in the last 7 days
                    stats = await graphModel_1.dailyGraphModel.find({
                        agentId: { $in: agentIds },
                        date: { $in: weekDays },
                    });
                    // Initialize response with all 7 days having y = 0
                    const weeklyData = weekDays.map((day) => {
                        const dayName = luxon_1.DateTime.fromISO(day, {
                            zone: "America/Los_Angeles",
                        }).toLocaleString({ weekday: "long" }); // Get the localized weekday name
                        // Find the stats for the current day
                        const dailyStats = stats.filter((s) => s.date === day);
                        // Sum up hourly calls for the day
                        const dailySum = dailyStats.reduce((sum, stat) => {
                            const hourlyCalls = stat.hourlyCalls;
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
                }
                else if (selectedDateOption === types_1.DateOption.ThisMonth) {
                    stats = await graphModel_1.dailyGraphModel.find({
                        agentId: { $in: agentIds },
                    });
                    console.log("stats: ", stats);
                    const monthlyData = Array(12)
                        .fill(0)
                        .map((_, monthIndex) => {
                        const monthStats = stats.filter((s) => luxon_1.DateTime.fromISO(s.date).month === monthIndex + 1);
                        const monthlySum = monthStats.reduce((sum, stat) => {
                            const hourlyCalls = stat.hourlyCalls;
                            const hourlySum = Array.from(hourlyCalls.entries())
                                .filter(([hour]) => {
                                const hourInt = parseInt(hour.split(":")[0], 10);
                                return hourInt >= 9 && hourInt < 15;
                            })
                                .reduce((sum, [, count]) => sum + count, 0);
                            return sum + hourlySum;
                        }, 0);
                        const monthName = luxon_1.DateTime.fromObject({
                            month: monthIndex + 1,
                        }).toLocaleString({ month: "long" });
                        return { x: monthName, y: monthlySum };
                    });
                    response = monthlyData;
                }
                else if (selectedDateOption === types_1.DateOption.LAST_SCHEDULE) {
                    // Find the most recent schedule date
                    const lastStat = await graphModel_1.dailyGraphModel
                        .find({ agentId: { $in: agentIds } })
                        .sort({ date: -1 })
                        .limit(1);
                    // If no last schedule exists, return default hourly template
                    if (!lastStat || lastStat.length === 0) {
                        response = createHourlyTemplate();
                    }
                    else {
                        const lastScheduleDate = lastStat[0].date;
                        // Fetch stats for the last schedule date
                        stats = await graphModel_1.dailyGraphModel.find({
                            agentId: { $in: agentIds },
                            date: lastScheduleDate,
                        });
                        // Initialize response with hourly template
                        response = createHourlyTemplate();
                        if (stats.length > 0) {
                            const aggregatedCalls = {};
                            stats.forEach((stat) => {
                                const hourlyCalls = stat.hourlyCalls;
                                hourlyCalls.forEach((count, hour) => {
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
                }
                else {
                    return res.status(400).json({ error: "Invalid dateOption" });
                }
                res.json(response);
            }
            catch (error) {
                console.error("Error fetching stats:", error);
                res.status(500).json({ error: "An error occurred" });
            }
        });
    }
    takeAgentId() {
        this.app.post("/agents-data", async (req, res) => {
            try {
                const { agentIds } = req.body;
                if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
                    return res.status(400).json({
                        error: "agentIds is required and should be a non-empty array",
                    });
                }
                // Find users where any agentId matches the provided array
                const usersWithAgents = await userModel_1.userModel
                    .find({
                    "agents.agentId": { $in: agentIds },
                })
                    .select("agents");
                // Extract matching agents for each user
                const result = usersWithAgents.flatMap((user) => user.agents.filter((agent) => agentIds.includes(agent.agentId)));
                res.json({ result });
            }
            catch (error) {
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
                const contacts = await contact_model_1.contactModel.find({
                    agentId: "agent_1852d8aa89c3999f70ecba92b8",
                    referenceToCallId: { $ne: null }, // Skip null or undefined referenceToCallId
                });
                // Initialize an array to store the mapped leads
                const leads = [];
                // Loop through each contact and fetch the corresponding record
                for (const contact of contacts) {
                    const record = await recordModel_1.recordModel.findOne({ callId: contact.referenceToCallId });
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
            }
            catch (error) {
                console.error("Error: ", error);
                res.status(500).send("An error occurred while processing your request.");
            }
        });
    }
}
exports.Server = Server;
