let testNow: Date | null = null;

export const getProjectHelpSessionNow = (): Date => testNow ?? new Date();

export const setProjectHelpSessionNowForTests = (value: Date | null) => {
  testNow = value;
};
