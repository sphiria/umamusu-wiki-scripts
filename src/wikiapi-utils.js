// updateTokenWithParams takes a template token and updated param object
// and updates the token with it
const updateTokenWithParams = (token, params) => {
  const keys = Object.keys(params);
  for (let i=0; i<keys.length; i++) {
    token[i+1] = `${keys[i]}=${params[keys[i]]}\n`;
  }
};

// export
module.exports = {
  updateTokenWithParams,
};
