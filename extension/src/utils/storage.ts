export const storage = {
  async get(key: string): Promise<any> {
    if (!chrome.storage) return null;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  },
  async set(key: string, value: any): Promise<void> {
    if (!chrome.storage) return;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
};
