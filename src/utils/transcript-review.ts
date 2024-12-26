import { format } from "date-fns";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

export const reviewTranscript = async (transcript: string) => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `You are an expert data analyst specializing in sentiment analysis of call transcripts between AI agents and leads. Your task is to accurately categorize each conversation based on the lead's responses. Please use one of the following categories:

Categories:
interested: The lead either clearly expresses interest—agreeing to book an appointment or actively discussing next steps—or requests a follow-up, suggesting the agent call back later or follow up in the future.
not-interested: The lead explicitly says they are no longer interested, have found a solution, or expresses disinterest.
scheduled: The lead confirms a specific time for an appointment or meeting.
incomplete: The call ends abruptly, or the lead cannot be reached before answering any key questions.
voicemail: Based on the content of this call transcript, identify whether this is an AM/VM (Answering Machine/Voice Mail)
dnc: The lead explicitly says they never want to be called back again or ask to be removed from the list and not be called again
ivr: Based on the content of this call transcript, identify whether this is an IVR (Interactive Voice Response) system.
Instructions

Analyze the transcript below and assign it the most fitting category based on the lead's responses.
If the transcript is empty or missing, respond with N/A.
Respond only with the appropriate category without any additional explanation.
Transcript: ${transcript}`,
        },
      ],
      // model: "gpt-4-turbo-preview",
      model: "gpt-4o-mini", 
    });

    return completion.choices[0];
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};



export const reviewCallback = async (transcript: string): Promise<string> => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Extract only the callback date mentioned in this transcript. If the client explicitly mentions a callback date or time, return it in the format YYYY-MM-DD. If no callback date or time is mentioned, return the date of the Monday two weeks from today, in the same format YYYY-MM-DD. Transcript: ${transcript}`,
        },
      ],
      model: "gpt-4o-mini",
    });

    const extractedDate = completion.choices[0].message.content.trim();

    // If no date is found, calculate the Monday two weeks from today
    if (!extractedDate) {
      const currentDate = new Date();
      const nextMonday = new Date(
        currentDate.setDate(
          currentDate.getDate() + ((1 - currentDate.getDay() + 7) % 7 || 7) + 14
        )
      );
      return format(nextMonday, "yyyy-MM-dd");
    }

    // Ensure the date is in the correct format and return it
    return extractedDate;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};

