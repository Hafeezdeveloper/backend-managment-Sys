exports.successHandler = (status = 200, data = {}, message = "Success") => {
  return { success: true, message, data, status };
};

exports.failureHandler = (status = 400, message = "Something went wrong", error = null) => {
  return { success: false, message, error, status };
};
