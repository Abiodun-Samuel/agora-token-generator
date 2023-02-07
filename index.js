require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const cors = require("cors");
const app = express();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
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
  const appid = process.env.APP_ID;
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
  `${process.env.CUSTOMER_KEY}:${process.env.CUSTOMER_SECRET}`
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
  const channel = req.body.channel;
  const uid = req.body.uid;
  const token = req.body.token;

  try {
    const start = await axios.post(
      `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resource}/mode/${mode}/start`,
      {
        cname: channel,
        uid: uid,
        clientRequest: {
          token: token,
          extensionServiceConfig: {
            errorHandlePolicy: "error_abort",
            extensionServices: [
              {
                serviceName: "web_recorder_service",
                errorHandlePolicy: "error_abort",
                serviceParam: {
                  url,
                  audioProfile: 2,
                  videoBitrate: 1500,
                  channelType: 0,
                  videoWidth: 1280,
                  videoHeight: 720,
                  maxRecordingHour: 1,
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

// composite recording
const generateResourceIdComposite = async (req, res) => {
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

const startCompositeRecording = async (req, res) => {
  const appId = process.env.APP_ID;
  const resource = req.body.resource;
  const mode = req.body.mode;
  const url = req.body.url;
  const channel = req.body.channel;
  const uid = req.body.uid;
  const token = req.body.token;

  try {
    const start = await axios.post(
      `https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resource}/mode/${mode}/start`,
      {
        uid: uid,
        cname: channel,
        clientRequest: {
          token: token,
          recordingConfig: {
            maxIdleTime: 30,
            streamTypes: 2,
            audioProfile: 1,
            channelType: 0,
            videoStreamType: 0,
            transcodingConfig: {
              height: 640,
              width: 360,
              bitrate: 500,
              fps: 15,
              mixedVideoLayout: 1,
              backgroundColor: "#FF0000",
            },
            subscribeVideoUids: ["123", "456"],
            subscribeAudioUids: ["123", "456"],
            subscribeUidGroup: 0,
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

const stopCompositeRecording = async (req, res) => {
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

app.get("/", (req, res) => {
  res.send({ name: "Agora Server" });
});

app.get("/rtc/:channel/:role/:tokentype/:uid", nocache, generateRTCToken);
app.post("/acquire", nocache, generateResourceId);
app.post("/start", nocache, startRecording);
app.post("/stop", nocache, stopRecording);
app.post("/query", nocache, queryRecording);

//composite recording
app.post("/acquire-composite-recording", nocache, generateResourceIdComposite);
app.post("/start-composite-recording", nocache, startCompositeRecording);
app.post("/stop-composite-recording", nocache, stopCompositeRecording);

app.listen(process.env.PORT, () => {
  console.log(`Listening on port: ${process.env.PORT}`);
});
