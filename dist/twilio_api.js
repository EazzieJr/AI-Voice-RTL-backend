"use strict";
// import twilio, { Twilio } from "twilio";
// import { Request, Response } from "express";
// import { contactModel } from "./contacts/contact_model";
// import expressWs from "express-ws";
// import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
// import { callstatusenum } from "./types";
// import { RegisterCallResponse } from "retell-sdk/resources";
// import Retell from "retell-sdk";
// export class TwilioClient {
//   private twilio: Twilio;
//   private retellClient: Retell;
//   constructor(retellClient: Retell) {
//     this.twilio = twilio(
//       process.env.TWILIO_ACCOUNT_ID,
//       process.env.TWILIO_AUTH_TOKEN,
//     );
//     this.retellClient = retellClient;
//   }
//   // Create a new phone number and route it to use this server.
//   CreatePhoneNumber = async (areaCode: number, agentId: string) => {
//     try {
//       const localNumber = await this.twilio
//         .availablePhoneNumbers("US")
//         .local.list({ areaCode: areaCode, limit: 1 });
//       if (!localNumber || localNumber[0] == null)
//         throw "No phone numbers of this area code.";
//       const phoneNumberObject = await this.twilio.incomingPhoneNumbers.create({
//         phoneNumber: localNumber[0].phoneNumber,
//         voiceUrl: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}`,
//       });
//       console.log("Getting phone number:", phoneNumberObject);
//       return phoneNumberObject;
//     } catch (err) {
//       console.error("Create phone number API: ", err);
//     }
//   };
//   // Update this phone number to use provided agent id. Also updates voice URL address.
//   RegisterPhoneAgent = async (number: string, agentId: string, userId: string) => {
//     try {
//       const phoneNumberObjects = await this.twilio.incomingPhoneNumbers.list();
//       let numberSid;
//       for (const phoneNumberObject of phoneNumberObjects) {
//         if (phoneNumberObject.phoneNumber === number) {
//           numberSid = phoneNumberObject.sid;
//         }
//       }
//       if (numberSid == null) {
//         return console.error(
//           "Unable to locate this number in your Twilio account, is the number you used in BCP 47 format?",
//         );
//       }
//       await this.twilio.incomingPhoneNumbers(numberSid).update({
//         voiceUrl: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}/${userId}`,
//       });
//     } catch (error: any) {
//       console.error("failer to retrieve caller information: ", error);
//     }
//   };
//   // Release a phone number
//   DeletePhoneNumber = async (phoneNumberKey: string) => {
//     await this.twilio.incomingPhoneNumbers(phoneNumberKey).remove();
//   };
//   CreatePhoneCall = async (
//     fromNumber: string,
//     toNumber: string,
//     agentId: string,
//     userId: string
//   ) => {
//     try {
//       await this.twilio.calls.create({
//         machineDetection: "Enable", // detects if the other party is IVR
//         machineDetectionTimeout: 8,
//         asyncAmd: "true", // call webhook when determined whether it is machine
//         asyncAmdStatusCallback: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}/${userId}`, // Webhook url for machine detection
//         url: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}/${userId}`, // Webhook url for registering call
//         to: toNumber,
//         from: fromNumber,
//       });
//       console.log(`Call from: ${fromNumber} to: ${toNumber}`);
//     } catch (error: any) {
//       console.error("failer to retrieve caller information: ", error);
//     }
//   };
//   // Use LLM function calling or some kind of parsing to determine when to let AI end the call
//   EndCall = async (sid: string) => {
//     try {
//       const call = await this.twilio.calls(sid).update({
//         twiml: "<Response><Hangup></Hangup></Response>",
//       });
//     } catch (error) {
//       console.error("Twilio end error: ", error);
//     }
//   };
//   // Use LLM function calling or some kind of parsing to determine when to transfer away this call
//   TransferCall = async (sid: string, transferTo: string) => {
//     try {
//       const call = await this.twilio.calls(sid).update({
//         twiml: `<Response><Dial>${transferTo}</Dial></Response>`,
//       });
//       console.log("Transfer phone call: ", call);
//     } catch (error) {
//       console.error("Twilio transfer error: ", error);
//     }
//   };
//   ListenTwilioVoiceWebhook = (app: expressWs.Application) => {
//     app.post(
//       "/twilio-voice-webhook/:agentId/:userId",
//       async (req: Request, res: Response) => {
//         const agentId = req.params.agentId;
//         const userId = req.params.userId;
//         const { AnsweredBy, from, to, callSid } = req.body;
//         try {
//           // Respond with TwiML to hang up the call if its machine
//           if (AnsweredBy && AnsweredBy === "machine_start") {
//             this.EndCall(req.body.CallSid);
//             const today = new Date();
//             today.setHours(0, 0, 0, 0);
//             const todayString = today.toISOString().split("T")[0];
//           //   const result = await DailyStats.updateOne(
//           //     { myDate: todayString, agentId: agentId },
//           //     { $inc: { callsNotAnswered : 1 } },
//           //     { upsert: true }
//           // );
//           //   await contactModel.findByIdAndUpdate(userId, {
//           //     status: callstatusenum.VOICEMAIL,
//           //     linktocallLogModel: result.upsertedId ? result.upsertedId._id : null,
//           //     answeredByVM: true,
//           //   });
//             return;
//           } else if (AnsweredBy) {
//             return;
//           }
//           const callResponse: RegisterCallResponse =
//             await this.retellClient.call.register({
//               agent_id: agentId,
//               audio_websocket_protocol: "twilio",
//               audio_encoding: "mulaw",
//               sample_rate: 8000,
//               from_number: from,
//               to_number: to,
//               metadata: { twilio_call_sid: callSid },
//               end_call_after_silence_ms: 15000,
//             });
//             await contactModel.findByIdAndUpdate(userId, {
//               callId: callResponse.call_id,
//               status: "ringing",
//             });
//           if (callResponse) {
//             // Start phone call websocket
//             const response = new VoiceResponse();
//             const start = response.connect();
//             const stream = start.stream({
//               url: `wss://api.retellai.com/audio-websocket/${callResponse.call_id}`,
//             });
//             res.set("Content-Type", "text/xml");
//             res.send(response.toString());
//           }
//         } catch (err) {
//           console.error("Error in twilio voice webhook:", err);
//           res.status(500).send();
//         }
//       },
//     );
//   };
// }
