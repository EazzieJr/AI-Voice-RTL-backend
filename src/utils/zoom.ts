import axios, { AxiosError, AxiosResponse } from "axios";

let accessToken: string | null = null;
let tokenExpiryTime: number | null = null;

export async function generateZoomAccessToken(
  clientId: string,
  clientSecret: string,
  accountId: string,
): Promise<void> {
  const credentials = `${clientId}:${clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString("base64");
  console.log(encodedCredentials)
  console.log(credentials)

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${encodedCredentials}`,
  };

  const body = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: accountId,
  });

  try {
    const response: AxiosResponse = await axios.post(
      "https://zoom.us/oauth/token",
      body,
      { headers },
    );
    accessToken = response.data.access_token;
    tokenExpiryTime = Date.now() + response.data.expires_in * 1000;
    console.log("Access token generated successfully");
  } catch (error) {
    handleAxiosError(error);
    throw error;
  }
}
async function refreshTokenIfNeeded(
  clientId: string,
  clientSecret: string,
  accountId: string,
): Promise<void> {
  if (
    !accessToken ||
    (tokenExpiryTime && Date.now() > tokenExpiryTime - 5 * 60 * 1000)
  ) {
    // 5 minutes before expiration
    console.log(
      "Token is nearing expiration or not available, refreshing token...",
    );
    await generateZoomAccessToken(clientId, clientSecret, accountId);
  }
}
export async function getUserId(
  email: string,
  clientId: string,
  clientSecret: string,
  accountId: string,
): Promise<string> {
  await refreshTokenIfNeeded(clientId, clientSecret, accountId);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const response: AxiosResponse = await axios.get(
      `https://api.zoom.us/v2/users/${email}`,
      { headers },
    );
    const userId = response.data.id;
    return userId;
  } catch (error) {
    handleAxiosError(error);
    throw error;
  }
}
interface Segment {
  start: string;
  end: string;
}
interface SegmentsRecurrence {
  [day: string]: Segment[];
}
const dayNames: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday'
};

function handleAxiosError(error: unknown): void {
  if (axios.isAxiosError(error)) {
    console.error("Error:", error.response?.data || error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}

export async function checkAvailability(
  clientId: string,
  clientSecret: string,
  accountId: string,
  availabilityId: string // Add this parameter for the rule ID you want to match
): Promise<any> {
  await refreshTokenIfNeeded(clientId, clientSecret, accountId);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const ruleId = "ew0j54606f4jdw4aiegxbzr1e0"
  try {
    const response = await axios.get(
      `https://api.zoom.us/v2/scheduler/availability/${availabilityId}`,
      { headers }
    );

    
    const availabilityRules = response.data.segments_recurrence;

    // if (availabilityRules && availabilityRules.length > 0) {
    //   // Find the rule with the matching 'availability_id'
    //   const matchingRule = availabilityRules.find(
    //     (rule: any) => rule.availability_id === ruleId
    //   );

    //   if (matchingRule) {
    //     // Return the segments_recurrence as it is
    //     return matchingRule.segments_recurrence;
    //   } else {
    //     throw new Error(`No availability rule found for ID: ${ruleId}`);
    //   }
    // } else {
    //   throw new Error('No availability rules found');
    // }
    return availabilityRules
  } catch (error) {
    handleAxiosError(error);
    throw error;
  }
}

export async function scheduleMeeting(
  clientId: string,
  clientSecret: string,
  accountId: string,
  userId: string,
  startTime: string,
  duration: number,
  topic: string,
  agenda: string,
  invitee: string,
  firstname: string,
  lastname: string
): Promise<any> {
  await refreshTokenIfNeeded(clientId, clientSecret, accountId);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const meetingDetails = {
    topic: topic,
    type: 2, 
    start_time: startTime,
    duration: duration,
    timezone: 'UTC',
    agenda: agenda,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      approval_type: 0, 
      registration_type: 1, 
      enforce_login: false,
      auto_recording: 'none',
      registrants_email_notification: true,
  }

  };

  if(!lastname){
    lastname = "."
  }
  const registrantDetails = {
    email: invitee,
    first_name: firstname,
    last_name: lastname
};


  try {
    const response: AxiosResponse = await axios.post(
      `https://api.zoom.us/v2/users/${userId}/meetings`,
      meetingDetails,
      { headers }
    );
    const meetingId = response.data.id

    const registrantResponse = await axios.post(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, registrantDetails, {
      headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
      }
  });
    return response.data.settings;
  } catch (error) {
    handleAxiosError(error);
    throw error;
  }

  
}

export async function getAllSchedulesWithAvailabilityId(
  clientId: string,
  clientSecret: string,
  accountId: string
): Promise<string[]> {
  await refreshTokenIfNeeded(clientId, clientSecret, accountId);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const response: AxiosResponse<{
      schedules: Array<{ availability_id: string }>;
    }> = await axios.get(
      `https://api.zoom.us/v2/scheduler/schedules/ycj1oinx0vuizzajmuny2nrs30`,
      { headers }
    );

    console.log(response.data)
    // Extract availability IDs from the response
    const availabilityIds = response.data.schedules.map(
      (schedule) => schedule.availability_id
    );

    return availabilityIds;
  } catch (error) {
    handleAxiosError(error);
    throw error;
  }
}


