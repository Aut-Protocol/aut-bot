const { Blob } = require("node:buffer");
const { NFTStorage } = require("nft.storage");
const client = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

const storeAsBlob = async (json) => {
  console.log(json)
  const encodedJson = new TextEncoder().encode(JSON.stringify(json));
  const blob = new Blob([encodedJson], {
    type: "application/json;charset=utf-8",
  });
  const cid = await client.storeBlob(blob);
  return cid;
};

function ipfsCIDToHttpUrl(cid) {
  return `https://ipfs.io/ipfs/${cid}`
}

module.exports = {
  storeAsBlob,
  ipfsCIDToHttpUrl,
};
