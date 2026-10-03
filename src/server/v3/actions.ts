export const recommendedAction = (type: string) =>
  type === "possible_fall"
    ? "Contact the selected person to check their condition."
    : type === "device_data_gap"
      ? "Check the device battery and connection."
      : "Review the observations and check in with the selected person.";
