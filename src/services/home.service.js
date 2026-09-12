import { API_VERSION } from '../constants/api.js'

export function createHomeService() {
  function getWelcome() {
    return {
      message: 'Welcome to the Avengers API',
      version: API_VERSION,
    }
  }

  return { getWelcome }
}
