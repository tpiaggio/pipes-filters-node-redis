function toUpperCaseFilter(data) {
  return {
    message: data.message.toUpperCase()
  }
}
function addExclamationFilter(data) {
  return {
    message: `${data.message}!`
  }
}
function trimFilter(data) {
  return {
    message: data.message.trim()
  }
}

module.exports = { toUpperCaseFilter, addExclamationFilter, trimFilter };