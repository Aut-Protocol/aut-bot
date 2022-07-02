require("dotenv").config();
var ethers = require("ethers");
const axios = require("axios");
const { ipfsCIDToHttpUrl, storeAsBlob } = require("./ipfs.helper");

var pollsAbi = require("./abis/polls.abi.json").abi;
var autIDAbi = require("./abis/autID.abi.json").abi;
var comExtAbi = require("./abis/communityExtension.abi.json").abi;

const provider = new ethers.providers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com/"
);

// Wallet connected to a provider
const senderWalletMnemonic = ethers.Wallet.fromMnemonic(
  process.env.MNEMONIC,
  "m/44'/60'/0'/0/0"
);

let signer = senderWalletMnemonic.connect(provider);

const autIDContract = new ethers.Contract(
  process.env.AUTID_ADDRESS,
  autIDAbi,
  signer
);

const getPollMetadata = async (pollsAddress, pollID) => {
  console.log('getPollMetadata');
  const pollsContract = new ethers.Contract(pollsAddress, pollsAbi, signer);
  const poll = await pollsContract.getById(pollID);
  console.log(poll);
  return poll["pollData"];
};

const finalizePoll = async (
  pollsAddress,
  pollID,
  addresses,
  winner,
  count,
  winnerText
) => {
  console.log("finalizePoll");
  const pollsContract = new ethers.Contract(pollsAddress, pollsAbi, signer);

  const metadataURI = await getPollMetadata(pollsAddress, pollID);
  const metadata = (await axios.get(ipfsCIDToHttpUrl(metadataURI))).data;
  console.log('metadata', metadata);
  const finalizeMetadata = {
    ...metadata,
    winner,
    count,
    winnerText,
  };

  const cid = await storeAsBlob(finalizeMetadata);
  console.log("cid", cid);
  console.log("finalizing", pollsAddress, pollID);
  const finalizeTx = await pollsContract.close(pollID, cid, addresses);

  const finalizeTxResult = await finalizeTx.wait();
  const { events } = finalizeTxResult;
  const eventEmitted = events.find((e) => e.event === "PollClosed");

  console.log("finalizing", pollsAddress, pollID);
  if (eventEmitted) console.log("PollClosed event emitted");
};

const getRoleForCommunity = async (autIDHolder, communityExtension) => {
  const autIDData = await autIDContract.getCommunityData(
    autIDHolder,
    communityExtension
  );
  return +autIDData["role"];
};

const getUserAddressFromDiscordId = async (discordID) => {
  console.log("discordId", discordID);
  // const userAddress = await autIDContract.discordIDToAddress(discordID);
  // console.log('userAddress', userAddress);
  return "0x8195cF28994814206096a4878892f3993955deb1";
};

const getRelevantDiscordIDs = async (
  communityExtensionAddr,
  role,
  discordIDs
) => {
  const relevantDiscordIDs = [];
  console.log("getRelevantDiscordIDs");
  for (i = 0; i < discordIDs.length; i++) {
    const userAddr = await getUserAddressFromDiscordId(discordIDs[i]);
    if (userAddr != ethers.constants.AddressZero) {
      if (role != 0) {
        const userRole = await getRoleForCommunity(
          userAddr,
          communityExtensionAddr
        );
        if (userRole == role) relevantDiscordIDs.push(userAddr);
      } else {
        relevantDiscordIDs.push(userAddr);
      }
    }
  }
};

const getCommunityExtensionFromPolls = async (pollsAddress) => {
  const pollsContract = new ethers.Contract(pollsAddress, pollsAbi, signer);
  const comAddress = await pollsContract.communityExtension();
  return comAddress;
};


const getDiscordServerForComExt = async (comExt) => {
  const communityExtensionContract = new ethers.Contract(comExt, comExtAbi, signer);
  const comData = await communityExtensionContract.getComData();
  return comData['discordServer'];
};

module.exports = {
  getRelevantDiscordIDs,
  getCommunityExtensionFromPolls,
  finalizePoll,
};
