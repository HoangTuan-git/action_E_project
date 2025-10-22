const amqp = require("amqplib");
const config = require("../config");
class MessageBroker {
  constructor() {
    this.channel = null;
  }

  async connect(maxRetries = 5, baseDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Connecting to RabbitMQ... (${attempt}/${maxRetries})`);
        
        this.connection = await amqp.connect(config.rabbitMQURI);
        this.channel = await this.connection.createChannel();
        
        await this.channel.assertQueue(config.queueNameProduct, { durable: true });
        await this.channel.assertQueue(config.queueNameOrder, { durable: true });
        
        console.log("RabbitMQ connected successfully");
        return;
        
      } catch (error) {
        console.error(`Connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect after ${maxRetries} attempts`);
        }
        
        // Exponential backoff: 2s, 4s, 8s, 16s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async publishMessage(queue, message) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return;
    }

    try {
      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message))
      );
    } catch (err) {
      console.log(err);
    }
  }

  async consumeMessage(queue, callback) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return;
    }

    try {
      await this.channel.consume(queue, (message) => {
        const content = message.content.toString();
        const parsedContent = JSON.parse(content);
        callback(parsedContent);
        this.channel.ack(message);
      });
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = new MessageBroker();
