require("dotenv").config();

// imports
const { Client, MessageEmbed, Intents } = require("discord.js");
const {
  finalizePoll,
  getRelevantDiscordIDs,
  getCommunityExtensionFromPolls,
} = require("./api");
const { config } = require("./config");
const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const {
  insertPoll,
  getAllPolls,
  deletePoll,
} = require("./mongo.db");
const { connect } = require("mongoose");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/poll", (req, res) => postPoll(req, res));

app.listen(6005, () => {
  connect(process.env.MONGODB_CONNECTION_STRING);
  console.log(`AutID Discord Bot listening on port 6005`);
});

// constants
const {
  messages: { prefixes },
  roles: { colors },
} = config;

// init
const bot = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
});
// setInterval(() => closePolls(), 1000 * 60 * 60 * 24); // 24 hours!
// setInterval(() => closePolls(), 1000 * 60); // 1 minute!
bot.login(process.env.TOKEN);

// events actions
bot.on("ready", () => {
  console.info(`Logged in as ${bot.user.tag}!`);
  closePolls();
});

// message
bot.on("messageCreate", async (msg) => {
  if (msg.content === prefixes.swHelp) {
    const reply = new MessageEmbed().setTitle("Help").addField(
      "/setup {key}",
      `The first thing you need to do is enter \`/setup {key}\` with a *key* parameter
        to connect your discord server and community, otherwise the bot will not work.`
    );

    msg.channel.send({ embeds: [reply] });
  }
});

async function postPoll(req, res) {
  const poll = {
    message: {
      title: "Do you want us to implement Polls?",
      description:
        "\n          Everyone from a specific role would be able to vote to \n          achieve truly decentralized communities!\n          \nYes 👍\nNo 👎\n          ",
      fields: [
        {
          name: "Poll Duration",
          value: "1w",
          inline: true,
        },
        {
          name: "Role",
          value: "All",
          inline: true,
        },
      ],
      author: {
        name: "Taulant",
        icon_url:
          "https://ipfs.io/ipfs/bafybeiaok5esvbdym2othwvxt2wcsanrd4bmyu64p7f25gg7dvtp6bbodq",
      },
      footer: {
        text: "Latest Community@AutID",
        icon_url:
          "https://ipfs.io/ipfs/bafybeianskdviohbyp2yi7jty55sisrbbmm2jj5xz3dook3jigvvltumji/images.jpeg",
      },
    },
    roleName: "All",
    duration: "1w",
    emojis: ["👍", "👎"],
    pollsAddress: "0x270e27E4E6422C311449E9aA258B3181235837ce",
    pollID: 2,
    role: 0,
  };

  // TODO: validate if poll exists 
  // TODO: if not - don't publish and save info 
  // TODO: return bad request
  res.sendStatus(200);

  const communityExtension = await getCommunityExtensionFromPolls(poll.pollsAddress);
  const guildId = await getDiscordServerForComExt(communityExtension);
  const guild = await bot.guilds.cache.find((guild) => guild.id == guildId);
  const channel = guild.channels.cache.find((c) => c.name == "general");

  // publish a poll
  const pollContent = new MessageEmbed()
    .setTitle(poll.message.title)
    .setDescription(
      `${poll.message.description}\n\nThis poll expires in ${poll.duration}\nRoles: ${poll.roleName}`
    );
  channel
    .send({ embeds: [pollContent] }) // Use a 2d array?
    .then(async function (message) {
      let reactionArray = [];
      for (let i = 0; i < poll.emojis.length; i++) {
        reactionArray[i] = await message.react(poll.emojis[i]);
      }

      const date = new Date();
      let daysToAdd = 0;

      switch (poll.duration) {
        case "1d":
          daysToAdd = 1;
          break;
        case "1w":
          daysToAdd = 7;
          break;
        case "1m":
          daysToAdd = 30;
          break;
      }
      var endDate = date.setDate(date.getDate() + daysToAdd);

     insertPoll(
        guildId,
        channel.id,
        message.id,
        endDate,
        poll.emojis,
        poll.pollsAddress,
        poll.pollID,
        poll.role
      );
    })
    .catch(console.error);
}
async function closePolls() {
  console.log("closePolls");

  const polls = await getAllPolls();
  polls.forEach(async (poll) => {
    console.log(poll.endDate);
    console.log(Date.now());
    console.log(poll.endDate < Date.now());
    if (poll.endDate < Date.now()) {
      const guild = await bot.guilds.fetch(poll.guildID);
      const channel = await guild.channels.fetch(poll.channelID);

      const message = await channel.messages.fetch(poll.messageID);

      let reactionWinnerCount = -1;
      let reactionWinnerIndex = 0;
      for (let i = 0; i < poll.emojis.length; i++) {
        console.log("getting community extension");
        console.log("polls addr", poll.pollsAddress);
        const communityExtension = await getCommunityExtensionFromPolls(
          poll.pollsAddress
        );
        console.log("communityExtension", communityExtension);
        // console.log("relevantDiscordIds", relevantDiscordIds);
        const userReactionsMapping = await message.reactions
          .resolve(poll.emojis[i])
          .users.fetch();
        var reactedUserIds = Array.from(userReactionsMapping.keys());

        console.log("getting relevant discord Ids");
        const relevantDiscordIds =
          (await getRelevantDiscordIDs(
            communityExtension,
            poll.role,
            reactedUserIds
          )) ?? [];

        console.log("relevantDiscordIds", relevantDiscordIds);

        const relevantReactions = reactedUserIds.filter((value) =>
          relevantDiscordIds.includes(value)
        );

        if (reactionWinnerCount < relevantReactions.length) {
          reactionWinnerCount = relevantReactions.length;
          reactionWinnerIndex = i;
        }

        // finalize poll onchain
        await finalizePoll(
          poll.pollsAddress,
          poll.pollID,
          [],
          poll.emojis[reactionWinnerIndex],
          reactionWinnerCount
        );
      }

      // close Poll
      const pollContent = message.embeds[0];

      console.log("reactionWinnerCount", reactionWinnerCount);
      console.log("reactionWinnerIndex", reactionWinnerIndex);
      console.log(poll.emojis[reactionWinnerIndex]);

      let winnersText;
      if (reactionWinnerCount == 1) {
        winnersText = "No one voted!";
      } else {
        winnersText =
          poll.emojis[reactionWinnerIndex] +
          " (" +
          (reactionWinnerCount - 1) +
          " votes)\n";
      }
      pollContent.addField("**Winner:**", winnersText);
      pollContent.setTimestamp();
      channel.send({ embeds: [pollContent] });

      deletePoll(poll._id);
    }
  });
}
