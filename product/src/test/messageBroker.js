// src/lib/rabbit.js
const amqplib = require('amqplib');

let channel = null;

class MessageBroker {
    constructor() {
        this.channel = null;
    }


  async connect(url) {
  const conn = await amqplib.connect(url);
  channel = await conn.createChannel();
  return channel;
}

async publishMessage(exchange, routingKey, message) {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  const payload = Buffer.from(JSON.stringify(message));
  return channel.publish(exchange, routingKey, payload);
}

async consumeMessage(queue, onMessage) {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  await channel.assertQueue(queue, { durable: true });
  await channel.consume(queue, msg => {
    if (!msg) return;
    const content = JSON.parse(msg.content.toString());
    onMessage(content, msg);
    channel.ack(msg);
  });
}
}
module.exports = new MessageBroker();
