import { google, calendar_v3 } from "googleapis";

const auth = new google.auth.JWT(
  "=",
  undefined,
  "",
  ["https://www.googleapis.com/auth/calendar"],
  "",
);

const calendar = google.calendar({ version: "v3", auth });

export async function createGoogleCalendarEvent() {
  const event: calendar_v3.Schema$Event = {
    summary: "Self-Reminder Event",
    start: {
      dateTime: "2024-09-10T09:00:00-07:00",
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: "2024-09-10T10:00:00-07:00",
      timeZone: "America/Los_Angeles",
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: "email", minutes: 0 }],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendUpdates: "all",
    });
    console.log("Event created:", response.data.htmlLink);
  } catch (err) {
    console.error("Error creating the event:", err);
  }
}
