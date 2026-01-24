import { fetchAsync } from "./http";

export class Telegram {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async sendMessage(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    await fetchAsync(url, 'POST', false, {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'Markdown'
    });
  }
}
