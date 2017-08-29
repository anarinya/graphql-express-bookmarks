const { ObjectID } = require('mongodb');
const { URL } = require('url');
const pubsub = require('../services/pubsub');

// Static mock data
const links = [{
  id: 1,
  url: 'http://graphql.org/',
  description: 'The Best Query Language'
}, {
  id: 2,
  url: 'http://dev.apollodata.com',
  description: 'Awesome GraphQL Client'
}];

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

function assertValidLink ({ url }) {
  try { 
    // Attempt to convert the given url string into a proper url
    new URL(url); 
  } catch (e) {
    throw new ValidationError('Link validation error: invalid url.', 'url');
  }
}

function buildFilters({ OR = [], description_contains, url_contains, }) {
  const filter = (description_contains || url_contains) ? {} : null;
  if (description_contains) {
    filter.description = { $regex: `.*${ description_contains }.*`};
  }
  if (url_contains) {
    filter.url = { $regex: `.*${ url_contains }.*` };
  }

  let filters = filter ? [ filter ] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildFilters(OR[i]));
  }
  return filters;
}

// root: 1st arg, current data for object returned by other resolvers, null for queries and mutations
// context: 3rd arg, contains mongo collection data
module.exports = {
  Query: {
    allLinks: async (root, {filter, first, skip}, { mongo: { Links, Users }}) => {
      try {
        // Add filters to query if they are available
        let query = filter ? { $or: buildFilters(filter) } : {};
        // Query data
        const cursor = Links.find(query);
        // Pagination
        if (first) cursor.limit(first);
        if (skip) cursor.skip(skip);
        // Return an array of all links
        return cursor.toArray();
      } catch(e) {
        console.error(`☠️ MongoDB Query Error: ${e}`);
      }
    }
  },
  Mutation: {
    createLink: async (root, data, { mongo: { Links }, user }) => {
      // Ensure given link is a valid URL
      assertValidLink(data);
      try {
        const newLink = Object.assign({ postedById: user && user._id }, data);
        // Attempt to insert new link data into the database
        const response = await Links.insert(newLink);
        // Set new link's ID to one created by the db
        newLink.id = response.insertedIds[0];
        // Trigger subscription on creation of new links
        pubsub.publish('Link', { Link: { mutation: 'CREATED', node: newLink }});
        // Return new link's information
        return newLink;
      } catch(e) {
        throw new Error(`☠️ createLink: ${e}`);
      }
    },
    createVote: async (root, data, { mongo: { Votes }, user }) => {
      try {
        // Create a new vote with the current user and link
        const newVote = {
          userId: user && user._id,
          linkId: new ObjectID(data.linkId)
        };
        // Attempt to insert new vote into the database
        const response = await Votes.insert(newVote);
        // Return a new object with the vote's new ID and data
        return Object.assign({ id: response.insertedIds[0]}, newVote);
      } catch(e) {
        console.error(`☠️ MongoDB Insert Error: createVote: ${e}`);
      }
    },
    createUser: async (root, data, { mongo: { Users }}) => {
      try {
        const newUser = {
          name: data.name,
          email: data.authProvider.email.email,
          password: data.authProvider.email.password
        };
        // Attempt to insert new user data into the database
        const response = await Users.insert(newUser);
        // Return a new object with the new user's ID and data
        return Object.assign({ id: response.insertedIds[0] }, newUser);
      } catch(e) {
        console.error(`☠️ MongoDB Insert Error: createUser: ${e}`);
      }
    },
    signinUser: async (root, data, { mongo: { Users }}) => {
      try {
        const user = await Users.findOne({ email: data.email.email });
        if (data.email.password === user.password) {
          return { token: `token-${user.email}`, user};
        } 
        console.error(`Password incorrect.`);
      } catch(e) {
        console.error(`☠️ MongoDB Search Error: signinUser: ${e}`);
      }
    }
  },
  Subscription: {
    Link: {
      subscribe: () => pubsub.asyncIterator('Link')
    }
  },
  Link: {
    // Use the mongo ID if available
    id: root => root._id || root.id,
    // Fetch and return correct user information for link author
    postedBy: async ({ postedById }, data, { dataloaders: { userLoader }}) => {
      try {
        // Return user information for link author
        return await userLoader.load(postedById);
      } catch(e) {
        console.error(`☠️ Error resolving Link.postedBy: ${e}`);
      }
    },
    votes: async ({ _id }, data, { mongo: { Votes }}) => {
      try {
        // Find votes associated with link
        return await Votes.find({ linkId: _id }).toArray();
      } catch(e) {
        console.error(`☠️ Error resolving Link.votes: ${e}`);
      }
    }
  },
  User: {
    // Use the mongo ID if available
    id: root => root._id || root.id,
    votes: async ({ _id }, data, { mongo: { Votes }}) => {
      try {
        // Find specified user's votes
        return await Votes.find({ userId: _id }).toArray();
      } catch(e) {
        console.error(`☠️ Error resolving User.votes: ${e}`);
      }
    }
  },
  Vote: {
    // Use the mongo ID if available
    id: root => root._id || root.id,
    user: async ({ userId }, data, { dataloaders: { userLoader }}) => {
      try {
        // Find user details of the user that voted
        return await userLoader.load(userId);
      } catch(e) {
        console.error(`☠️ Error resolving Vote.user: ${e}`);
      }
    },
    link: async ({ linkId }, data, { dataloaders: { linkLoader }}) => {
      try {
        // Find link details of the link that was voted on
        //return await Links.findOne({ _id: linkId });
        return await linkLoader.load(linkId);
      } catch(e) {
        console.error(`☠️ Error resolving Vote.link: ${e}`);
      }
    }
  }
};