const { formatError } = require('graphql');

module.exports = error => {
  const data = formatError(error);
  const { originalError } = error;
  // Add the name of the field that errored
  data.field = originalError && originalError.field;
  // Return the formatted error and field name
  return data;
}