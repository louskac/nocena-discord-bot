// API client for communicating with your Next.js app
const axios = require('axios');

class NocenaApi {
  constructor() {
    this.baseUrl = process.env.NEXT_APP_URL;
    this.apiKey = process.env.NEXT_APP_API_KEY;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey
      }
    });
  }

  // Generate and save an invite code
  async saveInviteCode(inviteData) {
    try {
      const response = await this.client.post('/api/discord/create-invite-code', inviteData);
      return response.data;
    } catch (error) {
      console.error('Error saving invite code:', error);
      throw error;
    }
  }

  // Check if a user has already received an invite code
  async checkUserInviteStatus(discordUserId) {
    try {
      const response = await this.client.get(`/api/discord/user-invite-status?discordUserId=${discordUserId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking user invite status:', error);
      throw error;
    }
  }
}

module.exports = new NocenaApi();