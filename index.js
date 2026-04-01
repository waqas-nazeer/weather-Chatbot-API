require('dotenv').config(); 
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const OPENWEATHER_API_KEY = process.env.API_KEY 

app.post('/webhook', async (req, res) => {
    console.log("Request received:", JSON.stringify(req.body, null, 2));

    try {
        const queryResult = req.body.queryResult;
        const parameters = queryResult.parameters || {};
        const session = req.body.session;

        let city = parameters['geo-city'] || parameters.city;
        let date = parameters['date-time'] || parameters.date;

        const weatherContext = (queryResult.outputContexts || []).find(c => c.name.includes('weather-context'));
        const contextParams = weatherContext ? weatherContext.parameters || {} : {};

        if (!city && contextParams.city) city = contextParams.city;
        if (!date && contextParams.date) date = contextParams.date;

        if (!city) {
            return res.json({
                fulfillmentText: "Please tell me the city (e.g., Karachi).",
                outputContexts: [
                    {
                        name: `${session}/contexts/weather-context`,
                        lifespanCount: 3,
                        parameters: { date: date || null }
                    }
                ]
            });
        }

        if (!date) date = new Date().toISOString();
        const formattedDate = new Date(date).toISOString().split('T')[0];

        const weatherData = await getWeather(city, formattedDate);

        return res.json({
            fulfillmentText: weatherData,
            outputContexts: [
                {
                    name: `${session}/contexts/weather-context`,
                    lifespanCount: 0 
                }
            ]
        });

    } catch (err) {
        console.error("Webhook error:", err.message);
        return res.json({  fulfillmentText: "Something went wrong. Please try again."}); 
    }
});

async function getWeather(city, date) {
    try {
        const response = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
            params: {
                q: city,
                appid: OPENWEATHER_API_KEY,
                units: "metric"
            }
        });

        const data = response.data;
         // Invalid city / API issue
        if (data.cod !== "200" || !data.list) return `I couldn't find weather data for "${city}". Please check the city name.`;

        let minTemp = Infinity;
        let maxTemp = -Infinity;
        let description = "";

        for (const entry of data.list) {
            const entryDate = new Date(entry.dt * 1000).toISOString().split('T')[0];
            if (entryDate === date) {
                minTemp = Math.min(minTemp, entry.main.temp_min);
                maxTemp = Math.max(maxTemp, entry.main.temp_max);
                description = entry.weather[0].description;
            }
        }

        if (minTemp === Infinity) return 'Forecast is not available';

        return ` Weather in ${city} on ${date} ${description} with
 Min-temp: ${minTemp.toFixed(1)}°C | Max-temp: ${maxTemp.toFixed(1)}°C`;

    } catch (err) {
        console.error("OpenWeather API error:", err.message);
        return "Weather service is currently unavailable. Please try again later.";;
    }
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));