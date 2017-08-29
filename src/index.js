const express = require('express');
const { execute, subscribe } = require('graphql');
const { createServer } = require('http');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const bodyParser = require('body-parser');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');

const { authenticate } = require('./services/authentication');
const buildDataLoaders = require('./services/dataloaders');
const formatError = require('./services/formatError');

const schema = require('./schema');

// Set environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const PORT = process.env.PORT || 5000;

// MongoDB connection setup
const connectMongo = require('./services/mongo');

const start = async () => {
  // Create mongo connection and express application
  const mongo = await connectMongo();
  const app = express();

  const buildOptions = async (req, res) => {
    try {
      const user = await authenticate(req, mongo.Users);
      return {
        schema,
        context: { 
          dataloaders: buildDataLoaders(mongo),
          mongo, 
          user,
          formatError
        }
      };
    } catch (e) {
      console.error(`☠️ Error authenticating user: ${e}`);
    }
  };

  // Use bodyParser to convert response data to json and setup graphql
  app.use('/graphql', bodyParser.json(), graphqlExpress(buildOptions));

  // Setup endpoint for graphiql playground environment
  app.use('/graphiql', graphiqlExpress({
    endpointURL: '/graphql',
    passHeader: `'Authorization': 'bearer token-foo@bar.com'`,
    subscriptionsEndpoint: `ws://localhost:${PORT}/subscriptions`
  }));

  const server = createServer(app);

  server.listen(PORT, () => {
    SubscriptionServer.create(
      { execute, subscribe, schema },
      { server, path: '/subscriptions' }
    );

    console.log(`🚀 Graphql server running on port ${PORT}.`);
  });
}

// Begin!
start();