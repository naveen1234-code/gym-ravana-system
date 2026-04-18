const triggerDoorOpen = async ({
  sessionId,
  userId,
  userName,
  accessPoint = "main-door",
  action = "unlock",
}) => {
  try {
    const mode = process.env.DOOR_MODE || "mock";

    if (mode === "mock") {
      console.log(
        `🚪 MOCK DOOR OPEN -> session: ${sessionId} | user: ${userName} (${userId}) | accessPoint: ${accessPoint}`
      );

      return {
        success: true,
        mode: "mock",
        message: "Mock door unlock triggered successfully",
      };
    }

    if (mode === "esp32") {
      const controllerUrl = process.env.ESP32_DOOR_URL;

      if (!controllerUrl) {
        return {
          success: false,
          mode: "esp32",
          message: "ESP32_DOOR_URL is not configured",
        };
      }

      const response = await fetch(controllerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.ESP32_SHARED_SECRET
            ? { "x-door-secret": process.env.ESP32_SHARED_SECRET }
            : {}),
        },
        body: JSON.stringify({
          action,
          sessionId,
          userId,
          userName,
          accessPoint,
          requestedAt: new Date().toISOString(),
        }),
      });

      console.log("ESP32 REQUEST BODY:", {
  action,
  sessionId,
  userId,
  userName,
  accessPoint,
  controllerUrl,
  secretPresent: !!process.env.ESP32_SHARED_SECRET,
});

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      console.log("ESP32 RESPONSE:", {
  ok: response.ok,
  status: response.status,
  data,
});

      if (!response.ok) {
        return {
          success: false,
          mode: "esp32",
          message:
            data?.message || `ESP32 unlock request failed with ${response.status}`,
        };
      }

      return {
        success: true,
        mode: "esp32",
        message: data?.message || "ESP32 unlock triggered successfully",
      };
    }

    return {
      success: false,
      mode,
      message: `Unsupported door mode: ${mode}`,
    };
  } catch (error) {
    console.error("DOOR TRIGGER ERROR:", error.message);

    return {
      success: false,
      mode: process.env.DOOR_MODE || "mock",
      message: error.message,
    };
  }
};

module.exports = triggerDoorOpen;