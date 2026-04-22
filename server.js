const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// 🧪 Debug check (remove later if you want)
console.log("API KEY:", API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("WEBHOOK:", DISCORD_WEBHOOK ? "Loaded ✅" : "Missing ❌");

// 🔥 Get live video + start time
async function getLiveVideoDetails(channelId) {
  try {
    // Step 1: Find live video
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${API_KEY}`;
    const searchRes = await axios.get(searchUrl);

    if (searchRes.data.items.length === 0) return null;

    const videoId = searchRes.data.items[0].id.videoId;

    // Step 2: Get live stream details
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`;
    const videoRes = await axios.get(videoUrl);

    const liveDetails = videoRes.data.items[0].liveStreamingDetails;

    // 🛡️ Safe fallback if start time missing
    let startTime;

    if (!liveDetails || !liveDetails.actualStartTime) {
      console.log("⚠️ Start time not available, using fallback");
      startTime = Date.now() - 60000; // assume started 1 min ago
    } else {
      startTime = new Date(liveDetails.actualStartTime).getTime();
    }

    return { videoId, startTime };

  } catch (err) {
    console.error("YouTube API Error:", err.response?.data || err.message);
    throw new Error("YouTube API failed");
  }
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

    // 🎯 Clip last 30 seconds
    const seconds = Math.max(
      0,
      Math.floor((now - data.startTime) / 1000) - 30
    );

    const clipLink = `https://youtube.com/watch?v=${data.videoId}&t=${seconds}s`;

    console.log("🎬 Clip Link:", clipLink);

    // 💬 Send to Discord
    await axios.post(DISCORD_WEBHOOK, {
  embeds: [
    {
      title: "🎬 New Clip Created!",
      description: `🔥 **${user}** clipped:\n> "${title}"\n\n▶ [Watch Clip](${clipLink})`,
      color: 16711680,
      thumbnail: {
        url: `https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg`
      },
      fields: [
        {
          name: "⏱ Timestamp",
          value: `${seconds}s`,
          inline: true
        },
        {
          name: "📺 Channel",
          value: channelId,
          inline: true
        }
      ],
      footer: {
        text: "BiggPoppas Clip Bot 🚀"
      },
      timestamp: new Date()
    }
  ]
});
    res.send("✅ Clip sent to Discord!");

  } catch (err) {
    console.error("FULL ERROR:", err.response?.data || err.message);

    res.send(
      "❌ Error: " +
        (err.response?.data?.error?.message || err.message)
    );
  }
});

// 🧪 Health check
app.get("/", (req, res) => {
  res.send("🚀 Clip Bot Running");
});

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
