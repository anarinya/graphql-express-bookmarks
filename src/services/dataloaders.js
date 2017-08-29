const DataLoader = require('dataloader');

async function batchUsers (Users, keys) {
  try {
    // Fetch group of specified users with IDs identified in keys arg
    return await Users.find({ _id: { $in: keys }}).toArray();
  } catch(e) {
    console.error(`☠️ Error fetching data: batchUsers: ${e}`);
  }
}

async function batchLinks (Links, keys) {
  try {
    return await Links.find({ _id: { $in: keys }}).toArray();
  } catch(e) {
    console.error(`☠️ Error fetching data: batchLinks: ${e}`);
  }
}

module.exports = ({ Users, Links }) => ({
  userLoader: new DataLoader(
    keys => batchUsers(Users, keys),
    // Turn IDs (keys) into strings instead of objects
    // Ensures comparison checks won't fail (object =/= object)
    { cacheKeyFn: key => key.toString() }
  ),
  linkLoader: new DataLoader(
    keys => batchLinks(Links, keys),
    { cacheKeyFn: key => key.toString() }
  )
});