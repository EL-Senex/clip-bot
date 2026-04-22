const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// 🧠 Format seconds → HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hrs > 0 ? hrs : null,
    mins.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0"),
  ]
    .filter(v => v !== null)
    .join(":");
}


async function getLiveVideoDetails(channelId) {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`;
  const searchRes = await axios.get(searchUrl);

  if (searchRes.data.items.length === 0) return null;

  const videoId = searchRes.data.items[0].id.videoId;

  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`;
  const videoRes = await axios.get(videoUrl);

  const liveDetails = videoRes.data.items[0].liveStreamingDetails;

  let startTime;

  if (!liveDetails || !liveDetails.actualStartTime) {
    startTime = Date.now() - 60000;
  } else {
    startTime = new Date(liveDetails.actualStartTime).getTime();
  }

  return { videoId, startTime };
}

// 🎬 Clip endpoint
app.get("/clip", async (req, res) => {
  const channelId = req.query.channelId;
  const user = req.query.user || "Someone";
  const title = decodeURIComponent(req.query.title || "a moment");

  if (!channelId) {
    return res.send("❌ Missing channelId");
  }

  try {
    const data = await getLiveVideoDetails(channelId);

    if (!data) {
      return res.send("❌ No live stream found");
    }

    const now = Date.now();

    
    const seconds = Math.max(
      0,
      Math.floor((now - data.startTime) / 1000) - 30
    );

    const formattedTime = formatTime(seconds);

    const clipLink = `https://youtube.com/watch?v=${data.videoId}&t=${seconds}s`;

    console.log("🎬 Clip:", clipLink);

    // 💬 Discord Embed (PRO UI)
   await axios.post(DISCORD_WEBHOOK, {
  embeds: [
    {
      title: `🎬 ${title}`, // clip name at top

      description: 
`▶ **[Watch from ${formattedTime}](${clipLink})**
👤 Clipped by **${user}**`,

      color: 0xff0000,

      // ✅ THIS MAKES IMAGE BIG & CENTER
      image: {
        url: `https://img.youtube.com/vi/${data.videoId}/maxresdefault.jpg`
      },

      footer: {
        text: "BiggPoppas Clip Bot 🚀"
      },

      timestamp: new Date()
    }
  ]
});
    res.send(`🔥 ${user} clipped "${title}" Clip sent to discord ✅`);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.send("❌ Error creating clip");
  }
});

// health check
app.get("/", (req, res) => {
  res.send("🚀 Clip Bot Running");
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
