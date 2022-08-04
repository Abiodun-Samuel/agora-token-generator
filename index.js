require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const app = express();
app.use(express.json());

const nocache = (_, resp, next) => {
  resp.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  resp.header("Expires", "-1");
  resp.header("Pragma", "no-cache");
  next();
};

const generateRTCToken = (req, resp) => {
  resp.header("Access-Control-Allow-Origin", "*");
  const channelName = req.params.channel;
  if (!channelName) {
    return resp.status(500).json({ error: "channel is required" });
  }
  let uid = req.params.uid;
  if (!uid || uid === "") {
    return resp.status(500).json({ error: "uid is required" });
  }
  // get role
  let role;
  if (req.params.role === "publisher") {
    role = RtcRole.PUBLISHER;
  } else if (req.params.role === "audience") {
    role = RtcRole.SUBSCRIBER;
  } else {
    return resp.status(500).json({ error: "role is incorrect" });
  }
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === "") {
    expireTime = 72000;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  const appid = process.env.APP_CERTIFICATE;
  let token;
  if (req.params.tokentype === "userAccount") {
    token = RtcTokenBuilder.buildTokenWithAccount(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else if (req.params.tokentype === "uid") {
    token = RtcTokenBuilder.buildTokenWithUid(
      process.env.APP_ID,
      process.env.APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else {
    return resp.status(500).json({ error: "token type is invalid" });
  }
  return resp.json({ token, channelName, uid, appid });
};

const Authorization = `Basic ${Buffer.from(
  `${process.env.CUSTOMERID}:${process.env.CUSTOMER_SECRET}`
).toString("base64")}`;

const generateResourceId = async (req, res) => {
  try {
    const acquire = await axios.post(
      `https://api.agora.io/v1/apps/${process.env.APP_ID}/cloud_recording/acquire`,
      {
        cname: req.body.channel,
        uid: req.body.uid,
        clientRequest: {
          resourceExpiredHour: 24,
          scene: 1,
        },
      },
      { headers: { Authorization } }
    );

    res.send(acquire.data);
  } catch (error) {
    res.send(error);
  }
};

const startRecording = async (req, res) => {
  const appId = process.env.APP_ID;
  const resource = req.body.resource;
  const mode = req.body.mode;
  const url = req.body.url;

  try {
    const start = await axios.post(
      `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resource}/mode/${mode}/start`,
      {
        cname: req.body.channel,
        uid: req.body.uid,
        clientRequest: {
          extensionServiceConfig: {
            errorHandlePolicy: "error_abort",
            extensionServices: [
              {
                serviceName: "web_recorder_service",
                errorHandlePolicy: "error_abort",
                serviceParam: {
                  url,
                  audioProfile: 0,
                  videoWidth: 1280,
                  videoHeight: 720,
                  maxRecordingHour: 3,
                },
              },
            ],
          },
          recordingFileConfig: {
            avFileType: ["hls", "mp4"],
          },
          storageConfig: {
            vendor: Number(process.env.vendor),
            region: Number(process.env.region),
            bucket: process.env.bucket,
            accessKey: process.env.accessKey,
            secretKey: process.env.secretKey,
          },
        },
      },
      { headers: { Authorization } }
    );

    res.send(start.data);
  } catch (error) {
    res.send(error);
  }
};

const stopRecording = async (req, res) => {
  const appId = process.env.APP_ID;
  const resource = req.body.resource;
  const sid = req.body.sid;
  const mode = req.body.mode;

  try {
    const stop = await axios.post(
      `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resource}/sid/${sid}/mode/${mode}/stop`,
      {
        cname: req.body.channel,
        uid: req.body.uid,
        clientRequest: {},
      },
      { headers: { Authorization } }
    );
    res.send(stop.data);
  } catch (error) {
    res.send(error);
  }
};

const queryRecording = async (req, res) => {
  const appId = process.env.APP_ID;
  const resource = req.body.resource;
  const sid = req.body.sid;
  const mode = req.body.mode;

  try {
    const query = await axios.get(
      `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resource}/sid/${sid}/mode/${mode}/query`,
      { headers: { Authorization } }
    );
    res.send(query.data);
  } catch (error) {
    res.send(error);
  }
};

app.get("/", (req, res) => {
  res.send({ name: "Agora Server" });
});

app.get("/rtc/:channel/:role/:tokentype/:uid", nocache, generateRTCToken);
app.post("/acquire", nocache, generateResourceId);
app.post("/start", nocache, startRecording);
app.post("/stop", nocache, stopRecording);
app.post("/query", nocache, queryRecording);

app.listen(process.env.PORT, () => {
  console.log(`Listening on port: ${process.env.PORT}`);
});
