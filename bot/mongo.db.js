const { Schema, model } = require("mongoose");

const GuildPerPartner = new Schema({
  guildID: { type: String },
  key: { type: String },
  communityAddress: { type: String },
});

const GuildPerPartnerModel = model("GuildPerPartners", GuildPerPartner);

const Poll = new Schema({
  guildID: { type: String },
  channelID: { type: String },
  messageID: { type: String },
  endDate: { type: String },
  emojis: { type: Array },
  pollsAddress: { type: String },
  pollID: { type: String },
  role: { type: String },
});

const PollModel = model("Poll", Poll);

const getAllPolls = async () => {
  const polls = await PollModel.find().exec();
  return polls;
};

const insertPoll = async (guildID, channelID, messageID, endDate, emojis, pollsAddress, pollID, role) => {
  const guild = new PollModel({
    guildID,
    channelID,
    messageID,
    endDate,
    emojis,
    pollsAddress, 
    pollID,
    role
  });

  return guild.save();
}

const deletePoll = async (id) => {
  await PollModel.deleteOne(id).exec();
};

const addGuild = (guildID, key, communityAddress) => {
  const guild = new GuildPerPartnerModel({
    communityAddress,
    key,
    guildID,
  });

  return guild.save();
};

module.exports = { 
  addGuild,
  getAllPolls,
  insertPoll,
  deletePoll 
};
