const axios = require('axios');
require('dotenv').config();

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Create and export the instance directly
const telegramApi = {
    async get(method, params) {
        try {
            const response = await axios.get(`${BASE_URL}/${method}`, {
                params
            });
            return response.data;
        } catch (error) {
            console.error(`Error in GET ${method}:`, error.message);
            throw error;
        }
    },
    async post(method, data) {
        try {
            const response = await axios.post(`${BASE_URL}/${method}`, data);
            return response.data;
        } catch (error) {
            console.error(`Error in POST ${method}:`, error.message);
            throw error;
        }
    }
};

module.exports = telegramApi; 


