// webhook-receiver/src/index.js - Public-facing endpoint for TradingView
import { Router } from 'itty-router';
const router = Router();

// ES Module format requires a default export
export default {
  async fetch(request, env) {
    return await handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  // Handle TradingView webhook
  if (request.method === 'POST') {
    try {
      const data = await request.json();

      // Extract authentication from the payload itself
      const { apiKey, exchange, action, symbol, quantity, price, leverage, notify } = data;

      // Validate the API key with a secure comparison
      const isValid = await validateApiKey(apiKey, env);

      if (!isValid) {
        // Don't reveal the reason for security
        return new Response(JSON.stringify({
          success: false,
          worker: 'webhook-receiver',
          error: 'Authentication failed'
        }), { status: 403 });
      }

      // Remove the API key from the data before forwarding
      delete data.apiKey;

      // Generate tracking ID
      const requestId = crypto.randomUUID();

      // Process trading signal if present
      let tradeResult = null;
      let tradeWorkerInfo = null;
      if (exchange && action && symbol && quantity) {
        // Forward to trade worker
        const tradeResponse = await processTrade({
          requestId,
          exchange,
          action,
          symbol,
          quantity,
          price,
          leverage
        }, env);
        tradeResult = tradeResponse.result;
        tradeWorkerInfo = {
          success: tradeResponse.success,
          error: tradeResponse.error,
          worker: 'trade-worker'
        };
      }

      // Process notification if requested
      let notificationResult = null;
      let notificationWorkerInfo = null;
      if (notify) {
        const notificationResponse = await processNotification({
          requestId,
          message: notify.message || createDefaultMessage(data),
          chatId: notify.chatId
        }, env);
        notificationResult = notificationResponse.result;
        notificationWorkerInfo = {
          success: notificationResponse.success,
          error: notificationResponse.error,
          worker: 'notification-worker'
        };
      }

      // Return success response with worker information
      return new Response(JSON.stringify({
        success: true,
        worker: 'webhook-receiver',
        requestId,
        trade: tradeWorkerInfo ? {
          ...tradeWorkerInfo,
          result: tradeResult
        } : null,
        notification: notificationWorkerInfo ? {
          ...notificationWorkerInfo,
          result: notificationResult
        } : null
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.error('Error processing webhook:', error);

      // Generic error response with worker info
      return new Response(JSON.stringify({
        success: false,
        worker: 'webhook-receiver',
        error: 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // Default response for other methods
  return new Response(JSON.stringify({
    success: false,
    worker: 'webhook-receiver',
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// Secure API key validation using a fixed-time comparison
async function validateApiKey(apiKey, env) {
  if (!apiKey) return false;
  if (!env?.API_SECRET_KEY) {
    console.error('API_SECRET_KEY environment variable is not set');
    return false;
  }

  // Use a hash comparison for security
  const encoder = new TextEncoder();
  const knownKey = env.API_SECRET_KEY; // From environment variable

  // Timing-safe comparison
  if (apiKey.length !== knownKey.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ knownKey.charCodeAt(i);
  }

  return result === 0;
}

// Forward to trade worker
async function processTrade(tradeData, env) {
  try {
    const response = await fetch(env.TRADE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.INTERNAL_SERVICE_KEY,
        'X-Request-ID': tradeData.requestId
      },
      body: JSON.stringify(tradeData)
    });

    return response.json();
  } catch (error) {
    console.error('Error forwarding to trade service:', error);
    return { error: 'Processing error' };
  }
}

// Forward to notification worker
async function processNotification(notificationData, env) {
  try {
    const response = await fetch(env.TELEGRAM_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.INTERNAL_SERVICE_KEY,
        'X-Request-ID': notificationData.requestId
      },
      body: JSON.stringify(notificationData)
    });

    return response.json();
  } catch (error) {
    console.error('Error forwarding to notification service:', error);
    return { error: 'Notification error' };
  }
}

// Create default message from trade data
function createDefaultMessage(data) {
  const { exchange, action, symbol, quantity, price } = data;
  let message = `📊 Trade Alert: ${action} ${symbol}\n`;
  message += `📈 Exchange: ${exchange}\n`;
  message += `💰 Quantity: ${quantity}\n`;

  if (price) {
    message += `💵 Price: ${price}\n`;
  }

  return message;
}
