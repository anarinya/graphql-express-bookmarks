const HEADER_REGEX = /bearer token-(.*)$/;

// Simple token, switch to use JWT before using in production
module.exports.authenticate = async ({ headers: { authorization }}, Users) => {
  try {
    const email = authorization && HEADER_REGEX.exec(authorization)[1];
    return email && await Users.findOne({ email });
  } catch(e) {
    console.error(`☠️ Error with authentication: ${e}`);
  }
};