const { MongoClient, Logger } = require('mongodb');

module.exports = async () => {
  try {
    // Attempt connection to mongoDB server
    const db = await MongoClient.connect(process.env.ATLAS_DB);
    console.log(`⚡ MongoDB Connection: Success!`);

    // Logger debugging code
    let logCount = 0;
    Logger.setCurrentLogger((msg, state) => {
      console.log(`Mongo DB Request: ${++logCount}: ${msg}`);
    });
    Logger.setLevel('debug');
    Logger.filter('class', ['Cursor']);
    // Return needed mongo collections for app
    return { 
      Links: db.collection('links'),
      Users: db.collection('users'),
      Votes: db.collection('votes')
    };
  } catch(e) {
    // Catch any mongo errors
    console.error(`☠️ ⚡ : ${e}.`);
  } 
}