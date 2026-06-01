const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/User");

const getAIHealthAudit = async (req, res) => {
  try {
    // Validate GEMINI_API_KEY
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ message: "Gemini API key is missing in server .env file." });
    }

    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's measurement history with null safety
    const measurementHistory = user.healthMetrics?.measurementHistory || [];
    const weightLogs = user.healthMetrics?.weightLogs || [];
    const bodyFatLogs = user.healthMetrics?.bodyFatLogs || [];
    const muscleMassLogs = user.healthMetrics?.muscleMassLogs || [];

    // Handle empty measurement history gracefully
    if (measurementHistory.length === 0 && weightLogs.length === 0 && bodyFatLogs.length === 0 && muscleMassLogs.length === 0) {
      return res.status(200).json({
        message: "No measurement data available for analysis",
        audit: "You haven't logged any measurements yet. Start tracking your progress to receive personalized AI fitness insights!",
        timestamp: new Date(),
      });
    }

    // Construct the prompt for AI analysis
    let prompt = `You are an expert fitness coach and health analyst. Analyze the following user data and provide personalized fitness feedback.\n\n`;
    
    prompt += `User Profile:\n`;
    prompt += `- Name: ${user.name}\n`;
    prompt += `- Membership Plan: ${user.membershipPlan}\n`;
    prompt += `- Membership Status: ${user.membershipStatus}\n`;
    prompt += `- Fitness Goals: ${user.fitnessGoals || "Not specified"}\n\n`;

    if (measurementHistory.length > 0) {
      prompt += `Body Measurement History:\n`;
      measurementHistory.slice(-5).forEach((entry, index) => {
        prompt += `\nEntry ${index + 1} (${new Date(entry.timestamp).toLocaleDateString()}):\n`;
        prompt += `- Weight: ${entry.weight} kg\n`;
        prompt += `- Body Fat: ${entry.bodyFat}%\n`;
        prompt += `- Muscle Mass: ${entry.muscleMass} kg\n`;
        prompt += `- Chest: ${entry.chest} cm\n`;
        prompt += `- Shoulders: ${entry.shoulders} cm\n`;
        prompt += `- Waist: ${entry.waist} cm\n`;
        prompt += `- Hips: ${entry.hips} cm\n`;
        prompt += `- Left Bicep: ${entry.leftBicep} cm\n`;
        prompt += `- Right Bicep: ${entry.rightBicep} cm\n`;
        prompt += `- Left Thigh: ${entry.leftThigh} cm\n`;
        prompt += `- Right Thigh: ${entry.rightThigh} cm\n`;
      });
    }

    if (weightLogs.length > 0) {
      prompt += `\nWeight Progress:\n`;
      weightLogs.slice(-5).forEach((log, index) => {
        prompt += `- ${new Date(log.date).toLocaleDateString()}: ${log.weight} kg\n`;
      });
    }

    if (bodyFatLogs.length > 0) {
      prompt += `\nBody Fat Progress:\n`;
      bodyFatLogs.slice(-5).forEach((log, index) => {
        prompt += `- ${new Date(log.date).toLocaleDateString()}: ${log.bodyFat}%\n`;
      });
    }

    if (muscleMassLogs.length > 0) {
      prompt += `\nMuscle Mass Progress:\n`;
      muscleMassLogs.slice(-5).forEach((log, index) => {
        prompt += `- ${new Date(log.date).toLocaleDateString()}: ${log.muscleMass} kg\n`;
      });
    }

    prompt += `\n\nPlease provide:\n`;
    prompt += `1. A brief assessment of their current fitness level\n`;
    prompt += `2. Key observations from their measurement trends\n`;
    prompt += `3. 3-5 specific, actionable recommendations for improvement\n`;
    prompt += `4. Any areas of concern or positive progress to highlight\n`;
    prompt += `5. A motivational closing statement\n\n`;
    prompt += `Keep the response concise, professional, and encouraging. Format with clear sections.`;

    // Initialize Gemini AI with validation
    let genAI;
    try {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (initError) {
      console.error("Gemini AI Initialization Error:", initError);
      return res.status(500).json({ message: "Failed to initialize AI service. Please check API configuration." });
    }

    // Call Gemini AI with robust error handling
    let model, result, response, text;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
      response = await result.response;
      text = response.text();
    } catch (aiError) {
      console.error("Gemini API Call Error:", aiError);
      return res.status(500).json({ message: "Failed to generate AI analysis. Please try again later." });
    }

    return res.status(200).json({
      message: "AI health audit generated successfully",
      audit: text,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("AI Controller Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAIHealthAudit,
};
