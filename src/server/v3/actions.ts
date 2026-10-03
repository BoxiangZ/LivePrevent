export const recommendedAction = (type: string, level?: string) =>
  level === "critical"
    ? "Contact the person immediately to check their current condition. If this appears to be an emergency, contact local emergency services."
    : type === "possible_fall"
      ? "Contact the selected person to check their condition."
      : type === "device_data_gap"
        ? "Check the device battery and connection."
        : "Review the observations and check in with the selected person.";
