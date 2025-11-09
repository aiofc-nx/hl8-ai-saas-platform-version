/* eslint-disable no-undef */
class RedlockService {
  async using(resources, duration, routine) {
    return routine({ aborted: false });
  }
}

module.exports = { RedlockService };
