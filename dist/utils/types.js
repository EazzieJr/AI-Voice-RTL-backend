"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientType = exports.CampaignStatus = exports.calloutcome = exports.Category = exports.DateOption = exports.jobstatus = exports.callSentimentenum = exports.callstatusenum = exports.DaysToBeProcessedEnum = void 0;
var DaysToBeProcessedEnum;
(function (DaysToBeProcessedEnum) {
    DaysToBeProcessedEnum["MONDAY"] = "monday";
    DaysToBeProcessedEnum["TUESDAY"] = "tuesday";
    DaysToBeProcessedEnum["WEDNESDAY"] = "wednesday";
    DaysToBeProcessedEnum["THURSDAY"] = "thursday";
    DaysToBeProcessedEnum["FRIDAY"] = "friday";
    DaysToBeProcessedEnum["SATURDAY"] = "saturday";
    DaysToBeProcessedEnum["SUNDAY"] = "sunday";
    DaysToBeProcessedEnum["Quickbase_List_1"] = "\u201CQuickbase_List_1\u201D";
})(DaysToBeProcessedEnum || (exports.DaysToBeProcessedEnum = DaysToBeProcessedEnum = {}));
var callstatusenum;
(function (callstatusenum) {
    callstatusenum["QUEUED"] = "queued";
    callstatusenum["RINGING"] = "ringing";
    callstatusenum["IN_PROGRESS"] = "on call";
    callstatusenum["CALLED"] = "connected-user";
    callstatusenum["BUSY"] = "busy";
    callstatusenum["FAILED"] = "call-failed";
    callstatusenum["VOICEMAIL"] = "connected-voicemail";
    callstatusenum["CANCELED"] = "canceled";
    callstatusenum["NOT_CALLED"] = "not-called";
    callstatusenum["TRANSFERRED"] = "connected-transferred";
    callstatusenum["SCHEDULED"] = "appt-scheduled";
    callstatusenum["NO_ANSWER"] = "not-answered";
    callstatusenum["IVR"] = "connected-ivr";
    callstatusenum["INACTIVITY"] = "inactivity";
    callstatusenum["ERROR"] = "error";
})(callstatusenum || (exports.callstatusenum = callstatusenum = {}));
// export enum callSentimentenum{
//   NOT_INTERESTED = "not-interested",
//   SCHEDULED = "scheduled",
//   CALL_BACK = "call-back",
//   INCOMPLETE_CALL = "incomplete",
//   VOICEMAIL = "voicemail",
//   INTERESTED = "interested",
//   DO_NOT_CALL = "dnc",
//   IVR = "ivr"
// }
var callSentimentenum;
(function (callSentimentenum) {
    callSentimentenum["POSITIVE"] = "positive";
    callSentimentenum["NEGATIVE"] = "negative";
    callSentimentenum["NEUTRAL"] = "neutral";
    callSentimentenum["UNKNOWN"] = "unknown";
    callSentimentenum["SCHEDULED"] = "scheduled";
    callSentimentenum["CALLBACK"] = "call-back";
    callSentimentenum["DNC"] = "dnc";
})(callSentimentenum || (exports.callSentimentenum = callSentimentenum = {}));
var jobstatus;
(function (jobstatus) {
    jobstatus["QUEUED"] = "queued";
    jobstatus["ON_CALL"] = "Calling";
    jobstatus["CALLED"] = "Called";
    jobstatus["CANCELLED"] = "cancelled";
})(jobstatus || (exports.jobstatus = jobstatus = {}));
var DateOption;
(function (DateOption) {
    DateOption["Today"] = "today";
    DateOption["Yesterday"] = "yesterday";
    DateOption["ThisWeek"] = "week";
    DateOption["ThisMonth"] = "month";
    DateOption["PastMonth"] = "past-month";
    DateOption["Total"] = "total";
    DateOption["LAST_SCHEDULE"] = "last-schedule";
})(DateOption || (exports.DateOption = DateOption = {}));
var Category;
(function (Category) {
    Category["UNINTERESTED"] = "not_interested";
    Category["INTERESTED"] = "interested";
    Category["SCHEDULED"] = "meeting_request";
    Category["WRONG"] = "wrong_person";
    Category["OOF"] = "out_of_office";
    Category["INFORMATION"] = "information_request";
    Category["DNC"] = "do_not_contact";
    Category["UNCATEGORIZED"] = "uncategorized";
    Category["SEN_BOUNCED"] = "sender_bounced";
    Category["FUTURE"] = "interested_future";
    Category["AUTO_RESPONSE"] = "automated_response";
})(Category || (exports.Category = Category = {}));
;
var calloutcome;
(function (calloutcome) {
    calloutcome["SUCCESS"] = "successful";
    calloutcome["FAILED"] = "unsuccessful";
    calloutcome["CALL_BACK"] = "call_back";
    calloutcome["VOICEMAIL"] = "voicemail";
    calloutcome["SCHEDULED"] = "appointment";
    calloutcome["TRANSFERRED"] = "call_transfer";
    calloutcome["DNC"] = "dnc";
    calloutcome["WRONG_NUMBER"] = "wrong_number";
    calloutcome["UNKNOWN"] = "unknown";
})(calloutcome || (exports.calloutcome = calloutcome = {}));
;
var CampaignStatus;
(function (CampaignStatus) {
    CampaignStatus["ACTIVE"] = "ACTIVE";
    CampaignStatus["PAUSED"] = "PAUSED";
    CampaignStatus["COMPLETED"] = "COMPLETED";
    CampaignStatus["DRAFTED"] = "DRAFTED";
    CampaignStatus["STOPPED"] = "STOPPED";
    CampaignStatus["ARCHIVED"] = "ARCHIVED";
})(CampaignStatus || (exports.CampaignStatus = CampaignStatus = {}));
;
var ClientType;
(function (ClientType) {
    ClientType["MIXED"] = "mixed";
    ClientType["VOICE"] = "voice";
    ClientType["EMAIL"] = "email";
    ClientType["INBOUND"] = "inbound";
})(ClientType || (exports.ClientType = ClientType = {}));
;
;
